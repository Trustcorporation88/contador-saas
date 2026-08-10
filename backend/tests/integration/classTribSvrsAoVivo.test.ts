/**
 * Sincronização contra o portal do SVRS de verdade.
 *
 * Os outros testes usam um fixture: provam a lógica, mas continuariam verdes se
 * o SVRS mudasse a página amanhã e o parse parasse de funcionar em produção.
 * Este aqui é o único que detecta isso — e por isso não pode ser obrigatório no
 * CI: o portal sair do ar transformaria indisponibilidade de terceiro em build
 * vermelho, e build vermelho por motivo alheio ensina a ignorar build vermelho.
 *
 * Rode sob demanda:
 *   SVRS_LIVE_TEST=1 BACKUP_TEST_DATABASE_URL=... npx jest classTribSvrsAoVivo
 *
 * Vale rodar ao mexer no parse, e periodicamente para confirmar que a fonte não
 * mudou de forma.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import knex, { Knex } from 'knex';

const TEST_URL   = process.env.BACKUP_TEST_DATABASE_URL;
const AO_VIVO    = process.env.SVRS_LIVE_TEST === '1';
const describeAoVivo = AO_VIVO && TEST_URL ? describe : describe.skip;

let db: Knex;

if (!AO_VIVO) {
  // eslint-disable-next-line no-console
  console.warn('[classTribSvrsAoVivo] SVRS_LIVE_TEST != 1 — pulado (não bate no portal).');
}

function carregarServicos() {
  jest.resetModules();
  jest.doMock('../../src/config/database', () => ({ getDatabase: async () => db }));
  jest.doMock('../../src/middleware/requestLogger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));
  /* eslint-disable @typescript-eslint/no-var-requires */
  return {
    sync: require('../../src/services/classTribSyncService'),
    consulta: require('../../src/services/classTribService'),
  };
  /* eslint-enable @typescript-eslint/no-var-requires */
}

describeAoVivo('cClassTrib — portal do SVRS ao vivo', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);
    await db('fiscal_class_trib').del();
  }, 300000);

  afterAll(async () => {
    if (db) await db.destroy();
  });

  it('baixa e grava a tabela publicada hoje', async () => {
    const { sync, consulta } = carregarServicos();

    const r = await sync.sincronizar({ lancarErro: true });

    expect(r.status).toBe('ok');
    expect(r.total_recebido).toBeGreaterThanOrEqual(sync.MINIMO_ESPERADO);

    // Códigos-âncora: existem desde a primeira publicação e a tabela ficaria
    // irreconhecível sem eles.
    const tributacaoIntegral = await consulta.buscar('000001');
    expect(tributacaoIntegral).toBeTruthy();
    expect(tributacaoIntegral.cst).toBe('000');
    expect(tributacaoIntegral.documentos).toContain('NFE');

    // A tabela tem de ser utilizável para o que o sistema emite hoje.
    const paraNfe = await consulta.listarVigentes({ documento: 'NFE' });
    expect(paraNfe.length).toBeGreaterThan(50);

    // eslint-disable-next-line no-console
    console.log(
      `[SVRS ao vivo] ${r.total_recebido} códigos | ${paraNfe.length} válidos para NF-e ` +
      `| publicação ${tributacaoIntegral.publicado_em}`,
    );
  }, 180000);
});
