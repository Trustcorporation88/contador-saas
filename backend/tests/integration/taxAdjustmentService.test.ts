/**
 * Teste de integração — LALUR contra um PostgreSQL real.
 *
 * A tabela tax_adjustments nunca existiu no migrationRunner (só no SQL solto da
 * raiz, que não é executado), então o teste cria o schema pela MESMA migração que
 * roda em produção e valida o que só o banco garante: constraints, isolamento por
 * empresa e agregação por período.
 *
 * Precisa de um banco real. Defina BACKUP_TEST_DATABASE_URL para rodar — a mesma
 * variável do teste de backup, para o CI não precisar de duas.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import knex, { Knex } from 'knex';
import { AdjustmentType } from '../../src/models/dtos/taxDTO';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

let db: Knex;
let TaxAdjustmentService: typeof import('../../src/services/taxAdjustmentService').TaxAdjustmentService;

const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[taxAdjustmentService.integration] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

describeLive('TaxAdjustmentService — contra PostgreSQL real', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    // companies mínima: a FK de company_id precisa de destino real. É de
    // propósito que a FK exista — tabela de dado de cliente sem vínculo de
    // empresa foi exatamente o problema de bank_transactions.
    await db.raw('CREATE TABLE IF NOT EXISTS companies (id uuid PRIMARY KEY, legal_name text)');
    await db('companies').insert([
      { id: EMPRESA_A, legal_name: 'Empresa A' },
      { id: EMPRESA_B, legal_name: 'Empresa B' },
    ]).onConflict('id').ignore();

    await db.raw('DROP TABLE IF EXISTS tax_adjustments');

    // Roda a migração REAL, não um CREATE TABLE escrito no teste: assim o teste
    // falha se a migração de produção divergir.
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await db('migrations_executed').where('migration_name', '024_tax_adjustments_lalur').del();
    await runMigrationsIfNeeded(db);

    // O serviço usa getDatabase(); aponta para esta conexão.
    jest.doMock('../../src/config/database', () => ({ getDatabase: async () => db }));
    jest.resetModules();
    ({ TaxAdjustmentService } = await import('../../src/services/taxAdjustmentService'));
  }, 120000);

  afterAll(async () => {
    if (db) await db.destroy();
  });

  beforeEach(async () => {
    await db('tax_adjustments').del();
  });

  it('a migração cria a tabela com as constraints esperadas', async () => {
    expect(await db.schema.hasTable('tax_adjustments')).toBe(true);
    for (const coluna of ['company_id', 'period_start', 'period_end', 'adjustment_type', 'amount', 'justification']) {
      expect(await db.schema.hasColumn('tax_adjustments', coluna)).toBe(true);
    }
  });

  it('RLS fica habilitada já na criação (chave anon do Supabase não lê)', async () => {
    // Tabela nova sem RLS fica exposta na API REST do Supabase até alguém rodar o
    // script de blindagem à mão — falha recorrente neste projeto.
    const { rows } = await db.raw(
      'SELECT relrowsecurity FROM pg_class WHERE relname = ?', ['tax_adjustments'],
    );
    expect(rows[0].relrowsecurity).toBe(true);
  });

  it('o banco recusa amount <= 0 (o sinal vem do tipo, não do valor)', async () => {
    await expect(db('tax_adjustments').insert({
      company_id: EMPRESA_A, period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: -100, justification: 'x',
    })).rejects.toThrow(/chk_tax_adj_amount_positivo|violates check constraint/);
  });

  it('o banco recusa adjustment_type fora do domínio', async () => {
    await expect(db('tax_adjustments').insert({
      company_id: EMPRESA_A, period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: 'QUALQUER', amount: 100, justification: 'x',
    })).rejects.toThrow(/chk_tax_adj_type|violates check constraint/);
  });

  it('o banco recusa ajuste de empresa inexistente (FK de tenant)', async () => {
    await expect(db('tax_adjustments').insert({
      company_id: '99999999-9999-4999-8999-999999999999',
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 100, justification: 'x',
    })).rejects.toThrow(/foreign key|violates/);
  });

  it('cria e soma adições e exclusões do período', async () => {
    await TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 30000,
      justification: 'Multa de trânsito — indedutível',
    });
    await TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 20000,
      justification: 'Brindes',
    });
    await TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.EXCLUSION, amount: 15000,
      justification: 'Dividendos recebidos',
    });

    const totals = await TaxAdjustmentService.totals(EMPRESA_A, '2025-01-01', '2025-03-31');
    expect(totals.adicoes).toBe(50000);
    expect(totals.exclusoes).toBe(15000);
    expect(totals.quantidade).toBe(3);
  });

  it('a soma anual inclui os ajustes dos trimestres contidos', async () => {
    await TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 10000, justification: 'Q1',
    });
    await TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-10-01', period_end: '2025-12-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 25000, justification: 'Q4',
    });

    expect((await TaxAdjustmentService.totals(EMPRESA_A, '2025-01-01', '2025-12-31')).adicoes).toBe(35000);
    // Apurando só o 1º trimestre, o ajuste do 4º não entra.
    expect((await TaxAdjustmentService.totals(EMPRESA_A, '2025-01-01', '2025-03-31')).adicoes).toBe(10000);
  });

  it('não vaza ajuste entre empresas', async () => {
    await TaxAdjustmentService.create(EMPRESA_B, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 99999,
      justification: 'Da empresa B',
    });

    expect((await TaxAdjustmentService.totals(EMPRESA_A, '2025-01-01', '2025-12-31')).adicoes).toBe(0);
    expect(await TaxAdjustmentService.list(EMPRESA_A)).toHaveLength(0);
    expect(await TaxAdjustmentService.list(EMPRESA_B)).toHaveLength(1);
  });

  it('remove só na própria empresa', async () => {
    const daB = await TaxAdjustmentService.create(EMPRESA_B, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 500, justification: 'B',
    });

    // Sem company_id no WHERE, um id de outra empresa seria apagável de qualquer
    // tenant.
    await expect(TaxAdjustmentService.remove(EMPRESA_A, daB.id)).rejects.toThrow(/não encontrado/);
    expect(await TaxAdjustmentService.remove(EMPRESA_B, daB.id)).toBe(true);
  });

  it('recusa justificativa vazia — o LALUR exige fundamentação', async () => {
    await expect(TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 100, justification: '   ',
    })).rejects.toThrow(/justification/);
  });

  it('recusa período invertido e amount não positivo antes de tocar o banco', async () => {
    await expect(TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-12-31', period_end: '2025-01-01',
      adjustment_type: AdjustmentType.ADDITION, amount: 100, justification: 'x',
    })).rejects.toThrow(/invertido/);

    await expect(TaxAdjustmentService.create(EMPRESA_A, null, {
      period_start: '2025-01-01', period_end: '2025-03-31',
      adjustment_type: AdjustmentType.ADDITION, amount: 0, justification: 'x',
    })).rejects.toThrow(/maior que zero/);
  });
});
