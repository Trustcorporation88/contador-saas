/**
 * O que o CompanyService realmente GRAVA no endereço.
 *
 * A regra pura está coberta em tests/unit/textoLimpo. O que falta provar é que
 * o serviço a aplica — no create E no update — porque o defeito original não
 * foi a regra estar errada: foi ela existir só no frontend, e casando apenas a
 * palavra "undefined" sozinha.
 *
 * Contra banco real porque o que importa é a linha gravada. Com mock, um
 * `expect(insert).toHaveBeenCalledWith(...)` passaria mesmo que a coluna
 * recebesse outra coisa.
 *
 * Precisa de BACKUP_TEST_DATABASE_URL.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import knex, { Knex } from 'knex';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

let db: Knex;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[companyEnderecoSanitizacao] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

/** CNPJs válidos (dígito verificador correto) — o DTO valida antes de gravar. */
const CNPJ_A = '19131243000197';
const CNPJ_B = '27865757000102';

function carregarServico() {
  jest.resetModules();
  jest.doMock('../../src/config/database', () => ({ getDatabase: async () => db }));
  jest.doMock('../../src/middleware/requestLogger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/services/companyService').CompanyService;
}

async function linhaDoBanco(cnpj: string): Promise<Record<string, unknown>> {
  return (await db('companies').where('cnpj', cnpj).first()) as Record<string, unknown>;
}

async function limpar(): Promise<void> {
  for (const cnpj of [CNPJ_A, CNPJ_B]) {
    const empresa = await db('companies').where('cnpj', cnpj).first();
    if (empresa) {
      await db('company_users').where('company_id', empresa.id).del().catch(() => undefined);
      await db('companies').where('id', empresa.id).del();
    }
  }
}

describeLive('Endereço da empresa — "undefined" não chega ao banco', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);
    await limpar();
  }, 300000);

  afterAll(async () => {
    if (db) { await limpar(); await db.destroy(); }
  });

  beforeEach(limpar);

  it('CRIAÇÃO: grava o endereço sem o token, preservando o resto', async () => {
    const CompanyService = carregarServico();
    await CompanyService.create({
      cnpj: CNPJ_A,
      name: 'Empresa Endereco Teste Ltda',
      tax_regime: 'simples_nacional',
      // Exatamente o que está gravado na RR VESTUARIO em produção.
      address: 'undefined SETE DE SETEMBRO',
      city: 'AGUDOS',
      state: 'SP',
    });

    const linha = await linhaDoBanco(CNPJ_A);
    expect(linha.address).toBe('SETE DE SETEMBRO');
    expect(String(linha.address)).not.toMatch(/undefined/i);
  }, 120000);

  it('CRIAÇÃO: endereço que é só "undefined" fica nulo, não a palavra', async () => {
    const CompanyService = carregarServico();
    await CompanyService.create({
      cnpj: CNPJ_A,
      name: 'Empresa Endereco Nulo Ltda',
      tax_regime: 'simples_nacional',
      address: 'undefined',
    });

    // Nulo é a verdade: o endereço nunca foi capturado. Gravar a palavra
    // afirmaria que existe um endereço chamado "undefined".
    expect((await linhaDoBanco(CNPJ_A)).address).toBeNull();
  }, 120000);

  it('ATUALIZAÇÃO: a mesma limpeza vale ao editar', async () => {
    // O create podia estar limpo e o update sujo — são dois caminhos distintos
    // no serviço, cada um com sua lista de campos.
    const CompanyService = carregarServico();
    const criada = await CompanyService.create({
      cnpj: CNPJ_A,
      name: 'Empresa Para Editar Ltda',
      tax_regime: 'simples_nacional',
      address: 'Rua Correta',
    });

    await CompanyService.update(criada.id, {
      address: 'undefined AVENIDA BRASIL',
      city: 'undefined',
      endereco_bairro: 'Centro  Velho',
    });

    const linha = await linhaDoBanco(CNPJ_A);
    expect(linha.address).toBe('AVENIDA BRASIL');
    expect(linha.city).toBeNull();
    expect(linha.endereco_bairro).toBe('Centro Velho');
  }, 120000);

  it('não estraga endereço legítimo', async () => {
    const CompanyService = carregarServico();
    await CompanyService.create({
      cnpj: CNPJ_A,
      name: 'Empresa Endereco Bom Ltda',
      tax_regime: 'simples_nacional',
      address: 'Avenida Hipodromo',
      city: 'Bauru',
      state: 'SP',
      endereco_bairro: 'Jardim Nullo Figueiredo',
    });

    const linha = await linhaDoBanco(CNPJ_A);
    expect(linha.address).toBe('Avenida Hipodromo');
    expect(linha.city).toBe('Bauru');
    // "Nullo" contém "null" mas não é o token — a borda de palavra protege.
    expect(linha.endereco_bairro).toBe('Jardim Nullo Figueiredo');
  }, 120000);

  it('e-mail que contém o token não é recortado', async () => {
    // E-mail passa por semPlaceholder, não por textoLivre: recortar o meio
    // produziria "@dominio.com" — inválido, gravado como se fosse bom.
    const CompanyService = carregarServico();
    await CompanyService.create({
      cnpj: CNPJ_B,
      name: 'Empresa Email Teste Ltda',
      tax_regime: 'lucro_presumido',
      email: 'undefined@dominio.com.br',
    });

    expect((await linhaDoBanco(CNPJ_B)).email).toBe('undefined@dominio.com.br');
  }, 120000);
});
