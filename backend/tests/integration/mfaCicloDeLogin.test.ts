/**
 * O ciclo completo do MFA: ativar, sair, entrar de novo.
 *
 * Este arquivo existe porque eu cobri metade do caminho e disse que estava
 * pronto. Testei ATIVAR o MFA e não testei ENTRAR com ele ligado. O Flávio
 * ativou, saiu, e ficou trancado fora de uma produção com 19 empresas: a tela
 * de login mostrava "MFA verification required" em vermelho, sem campo para
 * digitar código nenhum.
 *
 * A causa: o login respondia HTTP 401 quando faltava o segundo fator. O axios
 * lança em 401, então a promessa rejeitava antes de o cliente ler o corpo, e a
 * etapa do código nunca era alcançada. E 401 é a resposta errada de qualquer
 * forma — significa "credencial inválida", e a senha estava correta.
 *
 * Havia ainda dois desencontros na segunda etapa: o cliente mandava o
 * tempToken no CORPO, e a rota o lê do cabeçalho Authorization; e o campo do
 * código chamava-se `totpToken`, nome que o controller não conhecia.
 *
 * O teste central é `CICLO COMPLETO`: ele atravessa ativação, logout e login
 * até receber o refreshToken — que é o que distingue sessão de verdade de
 * token temporário. Nenhum teste de etapa isolada pegaria isto.
 *
 * Precisa de BACKUP_TEST_DATABASE_URL.
 */

jest.mock('../../src/middleware/requestLogger', () => {
  const silencioso = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return {
    logger: silencioso,
    default: silencioso,
    requestLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
    getRequestMetricsSnapshot: () => ({}),
  };
});

import request from 'supertest';
import knex, { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import speakeasy from 'speakeasy';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

const SENHA = 'SenhaForte@2026';
const criados: string[] = [];

let db: Knex;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authService: any;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[mfaCicloDeLogin] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

/** Usuário novo, sem MFA. Um por teste: o authService cacheia em memória. */
async function novoUsuario(): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `ciclo-${id.slice(0, 8)}@teste.local`;
  criados.push(id);
  await db('users').insert({
    id, email,
    password_hash: await bcrypt.hash(SENHA, 10),
    full_name: 'Usuário Ciclo', role: 'admin', is_active: true,
  });
  return { id, email };
}

/** Ativa o MFA de ponta a ponta, como a tela de Configurações faz. */
async function ativarMfa(id: string, email: string): Promise<{
  secret: string; backupCodes: string[];
}> {
  const setup = await authService.enableMFA(id);
  const jwt = await import('jsonwebtoken');
  const tokenSessao = jwt.sign(
    { sub: id, email, role: 'admin' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h', algorithm: 'HS256' },
  );
  const r = await request(app)
    .post('/api/v1/auth/verify-mfa')
    .set('Authorization', `Bearer ${tokenSessao}`)
    .send({ code: speakeasy.totp({ secret: setup.secret, encoding: 'base32' }) });
  expect(r.status).toBe(200);
  return setup;
}

describeLive('MFA — o ciclo de login inteiro', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    jest.resetModules();
    jest.doMock('../../src/config/database', () => ({
      getDatabase: async () => db,
      initializeDatabase: async () => undefined,
    }));
    /* eslint-disable @typescript-eslint/no-var-requires */
    app = require('../../src/app').default;
    authService = require('../../src/services/authService').default;
    /* eslint-enable @typescript-eslint/no-var-requires */

    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);
  }, 300000);

  afterAll(async () => {
    if (db) {
      if (criados.length) await db('users').whereIn('id', criados).del();
      await db.destroy();
    }
  });

  it('sem MFA, o login devolve sessão completa', async () => {
    // Referência: é assim que a resposta se parece quando não há segundo fator.
    const u = await novoUsuario();
    const r = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: SENHA });

    expect(r.status).toBe(200);
    expect(r.body.data.refreshToken).toBeTruthy();
    expect(r.body.data.requiresMfa).toBeFalsy();
  }, 120000);

  it('COM MFA, o login responde 200 pedindo o segundo fator — não 401', async () => {
    // O defeito que trancou o Flávio fora do sistema. Com 401 o axios lança, a
    // promessa rejeita antes de qualquer leitura do corpo, e a tela do código
    // nunca aparece. E 401 diz "credencial inválida" para uma senha correta.
    const u = await novoUsuario();
    await ativarMfa(u.id, u.email);

    const r = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: SENHA });

    expect(r.status).toBe(200);
    expect(r.body.data.requiresMfa).toBe(true);
    expect(r.body.data.tempToken).toBeTruthy();
    // Token temporário, não sessão: sem refreshToken.
    expect(r.body.data.refreshToken).toBeFalsy();
  }, 120000);

  it('CICLO COMPLETO: ativa, sai, entra com senha e TOTP', async () => {
    const u = await novoUsuario();
    const setup = await ativarMfa(u.id, u.email);

    // Etapa 1 — senha.
    const etapa1 = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: SENHA });
    expect(etapa1.status).toBe(200);
    const tempToken = etapa1.body.data.tempToken;

    // Etapa 2 — código, com o tempToken no CABEÇALHO (a rota o lê de lá; no
    // corpo, o controller respondia 401 "MFA setup required").
    const etapa2 = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${tempToken}`)
      .send({ code: speakeasy.totp({ secret: setup.secret, encoding: 'base32' }) });

    expect(etapa2.status).toBe(200);
    // refreshToken é o que distingue sessão real de token temporário.
    expect(etapa2.body.data.refreshToken).toBeTruthy();
    expect(etapa2.body.data.user.email).toBe(u.email);
  }, 180000);

  it('CICLO COMPLETO com código de recuperação, para quem perdeu o celular', async () => {
    const u = await novoUsuario();
    const setup = await ativarMfa(u.id, u.email);

    const etapa1 = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: SENHA });
    const tempToken = etapa1.body.data.tempToken;

    const etapa2 = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${tempToken}`)
      .send({ code: setup.backupCodes[0] });

    expect(etapa2.status).toBe(200);
    expect(etapa2.body.data.refreshToken).toBeTruthy();
  }, 180000);

  it('aceita o campo com o nome que a tela de login usa (totpToken)', async () => {
    // A tela enviava { tempToken, totpToken }; o controller lia `code`.
    const u = await novoUsuario();
    const setup = await ativarMfa(u.id, u.email);

    const etapa1 = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: SENHA });

    const etapa2 = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${etapa1.body.data.tempToken}`)
      .send({ totpToken: speakeasy.totp({ secret: setup.secret, encoding: 'base32' }) });

    expect(etapa2.status).toBe(200);
  }, 180000);

  it('senha errada continua sendo 401, com MFA ligado', async () => {
    // A mudança para 200 vale só quando a senha está CERTA e falta o segundo
    // fator. Senha errada não pode virar 200 e vazar a existência do MFA.
    const u = await novoUsuario();
    await ativarMfa(u.id, u.email);

    const r = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: 'SenhaErrada@2026' });

    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.body?.data?.tempToken).toBeFalsy();
  }, 180000);

  it('o token temporário não abre as rotas protegidas sozinho', async () => {
    // Ele existe só para a segunda etapa. Se abrisse o sistema, o MFA seria
    // decorativo: bastaria parar no meio do login.
    const u = await novoUsuario();
    await ativarMfa(u.id, u.email);

    const etapa1 = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: SENHA });

    const r = await request(app).get('/api/v1/users')
      .set('Authorization', `Bearer ${etapa1.body.data.tempToken}`);

    expect(r.status).toBe(403);
  }, 180000);

  it('código errado na segunda etapa não libera sessão', async () => {
    const u = await novoUsuario();
    await ativarMfa(u.id, u.email);

    const etapa1 = await request(app).post('/api/v1/auth/login')
      .send({ email: u.email, password: SENHA });

    const etapa2 = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${etapa1.body.data.tempToken}`)
      .send({ code: '000000' });

    expect(etapa2.status).toBeGreaterThanOrEqual(400);
    expect(etapa2.body?.data?.refreshToken).toBeFalsy();
  }, 180000);
});
