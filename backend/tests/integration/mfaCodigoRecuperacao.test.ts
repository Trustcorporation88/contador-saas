/**
 * Código de recuperação do MFA — a saída de quem perdeu o celular.
 *
 * O defeito: enableMFA gerava dez códigos, gravava os hashes e devolvia a lista
 * ao cliente, mas NENHUM caminho do sistema os aceitava. O guard do verifyMFA
 * exigia exatamente 6 caracteres e os códigos têm 8 — eram recusados na
 * primeira linha, antes de qualquer comparação.
 *
 * Consequência: ativar o MFA e perder o aparelho trancava o usuário fora da
 * conta, sem saída pela interface. Num sistema com um único administrador
 * cuidando de 19 empresas, isso é perder o sistema. E o pior: nada avisava —
 * os códigos apareciam na resposta da API como se valessem.
 *
 * A tela também não os exibia, então na prática ninguém sequer os tinha. Os
 * dois lados do problema estão cobertos: aqui o backend, e o frontend passa a
 * mostrá-los uma única vez.
 *
 * Precisa de banco real: BACKUP_TEST_DATABASE_URL.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import knex, { Knex } from 'knex';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

const USER_ID = '12121212-1212-4212-8212-121212121212';
const EMAIL   = 'recuperacao@teste.local';
const SENHA   = 'SenhaForte@2026';

let db: Knex;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[mfaCodigoRecuperacao] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

function carregarAuthService() {
  jest.resetModules();
  jest.doMock('../../src/config/database', () => ({ getDatabase: async () => db }));
  jest.doMock('../../src/middleware/requestLogger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/services/authService').default;
}

async function codigosNoBanco(): Promise<string[]> {
  const linha = await db('users').where('id', USER_ID).first();
  const bruto = linha?.backup_codes;
  if (!bruto) return [];
  return Array.isArray(bruto) ? bruto : JSON.parse(String(bruto));
}

describeLive('MFA — código de recuperação', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);
  }, 300000);

  afterAll(async () => {
    if (db) { await db('users').where('id', USER_ID).del(); await db.destroy(); }
  });

  beforeEach(async () => {
    await db('users').where('id', USER_ID).del();
    await db('users').insert({
      id: USER_ID,
      email: EMAIL,
      password_hash: await bcrypt.hash(SENHA, 10),
      full_name: 'Usuário Recuperação',
      role: 'admin',
      is_active: true,
    });
  });

  it('os dez códigos entregues são os que funcionam', async () => {
    // Antes: a API devolvia a lista, o usuário guardava, e nenhum deles servia
    // para nada. O teste central deste arquivo.
    const authService = carregarAuthService();
    const setup = await authService.enableMFA(USER_ID);

    expect(setup.backupCodes).toHaveLength(10);

    const resultado = await authService.verifyMFA(USER_ID, setup.backupCodes[0]);
    expect(resultado.accessToken).toBeTruthy();

    // E o MFA ficou de fato ativado por esse caminho.
    expect((await db('users').where('id', USER_ID).first()).mfa_enabled).toBe(true);
  }, 120000);

  it('SE GASTA: o mesmo código não vale duas vezes', async () => {
    // Sem consumo, cada código viraria uma senha permanente que dispensa o
    // segundo fator — o oposto do que o MFA existe para fazer.
    const authService = carregarAuthService();
    const setup = await authService.enableMFA(USER_ID);
    const codigo = setup.backupCodes[3];

    await authService.verifyMFA(USER_ID, codigo);
    await expect(authService.verifyMFA(USER_ID, codigo))
      .rejects.toThrow(/Invalid MFA code/i);

    expect(await codigosNoBanco()).toHaveLength(9);
  }, 120000);

  it('gastar um código não invalida os outros nove', async () => {
    const authService = carregarAuthService();
    const setup = await authService.enableMFA(USER_ID);

    await authService.verifyMFA(USER_ID, setup.backupCodes[0]);
    // Um segundo código, diferente, continua servindo.
    const segundo = await authService.verifyMFA(USER_ID, setup.backupCodes[1]);
    expect(segundo.accessToken).toBeTruthy();

    expect(await codigosNoBanco()).toHaveLength(8);
  }, 120000);

  it('SOBREVIVE AO RESTART: o código vale num processo novo', async () => {
    // É o cenário real: o celular quebrou hoje, o deploy aconteceu ontem.
    const authService = carregarAuthService();
    const setup = await authService.enableMFA(USER_ID);

    const depoisDoRestart = carregarAuthService();
    const r = await depoisDoRestart.verifyMFA(USER_ID, setup.backupCodes[5]);
    expect(r.accessToken).toBeTruthy();
  }, 120000);

  it('aceita o código como o usuário digita: minúscula, espaço, hífen', async () => {
    // O código é copiado de um papel. Recusar por formatação seria recusar o
    // código certo justamente quando ele é a última alternativa.
    const authService = carregarAuthService();
    const setup = await authService.enableMFA(USER_ID);
    const codigo = setup.backupCodes[2];

    const digitado = `${codigo.slice(0, 4).toLowerCase()} ${codigo.slice(4).toLowerCase()}`;
    const r = await authService.verifyMFA(USER_ID, digitado);
    expect(r.accessToken).toBeTruthy();
  }, 120000);

  it('o TOTP continua funcionando normalmente', async () => {
    // A correção não pode ter quebrado o caminho principal.
    const authService = carregarAuthService();
    const setup = await authService.enableMFA(USER_ID);
    const totp = speakeasy.totp({ secret: setup.secret, encoding: 'base32' });

    const r = await authService.verifyMFA(USER_ID, totp);
    expect(r.accessToken).toBeTruthy();
    // TOTP não consome código de recuperação.
    expect(await codigosNoBanco()).toHaveLength(10);
  }, 120000);

  it('recusa código de recuperação inventado', async () => {
    const authService = carregarAuthService();
    await authService.enableMFA(USER_ID);

    await expect(authService.verifyMFA(USER_ID, 'DEADBEEF'))
      .rejects.toThrow(/Invalid MFA code/i);
    // Tentativa falha não gasta os códigos de ninguém.
    expect(await codigosNoBanco()).toHaveLength(10);
  }, 120000);

  it('recusa formato que não é nem TOTP nem código de recuperação', async () => {
    const authService = carregarAuthService();
    await authService.enableMFA(USER_ID);

    for (const invalido of ['', '123', 'ZZZZZZZZ', '1234567890123']) {
      await expect(authService.verifyMFA(USER_ID, invalido)).rejects.toThrow();
    }
    expect(await codigosNoBanco()).toHaveLength(10);
  }, 120000);

  it('os códigos ficam no banco só como hash', async () => {
    const authService = carregarAuthService();
    const setup = await authService.enableMFA(USER_ID);

    const gravados = await codigosNoBanco();
    for (const codigo of setup.backupCodes) {
      expect(gravados).not.toContain(codigo);
    }
    // E cada hash confere com o código correspondente.
    expect(await bcrypt.compare(setup.backupCodes[0], gravados[0])).toBe(true);
  }, 120000);
});
