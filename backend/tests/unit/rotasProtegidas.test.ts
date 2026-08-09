/**
 * Regressão de isolamento multi-tenant: toda rota montada sob
 * /companies/:companyId precisa aplicar authenticateToken + validateTenantAccess.
 *
 * Bug: recurringTransactions.ts não aplicava nenhum dos dois. Os controllers
 * usavam o :companyId da URL direto, então qualquer usuário autenticado lia e
 * alterava os lançamentos recorrentes de outra empresa trocando o id na URL.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', 'src', 'routes');

function fonte(arquivo: string): string {
  return readFileSync(join(RAIZ, arquivo), 'utf8');
}

/** Routers montados como /:companyId/<algo> em companies.ts. */
function routersDeTenant(): string[] {
  const companies = fonte('companies.ts');
  const imports = new Map<string, string>();
  for (const m of companies.matchAll(/import\s+(?:\{\s*)?(\w+)[^;]*?from\s+'\.\/([\w-]+)'/g)) {
    imports.set(m[1], `${m[2]}.ts`);
  }

  const arquivos = new Set<string>();
  for (const m of companies.matchAll(/router\.use\('\/:companyId\/[^']*',\s*(\w+)/g)) {
    const arquivo = imports.get(m[1]);
    if (arquivo) arquivos.add(arquivo);
  }
  return [...arquivos];
}

describe('rotas sob /companies/:companyId', () => {
  const arquivos = routersDeTenant();

  it('encontra os routers montados por companyId', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(10);
    expect(arquivos).toContain('recurringTransactions.ts');
  });

  it.each(routersDeTenant())('%s aplica authenticateToken e validateTenantAccess', (arquivo) => {
    const conteudo = fonte(arquivo);
    expect(conteudo).toMatch(/authenticateToken/);
    expect(conteudo).toMatch(/validateTenantAccess/);
    // Precisa estar de fato instalado no router, não só importado.
    expect(conteudo).toMatch(/router\.use\([^)]*validateTenantAccess/);
  });
});

describe('rota de setup', () => {
  const conteudo = fonte('setup.ts');

  it('exige SETUP_TOKEN em produção', () => {
    expect(conteudo).toMatch(/SETUP_TOKEN/);
    expect(conteudo).toMatch(/x-setup-token/);
  });

  it('compara o token em tempo constante', () => {
    expect(conteudo).toMatch(/timingSafeEqual/);
  });
});

describe('health checks detalhados', () => {
  const conteudo = fonte('health.ts');

  it('protege /cache e /database, mantendo / público para o deploy', () => {
    expect(conteudo).toMatch(/router\.get\('\/cache',\s*authenticateToken/);
    expect(conteudo).toMatch(/router\.get\('\/database',\s*authenticateToken/);
    expect(conteudo).toMatch(/router\.get\('\/',\s*HealthController\.health\)/);
  });
});
