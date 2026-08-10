/**
 * MFA precisa sobreviver ao restart — teste contra PostgreSQL real.
 *
 * O defeito: `usersStore` é um Map em memória (o comentário no código diz
 * "Mock database stores"). enableMFA e verifyMFA só escreviam nele, e as colunas
 * mfa_enabled/mfa_secret nunca existiram no banco porque a migração que as cria
 * (src/migrations/add_auth_tables.ts) não está no migrationRunner.
 *
 * Consequência: o usuário escaneava o QR code, o sistema confirmava a ativação, e
 * no deploy seguinte — o Railway reinicia a cada deploy — o Map zerava, o usuário
 * era re-hidratado do banco e o MFA voltava desligado. Sem aviso: o login
 * simplesmente parava de pedir o segundo fator. Pior que não ter MFA, porque o
 * usuário acredita estar protegido.
 *
 * O teste central aqui é `sobrevive ao restart`: ele descarta o módulo (o que
 * zera o Map, exatamente como um restart de processo faz) e verifica no BANCO e
 * na re-hidratação que o MFA continua ativo. Um teste que só checasse o retorno
 * de verifyMFA passaria mesmo com o bug.
 *
 * Precisa de banco real: BACKUP_TEST_DATABASE_URL (mesma variável dos outros
 * testes de integração).
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

const USER_ID  = '33333333-3333-4333-8333-333333333333';
const EMAIL    = 'mfa-teste@contador.local';
const SENHA    = 'SenhaForte@2026';

let db: Knex;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[mfaPersistencia.integration] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

/**
 * Carrega uma instância NOVA do authService. Cada chamada equivale a um processo
 * recém-iniciado: o usersStore volta vazio.
 */
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

describeLive('MFA — persistência no banco', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    // Schema mínimo + a migração 025, que é o objeto do teste.
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
    // Estado ANTES da correção: sem nenhuma coluna de MFA.
    for (const coluna of ['mfa_enabled', 'mfa_secret', 'backup_codes', 'last_login', 'login_attempts', 'locked_until']) {
      await db.raw(`ALTER TABLE users DROP COLUMN IF EXISTS ${coluna}`);
    }

    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await db('migrations_executed').where('migration_name', '025_users_mfa_e_lockout').del();
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
      full_name: 'Usuário MFA',
      role: 'admin',
      is_active: true,
    });
  });

  it('a migração 025 cria as colunas de MFA e de lockout', async () => {
    for (const coluna of ['mfa_enabled', 'mfa_secret', 'backup_codes', 'last_login', 'login_attempts', 'locked_until']) {
      expect(await db.schema.hasColumn('users', coluna)).toBe(true);
    }
    // Default coerente: usuário existente não nasce com MFA "ligado".
    expect((await usuarioNoBanco()).mfa_enabled).toBe(false);
  });

  it('enableMFA grava o secret no banco antes de devolver o QR code', async () => {
    const authService = carregarAuthServiceNovo();
    const setup = await authService.enableMFA(USER_ID);

    expect(setup.secret).toBeTruthy();
    expect(setup.backupCodes).toHaveLength(10);

    const row = await usuarioNoBanco();
    // Antes da correção isto ficava só no Map.
    expect(row.mfa_secret).toBe(setup.secret);
    // Ainda não ativo: só a verificação do código ativa.
    expect(row.mfa_enabled).toBe(false);
    // Códigos de recuperação gravados como hash, nunca em texto claro.
    const hashes = JSON.parse(String(row.backup_codes));
    expect(hashes).toHaveLength(10);
    for (const codigo of setup.backupCodes) {
      expect(hashes).not.toContain(codigo);
    }
    expect(await bcrypt.compare(setup.backupCodes[0], hashes[0])).toBe(true);
  }, 60000);

  it('verifyMFA ativa o MFA no banco', async () => {
    const authService = carregarAuthServiceNovo();
    const setup = await authService.enableMFA(USER_ID);
    const codigo = speakeasy.totp({ secret: setup.secret, encoding: 'base32' });

    await authService.verifyMFA(USER_ID, codigo);

    expect((await usuarioNoBanco()).mfa_enabled).toBe(true);
  }, 60000);

  it('SOBREVIVE AO RESTART: o MFA continua ativo num processo novo', async () => {
    const authService = carregarAuthServiceNovo();
    const setup = await authService.enableMFA(USER_ID);
    const codigo = speakeasy.totp({ secret: setup.secret, encoding: 'base32' });
    await authService.verifyMFA(USER_ID, codigo);

    // Restart: instância nova, usersStore vazio. Era exatamente aqui que o MFA
    // desaparecia — o login voltava a não pedir o segundo fator.
    const depoisDoRestart = carregarAuthServiceNovo();

    // O login precisa reconhecer que este usuário tem MFA. O contrato do
    // authService é devolver um token TEMPORÁRIO com mfaRequired e sem refresh
    // token, em vez de lançar erro. Sem a correção, o login concluía normal e
    // devolvia sessão completa — o segundo fator desaparecia em silêncio.
    const loginPosRestart = await depoisDoRestart.login(EMAIL, SENHA);
    expect(loginPosRestart.user.mfaEnabled).toBe(true);
    expect(loginPosRestart.refreshToken).toBe('');
    const payload = JSON.parse(
      Buffer.from(loginPosRestart.accessToken.split('.')[1], 'base64').toString('utf8'),
    );
    expect(payload.mfaRequired).toBe(true);

    // E o secret continua o mesmo, então o código do autenticador do usuário
    // segue válido — não basta o flag sobreviver.
    const novoCodigo = speakeasy.totp({ secret: setup.secret, encoding: 'base32' });
    const verificado = await depoisDoRestart.verifyMFA(USER_ID, novoCodigo);
    expect(verificado.accessToken).toBeTruthy();
  }, 90000);

  it('enableMFA funciona num processo novo (JWT sobrevive ao restart, o Map não)', async () => {
    // enableMFA lia usersStore.get direto: um usuário autenticado que chamasse
    // este endpoint depois de um deploy recebia "User not found".
    const authService = carregarAuthServiceNovo();
    const setup = await authService.enableMFA(USER_ID);
    expect(setup.secret).toBeTruthy();
  }, 60000);

  it('recusa habilitar MFA quando as colunas não existem, em vez de fingir sucesso', async () => {
    // Ambiente sem a migração: ativar só em memória daria ao usuário um QR code
    // que o servidor esqueceria no próximo restart.
    await db.raw('ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled');
    await db.raw('ALTER TABLE users DROP COLUMN IF EXISTS mfa_secret');
    await db.raw('ALTER TABLE users DROP COLUMN IF EXISTS backup_codes');
    try {
      const authService = carregarAuthServiceNovo();
      await expect(authService.enableMFA(USER_ID)).rejects.toThrow(/migrações|migracoes|MFA ausentes/i);
    } finally {
      const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
      await db('migrations_executed').where('migration_name', '025_users_mfa_e_lockout').del();
      await runMigrationsIfNeeded(db);
    }
  }, 90000);
});
