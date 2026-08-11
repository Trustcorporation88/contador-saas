/**
 * O endpoint de verificação de MFA, batendo via HTTP.
 *
 * Este arquivo existe por causa de uma falha minha. O PR anterior ensinou o
 * SERVIÇO a aceitar código de recuperação e provou isso com nove testes — que
 * chamavam o serviço direto. Só que o controller tinha o próprio guard,
 * `/^\d{6}$/`, e barrava os códigos de 8 caracteres ANTES de chegar lá. A
 * correção existia e era inalcançável por HTTP.
 *
 * E havia um segundo desencontro no mesmo caminho: a tela enviava `{ token }`,
 * o controller lia `code`. A resposta era 400 "MFA code is required" e a
 * ativação nunca concluía — desde sempre.
 *
 * Os dois defeitos passariam por qualquer teste de serviço. Só aparecem
 * atravessando a pilha inteira, que é o que este arquivo faz.
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
import jwt from 'jsonwebtoken';
import knex, { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import speakeasy from 'speakeasy';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

const criados: string[] = [];

let db: Knex;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authService: any;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[mfaRotaVerificacao] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

function token(userId: string, email: string): string {
  return jwt.sign(
    // `sub` é a claim que o middleware lê para montar req.user.id. Com userId
    // ou id o token autentica, mas req.user.id fica undefined e o serviço
    // consulta o banco com binding vazio — 500 em vez de resposta.
    { sub: userId, userId, id: userId, email, role: 'admin' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h', algorithm: 'HS256' },
  );
}

/**
 * Cria um usuário novo e já com MFA iniciado.
 *
 * Um usuário por teste porque o authService mantém um Map em memória: reusar o
 * mesmo id faz o segundo enableMFA falhar com "MFA is already enabled", e o
 * teste quebraria por contaminação, não por defeito do código.
 */
async function usuarioComSetup(): Promise<{
  id: string; email: string; secret: string; backupCodes: string[];
}> {
  const id = randomUUID();
  const email = `mfa-${id.slice(0, 8)}@teste.local`;
  criados.push(id);

  await db('users').insert({
    id, email,
    password_hash: await bcrypt.hash('SenhaForte@2026', 10),
    full_name: 'Usuário MFA Rota', role: 'admin', is_active: true,
  });

  const setup = await authService.enableMFA(id);
  return { id, email, secret: setup.secret, backupCodes: setup.backupCodes };
}

describeLive('POST /auth/verify-mfa — pela pilha inteira', () => {

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

  it('enable-mfa devolve o QR como IMAGEM, mais a URI e os dez códigos', async () => {
    // Dois defeitos aqui. O campo qrCode vinha com a URI otpauth:// crua, e a
    // tela faz <img src={qrCode}>: nenhum navegador renderiza otpauth:// como
    // imagem, então aparecia ícone quebrado. E o corpo é { data: {...} }, mas a
    // tela lia res.data.qrCode — undefined, tela em branco, sem botão e sem
    // volta.
    const id = randomUUID();
    const email = `enable-${id.slice(0, 8)}@teste.local`;
    criados.push(id);
    await db('users').insert({
      id, email, password_hash: await bcrypt.hash('SenhaForte@2026', 10),
      full_name: 'Enable MFA', role: 'admin', is_active: true,
    });

    const r = await request(app)
      .post('/api/v1/auth/enable-mfa')
      .set('Authorization', `Bearer ${token(id, email)}`);

    expect(r.status).toBe(200);
    expect(r.body.data.qrCode).toMatch(/^data:image\//);
    expect(r.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(r.body.data.secret).toBeTruthy();
    expect(r.body.data.backupCodes).toHaveLength(10);
  }, 120000);

  it('aceita o TOTP no campo `code`', async () => {
    const u = await usuarioComSetup();
    const r = await request(app)
      .post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${token(u.id, u.email)}`)
      .send({ code: speakeasy.totp({ secret: u.secret, encoding: 'base32' }) });

    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBeTruthy();
  }, 120000);

  it('aceita também no campo `token`, que é o que a tela enviava', async () => {
    // Era o motivo de a ativação responder 400 sem nunca chegar ao serviço.
    const u = await usuarioComSetup();
    const r = await request(app)
      .post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${token(u.id, u.email)}`)
      .send({ token: speakeasy.totp({ secret: u.secret, encoding: 'base32' }) });

    expect(r.status).toBe(200);
  }, 120000);

  it('O CÓDIGO DE RECUPERAÇÃO PASSA PELO ENDPOINT', async () => {
    // O teste que faltava no PR anterior. O serviço já aceitava; o controller
    // barrava antes, exigindo 6 dígitos. Só isto prova que a recuperação
    // funciona de verdade, e não apenas uma camada abaixo.
    const u = await usuarioComSetup();
    const r = await request(app)
      .post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${token(u.id, u.email)}`)
      .send({ code: u.backupCodes[0] });

    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBeTruthy();
  }, 120000);

  it('o código de recuperação se gasta também pelo endpoint', async () => {
    const u = await usuarioComSetup();
    const codigo = u.backupCodes[1];
    const auth = `Bearer ${token(u.id, u.email)}`;

    const primeira = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', auth).send({ code: codigo });
    expect(primeira.status).toBe(200);

    const segunda = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', auth).send({ code: codigo });
    expect(segunda.status).toBeGreaterThanOrEqual(400);
  }, 120000);

  it('aceita o código digitado com espaço e em minúsculas', async () => {
    const u = await usuarioComSetup();
    const c = u.backupCodes[2];

    const r = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${token(u.id, u.email)}`)
      .send({ code: `${c.slice(0, 4).toLowerCase()} ${c.slice(4).toLowerCase()}` });

    expect(r.status).toBe(200);
  }, 120000);

  it('recusa formato que não é nem TOTP nem código de recuperação', async () => {
    const u = await usuarioComSetup();
    const auth = `Bearer ${token(u.id, u.email)}`;
    for (const invalido of ['123', 'ZZZZZZZZ', '12345', '']) {
      const r = await request(app).post('/api/v1/auth/verify-mfa')
        .set('Authorization', auth).send({ code: invalido });
      expect(r.status).toBe(400);
    }
  }, 120000);

  it('recusa código de recuperação inventado, sem gastar os verdadeiros', async () => {
    const u = await usuarioComSetup();
    const r = await request(app).post('/api/v1/auth/verify-mfa')
      .set('Authorization', `Bearer ${token(u.id, u.email)}`)
      .send({ code: 'DEADBEEF' });

    expect(r.status).toBeGreaterThanOrEqual(400);
    const linha = await db('users').where('id', u.id).first();
    expect(JSON.parse(String(linha.backup_codes))).toHaveLength(10);
  }, 120000);

  it('sem autenticação, não responde', async () => {
    const r = await request(app).post('/api/v1/auth/verify-mfa').send({ code: '123456' });
    expect(r.status).toBe(401);
  }, 60000);
});
