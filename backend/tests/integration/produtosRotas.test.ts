/**
 * Teste de integração: rotas do catálogo de produtos contra um PostgreSQL real.
 *
 * Bate na aplicação montada (auth + multi-tenant + rotas) com tokens reais,
 * porque o que interessa aqui é a fiação: rota registrada em companies.ts,
 * "/buscar" declarada antes de "/:id", middleware de tenant aceitando o
 * companyId do path, e o isolamento entre empresas.
 *
 * Precisa de um banco real. Defina BACKUP_TEST_DATABASE_URL para rodar
 * (mesma convenção dos outros testes de integração):
 *   BACKUP_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/db npx jest tests/integration/produtosRotas
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

const ADMIN_ID = '77777777-7777-4777-8777-777777777777';

let db: Knex;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let empresaA = '';
let empresaB = '';

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[produtosRotas] BACKUP_TEST_DATABASE_URL não definida, teste pulado.');
}

function token(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, userId, id: userId, email: `${role}@teste.local`, role },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h', algorithm: 'HS256' },
  );
}

const auth = () => ({ Authorization: `Bearer ${token(ADMIN_ID, 'admin')}` });
const base = (companyId: string) => `/api/v1/companies/${companyId}/produtos`;

describeLive('Rotas /companies/:companyId/produtos', () => {

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

    await db('users').where('id', ADMIN_ID).del();
    await db('users').insert({
      id: ADMIN_ID, email: 'admin-produtos@teste.local',
      password_hash: await bcrypt.hash('SenhaForte@2026', 10),
      full_name: 'Admin Produtos', role: 'admin', is_active: true,
    });

    // CNPJs próprios deste teste; limpa sobras de execuções interrompidas.
    const CNPJ_A = '99887766000155', CNPJ_B = '99887766000236';
    const sobras = await db('companies').whereIn('cnpj', [CNPJ_A, CNPJ_B]).select('id');
    if (sobras.length) {
      await db('produtos').whereIn('company_id', sobras.map((c) => c.id)).del();
      await db('companies').whereIn('cnpj', [CNPJ_A, CNPJ_B]).del();
    }
    const [a] = await db('companies').insert({ name: 'Empresa A Produtos', cnpj: CNPJ_A, tax_regime: 'SIMPLE_NATIONAL' }).returning('id');
    const [b] = await db('companies').insert({ name: 'Empresa B Produtos', cnpj: CNPJ_B, tax_regime: 'PRESUMED_PROFIT' }).returning('id');
    empresaA = a.id; empresaB = b.id;
  }, 300000);

  afterAll(async () => {
    if (db) {
      await db('produtos').whereIn('company_id', [empresaA, empresaB]).del();
      await db('companies').whereIn('id', [empresaA, empresaB]).del();
      await db('users').where('id', ADMIN_ID).del();
      await db.destroy();
    }
  });

  it('exige autenticação', async () => {
    const r = await request(app).get(`${base(empresaA)}/buscar?q=x`);
    expect(r.status).toBe(401);
  }, 60000);

  it('cadastra, lista, busca, edita e remove', async () => {
    const criado = await request(app).post(base(empresaA)).set(auth()).send({
      codigo: 'FLT-01', descricao: 'Filtro de água', ncm: '8421.23.00', cfop: '5102',
      unidade: 'un', valor_unitario: 49.9, cst_icms: '102', aliquota_icms: 0,
    });
    expect(criado.status).toBe(201);
    expect(criado.body).toMatchObject({ chave: 'COD:FLT-01', ncm: '84212300', unidade: 'UN', cst_icms: '102' });

    const semCodigo = await request(app).post(base(empresaA)).set(auth()).send({
      descricao: 'Cabo HDMI 2m', ncm: '85444200', cfop: '5102', valor_unitario: 25,
    });
    expect(semCodigo.status).toBe(201);
    expect(semCodigo.body.chave).toBe('DESC:CABO HDMI 2M');

    const duplicado = await request(app).post(base(empresaA)).set(auth()).send({ codigo: 'flt-01', descricao: 'Outro' });
    expect(duplicado.status).toBe(409);

    const invalido = await request(app).post(base(empresaA)).set(auth()).send({ descricao: 'X', ncm: '123' });
    expect(invalido.status).toBe(400);
    expect(invalido.body.error).toMatch(/NCM/);

    const lista = await request(app).get(base(empresaA)).set(auth());
    expect(lista.status).toBe(200);
    expect(lista.body.total).toBe(2);

    // "/buscar" precisa ser rota própria e não cair em "/:id".
    const busca = await request(app).get(`${base(empresaA)}/buscar?q=filtro agua`).set(auth());
    expect(busca.status).toBe(200);
    expect(busca.body.data).toHaveLength(1);
    expect(busca.body.data[0].codigo).toBe('FLT-01');

    const porNcm = await request(app).get(`${base(empresaA)}/buscar?q=8544`).set(auth());
    expect(porNcm.body.data.map((p: { chave: string }) => p.chave)).toEqual(['DESC:CABO HDMI 2M']);

    const editado = await request(app).put(`${base(empresaA)}/${criado.body.id}`).set(auth()).send({
      codigo: 'FLT-01', descricao: 'Filtro de água 10"', ncm: '84212300', cfop: '5102', valor_unitario: 55,
    });
    expect(editado.status).toBe(200);
    expect(editado.body.descricao).toBe('Filtro de água 10"');
    expect(Number(editado.body.valor_unitario)).toBe(55);

    const removido = await request(app).delete(`${base(empresaA)}/${criado.body.id}`).set(auth());
    expect(removido.status).toBe(204);
    const depois = await request(app).get(`${base(empresaA)}/${criado.body.id}`).set(auth());
    expect(depois.status).toBe(404);
  }, 60000);

  it('não vaza produtos entre empresas', async () => {
    await request(app).post(base(empresaB)).set(auth()).send({ codigo: 'SO-B', descricao: 'Produto da empresa B' });
    const emA = await request(app).get(`${base(empresaA)}/buscar?q=empresa B`).set(auth());
    expect(emA.body.data).toHaveLength(0);
    const emB = await request(app).get(`${base(empresaB)}/buscar?q=empresa B`).set(auth());
    expect(emB.body.data).toHaveLength(1);
  }, 60000);

  it('busca vazia devolve os mais emitidos primeiro', async () => {
    await db('produtos').where({ company_id: empresaB, chave: 'COD:SO-B' }).update({ vezes_emitido: 7 });
    await request(app).post(base(empresaB)).set(auth()).send({ codigo: 'ZZ', descricao: 'Nunca emitido' });
    const r = await request(app).get(`${base(empresaB)}/buscar`).set(auth());
    expect(r.body.data.map((p: { codigo: string }) => p.codigo)).toEqual(['SO-B', 'ZZ']);
  }, 60000);
});
