/**
 * Bloqueio por tentativas de login precisa sobreviver ao restart.
 *
 * O defeito: o lockout vivia só em `loginAttemptsStore`, um Map por e-mail. As
 * colunas login_attempts e locked_until eram hidratadas do banco e nunca lidas
 * para decidir nada nem gravadas — campos mortos.
 *
 * Consequência: o Railway reinicia a cada deploy, e o Map zerava. Quem estivesse
 * bloqueado ganhava 5 tentativas novas. Com um único usuário admin dando acesso à
 * contabilidade de 19 empresas, o teto contra força bruta era o intervalo entre
 * dois deploys.
 *
 * O teste central é `sobrevive ao restart`. Um teste que só esgotasse as
 * tentativas no mesmo processo passaria com o bug presente.
 *
 * Precisa de banco real: BACKUP_TEST_DATABASE_URL.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import knex, { Knex } from 'knex';
import bcrypt from 'bcrypt';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

const USER_ID = '44444444-4444-4444-8444-444444444444';
const EMAIL   = 'lockout-teste@contador.local';
const SENHA   = 'SenhaCerta@2026';
const ERRADA  = 'SenhaErrada@2026';

let db: Knex;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[lockoutPersistencia.integration] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

/** Instância nova do authService: equivale a um processo recém-iniciado. */
function carregarAuthServiceNovo() {
  jest.resetModules();
  jest.doMock('../../src/config/database', () => ({ getDatabase: async () => db }));
  jest.doMock('../../src/middleware/requestLogger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/services/authService').default;
}

async function usuarioNoBanco(): Promise<Record<string, unknown>> {
  return (await db('users').where('id', USER_ID).first()) as Record<string, unknown>;
}

/** Esgota as 5 tentativas permitidas no processo informado. */
async function esgotarTentativas(authService: { login: (e: string, s: string) => Promise<unknown> }) {
  for (let i = 0; i < 5; i++) {
    await expect(authService.login(EMAIL, ERRADA)).rejects.toThrow();
  }
}

describeLive('Lockout de login — persistência no banco', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    await db.raw(`CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      email varchar(255) UNIQUE NOT NULL,
      password_hash varchar(255) NOT NULL,
      full_name varchar(255),
      role varchar(50) DEFAULT 'user',
      is_active boolean DEFAULT true,
      company_id uuid,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`);

    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);
  }, 180000);

  afterAll(async () => {
    if (db) {
      await db('users').where('id', USER_ID).del();
      await db.destroy();
    }
  });

  beforeEach(async () => {
    await db('users').where('id', USER_ID).del();
    await db('users').insert({
      id: USER_ID,
      email: EMAIL,
      password_hash: await bcrypt.hash(SENHA, 10),
      full_name: 'Usuário Lockout',
      role: 'admin',
      is_active: true,
      login_attempts: 0,
      locked_until: null,
    });
  });

  it('cada senha errada incrementa o contador no banco', async () => {
    const authService = carregarAuthServiceNovo();

    await expect(authService.login(EMAIL, ERRADA)).rejects.toThrow();
    expect(Number((await usuarioNoBanco()).login_attempts)).toBe(1);

    await expect(authService.login(EMAIL, ERRADA)).rejects.toThrow();
    expect(Number((await usuarioNoBanco()).login_attempts)).toBe(2);
  }, 60000);

  it('na quinta falha grava o bloqueio com prazo no banco', async () => {
    const authService = carregarAuthServiceNovo();
    await esgotarTentativas(authService);

    const row = await usuarioNoBanco();
    expect(Number(row.login_attempts)).toBe(5);
    expect(row.locked_until).toBeTruthy();

    const lockedUntil = new Date(String(row.locked_until)).getTime();
    // Janela de 15 minutos, com folga para o tempo de execução do teste.
    expect(lockedUntil).toBeGreaterThan(Date.now() + 13 * 60 * 1000);
    expect(lockedUntil).toBeLessThan(Date.now() + 16 * 60 * 1000);
  }, 60000);

  it('SOBREVIVE AO RESTART: bloqueado continua bloqueado num processo novo', async () => {
    const authService = carregarAuthServiceNovo();
    await esgotarTentativas(authService);

    // Restart: Map vazio. Era aqui que o atacante recuperava as 5 tentativas.
    const depoisDoRestart = carregarAuthServiceNovo();

    // Com a SENHA CORRETA: mesmo assim tem de ser recusado, porque o bloqueio é
    // por conta e não por sessão. Usar a senha certa aqui é o que distingue
    // bloqueio real de "só errou a senha de novo".
    await expect(depoisDoRestart.login(EMAIL, SENHA))
      .rejects.toMatchObject({ name: 'RateLimitError' });
  }, 90000);

  it('a mensagem do bloqueio informa quanto tempo falta', async () => {
    const authService = carregarAuthServiceNovo();
    await esgotarTentativas(authService);

    const depoisDoRestart = carregarAuthServiceNovo();
    await expect(depoisDoRestart.login(EMAIL, SENHA))
      .rejects.toThrow(/bloqueada.*\d+ minuto/i);
  }, 90000);

  it('bloqueio expirado deixa o login passar de novo', async () => {
    // Bloqueio no passado: simula os 15 minutos já cumpridos, sem esperar.
    await db('users').where('id', USER_ID).update({
      login_attempts: 5,
      locked_until: new Date(Date.now() - 60 * 1000),
    });

    const authService = carregarAuthServiceNovo();
    const login = await authService.login(EMAIL, SENHA);
    expect(login.accessToken).toBeTruthy();
  }, 60000);

  it('login bem-sucedido zera o contador no banco', async () => {
    const authService = carregarAuthServiceNovo();

    // 3 falhas, abaixo do teto
    for (let i = 0; i < 3; i++) {
      await expect(authService.login(EMAIL, ERRADA)).rejects.toThrow();
    }
    expect(Number((await usuarioNoBanco()).login_attempts)).toBe(3);

    // Processo novo para não bater no rate limit em memória do mesmo e-mail.
    const outroProcesso = carregarAuthServiceNovo();
    await outroProcesso.login(EMAIL, SENHA);

    const row = await usuarioNoBanco();
    expect(Number(row.login_attempts)).toBe(0);
    expect(row.locked_until).toBeNull();
  }, 90000);

  it('o contador não vaza entre usuários', async () => {
    const outroId = '55555555-5555-4555-8555-555555555555';
    const outroEmail = 'outro-lockout@contador.local';
    await db('users').where('id', outroId).del();
    await db('users').insert({
      id: outroId,
      email: outroEmail,
      password_hash: await bcrypt.hash(SENHA, 10),
      full_name: 'Outro',
      role: 'user',
      is_active: true,
      login_attempts: 0,
    });

    try {
      const authService = carregarAuthServiceNovo();
      await esgotarTentativas(authService);

      // O outro usuário segue livre.
      const outroProcesso = carregarAuthServiceNovo();
      const login = await outroProcesso.login(outroEmail, SENHA);
      expect(login.accessToken).toBeTruthy();
      expect(Number((await db('users').where('id', outroId).first()).login_attempts)).toBe(0);
    } finally {
      await db('users').where('id', outroId).del();
    }
  }, 120000);
});
