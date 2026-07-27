/**
 * empresas.spec.ts — CRUD de Empresas
 */
import { test, expect } from '@playwright/test';
import { loginAs, ensureCompanySelected } from './helpers';

// CNPJ com dígitos verificadores válidos — o backend rejeita CNPJ com
// checksum inválido (como o antigo '12.345.678/0001-99' usado aqui), e a
// empresa nunca chegava a ser criada de fato.
const CNPJ_TEST = '11.222.333/0001-81';
const NAME_TEST = `Empresa E2E ${Date.now()}`;

test.describe('CRUD Empresas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('lista empresas', async ({ page }) => {
    await page.goto('/empresas');
    await expect(page.getByRole('heading', { name: /empresas/i })).toBeVisible({ timeout: 8000 });
  });

  test('cria nova empresa', async ({ page }) => {
    // O formulário consulta a API de CNPJ (TrustCorp/BrasilAPI) e
    // autopreenche "Razão Social" com o nome REAL da empresa registrada
    // nesse CNPJ — como '11.222.333/0001-81' tem checksum válido e
    // corresponde a uma empresa real, essa resposta assíncrona sobrescrevia
    // o NAME_TEST digitado pelo teste (corrida entre o fill manual e o
    // autopreenchimento). Bloqueando a consulta, o autopreenchimento nunca
    // dispara e o valor digitado no teste nunca é sobrescrito.
    await page.route('**/api/v1/cnpj/**', (route) => route.abort());

    await page.goto('/empresas');
    await page.getByRole('button', { name: /nova empresa/i }).click();

    // Preenche modal
    const cnpjInput = page.getByLabel(/cnpj/i);
    await cnpjInput.fill(CNPJ_TEST);
    await page.getByLabel(/razão social/i).fill(NAME_TEST);
    await page.getByLabel(/e-mail/i).fill('e2e@teste.com');
    // O formulário tem dois campos com "regime" no label ("Regime
    // Tributário" e "Regime (CRT)") — usa o texto completo para desambiguar.
    await page.getByLabel(/regime tributário/i).selectOption('simples_nacional');

    await page.getByRole('button', { name: /salvar|criar/i }).click();

    // Empresa deve aparecer na lista (o nome também aparece truncado no
    // indicador "Empresa ativa" do header — .first() evita ambiguidade)
    await expect(page.getByText(NAME_TEST).first()).toBeVisible({ timeout: 8000 });
  });

  test('edita empresa existente', async ({ page }) => {
    await page.goto('/empresas');
    // Clica no primeiro botão de editar
    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    await editBtn.click();

    // Modal de edição deve estar visível
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

});
