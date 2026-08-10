/**
 * troca-empresa.spec.ts — A troca de empresa precisa trocar os dados de fato.
 *
 * Cobre o bug que deixava o multiempresa quebrado em Contas a Pagar/Receber e
 * Documentos: essas rotas não levam o companyId na URL — o backend as escopa por
 * req.user.companyId, que vem do JWT do LOGIN. O middleware applyCompanyContext
 * existe para permitir a troca sem novo token, lendo o header X-Company-Id, e o
 * frontend nunca enviava esse header. Resultado: trocar de empresa mudava só o
 * rótulo na tela e o contador podia registrar pagamento na empresa errada.
 *
 * Somado a isso, as queryKeys dessas telas não continham o companyId, então o
 * cache servia os títulos da empresa anterior.
 *
 * A API é interceptada (sem backend) para o teste ser determinístico e rodar no
 * CI sem banco: o que importa aqui é o que o frontend ENVIA e o que RENDERIZA.
 */
import { test, expect, type Page } from '@playwright/test';

const EMPRESA_A = { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', name: 'Padaria do Ze Ltda', cnpj: '50151910000143' };
const EMPRESA_B = { id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', name: 'Metalurgica Sul SA', cnpj: '11222333000181' };

/** Títulos distintos por empresa — é assim que detectamos cache cruzado. */
const TITULOS: Record<string, {
  numero_titulo: string; descricao: string; fornecedor_nome: string; valor: number;
}> = {
  [EMPRESA_A.id]: {
    numero_titulo: 'TIT-EMPRESA-A',
    // descricao distinta do numero_titulo: iguais, o texto apareceria duas vezes
    // na linha e o getByText cairia em strict mode violation.
    descricao: 'Compra de farinha',
    fornecedor_nome: 'Fornecedor da Padaria',
    valor: 1500,
  },
  [EMPRESA_B.id]: {
    numero_titulo: 'TIT-EMPRESA-B',
    descricao: 'Compra de chapa de aco',
    fornecedor_nome: 'Fornecedor da Metalurgica',
    valor: 9900,
  },
};

/** Registra todo X-Company-Id que o app enviou para /contas-pagar. */
type HeaderLog = string[];

async function stubApi(page: Page, headerLog: HeaderLog) {
  // Sessão: o store persiste em localStorage e NÃO persiste o accessToken, então
  // o app sobe sem token, toma 401 na primeira request e faz refresh.
  await page.addInitScript(([empresaA]) => {
    window.localStorage.setItem('contador-auth', JSON.stringify({
      state: {
        // 'accountant' e não 'admin': /contas-pagar exige FULL_ACCESS
        // (utils/access.ts) e admin, no backend, ignora a checagem de tenant —
        // o caso que interessa aqui é o do usuário comum trocando de empresa.
        user: { id: 'user-1', email: 'contador@teste.com', name: 'Contador', role: 'accountant' },
        refreshToken: 'refresh-token-de-teste',
        currentCompanyId: (empresaA as { id: string }).id,
        isAuthenticated: true,
      },
      version: 0,
    }));
  }, [EMPRESA_A]);

  await page.route('**/api/v1/auth/refresh-token', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { accessToken: 'access-token-de-teste', refreshToken: 'refresh-token-de-teste' } }),
    }),
  );

  await page.route('**/api/v1/companies**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [EMPRESA_A, EMPRESA_B], pagination: { total: 2, page: 1, limit: 50 } }),
    }),
  );

  // Um único handler para /contas-pagar*, decidindo pelo pathname. Glob com '?'
  // não casa a querystring de forma confiável, e em Playwright a rota registrada
  // por último vence — dois globs sobrepostos aqui dariam confusão silenciosa.
  await page.route('**/api/v1/contas-pagar**', route => {
    const { pathname } = new URL(route.request().url());
    const companyId = route.request().headers()['x-company-id'] ?? '(ausente)';
    const titulo = TITULOS[companyId];

    if (pathname.includes('/stats/')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            total_aberto: titulo ? titulo.valor : 0,
            total_vencido: 0,
            total_pago_mes: 0,
            quantidade_aberta: titulo ? 1 : 0,
            quantidade_vencida: 0,
          },
        }),
      });
      return;
    }

    // Listagem: registra o header que chegou, para o teste poder afirmar sobre ele.
    headerLog.push(companyId);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: titulo
          ? [{
            id: `conta-${companyId}`,
            categoria: 'fornecedor',
            numero_titulo: titulo.numero_titulo,
            descricao: titulo.descricao,
            fornecedor_nome: titulo.fornecedor_nome,
            data_emissao: '2026-07-01',
            data_vencimento: '2026-08-20',
            valor_original: titulo.valor,
            valor_pago: 0,
            juros: 0,
            multa: 0,
            desconto: 0,
            status: 'pendente',
            saldo_aberto: titulo.valor,
            dias_atraso: 0,
          }]
          : [],
        pagination: { total: titulo ? 1 : 0, page: 1, limit: 50 },
      }),
    });
  });
}

test.describe('Troca de empresa', () => {

  test('envia X-Company-Id da empresa ativa nas rotas sem companyId na URL', async ({ page }) => {
    const headerLog: HeaderLog = [];
    await stubApi(page, headerLog);

    await page.goto('/contas-pagar');
    await expect(page.getByText('TIT-EMPRESA-A')).toBeVisible({ timeout: 15_000 });

    // Sem o header, o backend serviria a empresa gravada no JWT do login.
    expect(headerLog.length).toBeGreaterThan(0);
    expect(headerLog).toContain(EMPRESA_A.id);
    expect(headerLog).not.toContain('(ausente)');
  });

  test('trocar de empresa troca os dados na tela, sem servir cache da anterior', async ({ page }) => {
    const headerLog: HeaderLog = [];
    await stubApi(page, headerLog);

    await page.goto('/contas-pagar');
    await expect(page.getByText('TIT-EMPRESA-A')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Fornecedor da Padaria')).toBeVisible();

    // Troca pelo seletor do header.
    await page.getByRole('button', { name: /empresa ativa|nenhuma selecionada/i }).click();
    await page.getByRole('button', { name: new RegExp(EMPRESA_B.name, 'i') }).click();

    // O título da empresa B precisa aparecer E o da A desaparecer. Se o cache
    // servisse a empresa anterior, TIT-EMPRESA-A continuaria em tela.
    await expect(page.getByText('TIT-EMPRESA-B')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('TIT-EMPRESA-A')).toHaveCount(0);
    await expect(page.getByText('Fornecedor da Metalurgica')).toBeVisible();

    // E a requisição foi feita com o id da empresa nova.
    expect(headerLog).toContain(EMPRESA_B.id);
  });
});
