/**
 * As rotas de gestão de usuários só podem responder a admin.
 *
 * Os testes de gestaoUsuarios provam as regras do SERVIÇO. Este prova o portão:
 * que a requisição HTTP de um não-admin é barrada antes de chegar lá.
 *
 * A distinção importa. Quem pode criar usuário pode criar um admin para si
 * mesmo — um furo aqui não dá acesso a uma empresa, dá acesso a todas, com
 * persistência. E o furo seria invisível: nada na tela de um `viewer` indicaria
 * que o endpoint aceita a chamada dele.
 *
 * Bate na aplicação montada, com tokens reais assinados, em vez de conferir o
 * texto do arquivo de rotas: um `authorize('admin')` presente no fonte mas
 * registrado depois das rotas passaria numa checagem estática e não barraria
 * ninguém.
 */

/**
 * O mock precisa reexportar TUDO que o módulo real oferece, não só o logger:
 * este teste carrega o app inteiro, e app.ts também importa daqui o middleware
 * `requestLogger` e o `getRequestMetricsSnapshot`. Substituir o módulo só pelo
 * logger fazia o Express receber `undefined` em app.use() e derrubar a suíte
 * antes do primeiro teste.
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

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

const ADMIN_ID  = '88888888-8888-4888-8888-888888888888';
const COMUM_ID  = '99999999-9999-4999-8999-999999999999';

let db: Knex;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[gestaoUsuariosRotas] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

/** Token no mesmo formato que o authService emite. */
function token(userId: string, role: string, extras: Record<string, unknown> = {}): string {
  return jwt.sign(
    { userId, id: userId, email: `${role}@teste.local`, role, ...extras },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h', algorithm: 'HS256' },
  );
}

/** Todas as rotas do módulo, com o método de cada uma. */
const ROTAS: Array<[string, string]> = [
  ['post',   '/api/v1/users'],
  ['get',    '/api/v1/users'],
  ['patch',  `/api/v1/users/${COMUM_ID}/ativo`],
  ['patch',  `/api/v1/users/${COMUM_ID}/papel`],
  ['patch',  `/api/v1/users/${COMUM_ID}/senha`],
  ['get',    `/api/v1/users/${COMUM_ID}/empresas`],
  ['post',   `/api/v1/users/${COMUM_ID}/empresas`],
  ['delete', `/api/v1/users/${COMUM_ID}/empresas/${ADMIN_ID}`],
];

describeLive('Rotas de gestão de usuários — só admin passa', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    jest.resetModules();
    jest.doMock('../../src/config/database', () => ({
      getDatabase: async () => db,
      initializeDatabase: async () => undefined,
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    app = require('../../src/app').default;

    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);

    for (const [id, role, email] of [
      [ADMIN_ID, 'admin', 'admin-rotas@teste.local'],
      [COMUM_ID, 'accountant', 'comum-rotas@teste.local'],
    ] as const) {
      await db('users').where('id', id).del();
      await db('users').insert({
        id, email, password_hash: await bcrypt.hash('SenhaForte@2026', 10),
        full_name: `Usuário ${role}`, role, is_active: true,
      });
    }
  }, 300000);

  afterAll(async () => {
    if (db) {
      await db('users').whereIn('id', [ADMIN_ID, COMUM_ID]).del();
      await db.destroy();
    }
  });

  it.each(ROTAS)('%s %s exige autenticação', async (metodo, rota) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resposta = await (request(app) as any)[metodo](rota).send({});
    expect(resposta.status).toBe(401);
  }, 60000);

  it.each(ROTAS)('%s %s recusa usuário comum com 403', async (metodo, rota) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resposta = await (request(app) as any)[metodo](rota)
      .set('Authorization', `Bearer ${token(COMUM_ID, 'accountant')}`)
      .send({ email: 'x@y.com', senha: 'SenhaForte@2026', nome_completo: 'Invasor' });

    expect(resposta.status).toBe(403);
  }, 60000);

  it.each(['viewer', 'manager', 'auditor', 'accountant'])(
    'papel %s não cria usuário', async (papel) => {
      const resposta = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token(COMUM_ID, papel)}`)
        .send({ email: 'escalada@teste.local', senha: 'SenhaForte@2026', nome_completo: 'Escalada' });

      expect(resposta.status).toBe(403);
      // O que importa não é o status: é não ter criado o usuário.
      expect(await db('users').where('email', 'escalada@teste.local').first()).toBeUndefined();
    }, 60000);

  it('token parado no meio do MFA não passa', async () => {
    // Quem autenticou a senha mas não completou o segundo fator carrega
    // mfaRequired. Aceitar esse token aqui anularia o MFA justamente na tela
    // que concede acesso.
    const resposta = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token(ADMIN_ID, 'admin', { mfaRequired: true })}`);

    expect(resposta.status).toBe(403);
  }, 60000);

  it('admin lista os usuários', async () => {
    const resposta = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token(ADMIN_ID, 'admin')}`);

    expect(resposta.status).toBe(200);
    expect(Array.isArray(resposta.body.data)).toBe(true);
    const emails = resposta.body.data.map((u: { email: string }) => u.email);
    expect(emails).toContain('admin-rotas@teste.local');

    // Nenhum segredo no corpo da resposta.
    const corpo = JSON.stringify(resposta.body);
    expect(corpo).not.toMatch(/password_hash|mfa_secret|backup_codes/);
  }, 60000);

  it('admin cria usuário pela rota, e a senha não volta na resposta', async () => {
    await db('users').where('email', 'criado-pela-rota@teste.local').del();
    try {
      const resposta = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token(ADMIN_ID, 'admin')}`)
        .send({
          email: 'criado-pela-rota@teste.local',
          senha: 'SenhaForte@2026',
          nome_completo: 'Criado Pela Rota',
        });

      expect(resposta.status).toBe(201);
      expect(resposta.body.data.papel).toBe('accountant');
      expect(JSON.stringify(resposta.body)).not.toContain('SenhaForte@2026');
    } finally {
      await db('users').where('email', 'criado-pela-rota@teste.local').del();
    }
  }, 60000);

  it('a recusa de admin sem confirmação chega como 422, não como 500', async () => {
    const resposta = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token(ADMIN_ID, 'admin')}`)
      .send({
        email: 'admin-acidental@teste.local',
        senha: 'SenhaForte@2026',
        nome_completo: 'Admin Acidental',
        papel: 'admin',
      });

    // 422 e mensagem explicativa: quem está na tela precisa entender por que
    // foi recusado e o que fazer, senão tenta de novo até dar certo do jeito
    // errado.
    expect(resposta.status).toBe(422);
    expect(resposta.body.message).toMatch(/TODAS as empresas/i);
    expect(await db('users').where('email', 'admin-acidental@teste.local').first())
      .toBeUndefined();
  }, 60000);
});
