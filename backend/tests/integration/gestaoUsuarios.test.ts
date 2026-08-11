/**
 * Gestão de usuários e isolamento entre carteiras — contra PostgreSQL real.
 *
 * O requisito: um usuário criado pelo admin enxerga as empresas que ELE criar,
 * mais as que o admin lhe atribuir. E mais nada.
 *
 * O que precisa ser provado não é que o endpoint responde 201 — é o NEGATIVO:
 * que o usuário B não alcança as empresas do A. Por consulta, por id direto, e
 * depois de ter o acesso revogado.
 *
 * Contra banco real porque isolamento é o que está GRAVADO em company_users
 * cruzado com o que a consulta filtra. Com mock, o teste provaria que chamei as
 * funções — não que a linha do outro usuário ficou fora do resultado.
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

const ADMIN_ID = '77777777-7777-4777-8777-777777777777';
const SENHA_OK = 'SenhaForte@2026';

let db: Knex;
let UserManagementService: typeof import('../../src/services/userManagementService').UserManagementService;
let CompanyService: typeof import('../../src/services/companyService').CompanyService;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[gestaoUsuarios] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

function carregarServicos() {
  jest.resetModules();
  jest.doMock('../../src/config/database', () => ({ getDatabase: async () => db }));
  jest.doMock('../../src/middleware/requestLogger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));
  /* eslint-disable @typescript-eslint/no-var-requires */
  UserManagementService = require('../../src/services/userManagementService').UserManagementService;
  CompanyService = require('../../src/services/companyService').CompanyService;
  /* eslint-enable @typescript-eslint/no-var-requires */
}

/** CNPJs com dígito verificador válido — o DTO valida antes de gravar. */
const CNPJ = {
  doAdmin:      '19131243000197',
  criadaPeloB:  '27865757000102',
  atribuidaAoB: '46952079000151',
};

async function limpar(): Promise<void> {
  await db('company_users').whereIn('company_id',
    db('companies').select('id').whereIn('cnpj', Object.values(CNPJ))).del();
  await db('companies').whereIn('cnpj', Object.values(CNPJ)).del();
  await db('users').whereIn('email', ['b@teste.local', 'c@teste.local']).del();
  await db('users').where('id', ADMIN_ID).del();
}

async function criarAdmin(): Promise<void> {
  const bcrypt = await import('bcrypt');
  await db('users').insert({
    id: ADMIN_ID,
    email: 'admin-gestao@teste.local',
    password_hash: await bcrypt.hash(SENHA_OK, 10),
    full_name: 'Admin de Teste',
    role: 'admin',
    is_active: true,
  });
}

describeLive('Gestão de usuários — criação e proteções', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);
  }, 300000);

  afterAll(async () => {
    if (db) { await limpar(); await db.destroy(); }
  });

  beforeEach(async () => {
    await limpar();
    await criarAdmin();
    carregarServicos();
  });

  it('cria o usuário com a senha em hash — nunca em texto claro', async () => {
    const criado = await UserManagementService.criar({
      email: 'B@Teste.Local', senha: SENHA_OK, nome_completo: 'Usuário B',
    }, ADMIN_ID);

    expect(criado.papel).toBe('accountant');
    expect(criado.ativo).toBe(true);
    // O e-mail vira minúsculo: senão "B@..." e "b@..." viram dois logins.
    expect(criado.email).toBe('b@teste.local');
    // Nada de segredo no retorno.
    expect(JSON.stringify(criado)).not.toContain(SENHA_OK);
    expect(criado).not.toHaveProperty('password_hash');

    const linha = await db('users').where('id', criado.id).first();
    expect(linha.password_hash).not.toBe(SENHA_OK);
    const bcrypt = await import('bcrypt');
    expect(await bcrypt.compare(SENHA_OK, linha.password_hash)).toBe(true);
  }, 120000);

  it('RECUSA criar admin sem confirmação explícita', async () => {
    // Admin enxerga a base inteira. Se isso acontecer por descuido, a tela não
    // denuncia: a listagem dele simplesmente vem completa.
    await expect(UserManagementService.criar({
      email: 'b@teste.local', senha: SENHA_OK, nome_completo: 'Usuário B', papel: 'admin',
    }, ADMIN_ID)).rejects.toThrow(/TODAS as empresas/i);

    expect(await db('users').where('email', 'b@teste.local').first()).toBeUndefined();
  }, 120000);

  it('cria admin quando a confirmação vem explícita', async () => {
    const criado = await UserManagementService.criar({
      email: 'c@teste.local', senha: SENHA_OK, nome_completo: 'Sócio',
      papel: 'admin', confirmar_acesso_total: true,
    }, ADMIN_ID);
    expect(criado.papel).toBe('admin');
  }, 120000);

  it('recusa e-mail repetido, mesmo com outra caixa', async () => {
    await UserManagementService.criar({
      email: 'b@teste.local', senha: SENHA_OK, nome_completo: 'Usuário B',
    }, ADMIN_ID);

    await expect(UserManagementService.criar({
      email: 'B@TESTE.LOCAL', senha: SENHA_OK, nome_completo: 'Outro',
    }, ADMIN_ID)).rejects.toThrow(/Já existe/i);

    const quantos = await db('users').whereRaw('LOWER(email) = ?', ['b@teste.local']).count<{ c: string }>({ c: '*' }).first();
    expect(Number(quantos?.c)).toBe(1);
  }, 120000);

  it('recusa senha curta e e-mail inválido', async () => {
    await expect(UserManagementService.criar({
      email: 'b@teste.local', senha: '123', nome_completo: 'Usuário B',
    }, ADMIN_ID)).rejects.toThrow(/8 caracteres/);

    await expect(UserManagementService.criar({
      email: 'sem-arroba', senha: SENHA_OK, nome_completo: 'Usuário B',
    }, ADMIN_ID)).rejects.toThrow(/E-mail inválido/);
  }, 120000);

  it('o admin não consegue se desativar nem se rebaixar', async () => {
    // Sendo o único admin, qualquer um dos dois o tranca fora do sistema, e não
    // sobra ninguém para desfazer pela interface.
    await expect(UserManagementService.definirAtivo(ADMIN_ID, false, ADMIN_ID))
      .rejects.toThrow(/própria conta/i);

    await expect(UserManagementService.definirPapel(ADMIN_ID, 'viewer', undefined, ADMIN_ID))
      .rejects.toThrow(/rebaixar a própria conta/i);

    const linha = await db('users').where('id', ADMIN_ID).first();
    expect(linha.is_active).toBe(true);
    expect(linha.role).toBe('admin');
  }, 120000);

  it('desativar outro usuário preserva os vínculos e o rastro', async () => {
    const b = await UserManagementService.criar({
      email: 'b@teste.local', senha: SENHA_OK, nome_completo: 'Usuário B',
    }, ADMIN_ID);
    const empresa = await CompanyService.create({
      cnpj: CNPJ.atribuidaAoB, name: 'Empresa Atribuida Ltda', tax_regime: 'simples_nacional',
    }, ADMIN_ID);
    await UserManagementService.atribuirEmpresa(b.id, empresa.id, ADMIN_ID);

    await UserManagementService.definirAtivo(b.id, false, ADMIN_ID);

    // O acesso morre, o histórico não: é o que responde "quem podia mexer
    // nesta empresa em março?" numa fiscalização.
    expect((await db('users').where('id', b.id).first()).is_active).toBe(false);
    const vinculo = await db('company_users')
      .where({ user_id: b.id, company_id: empresa.id }).first();
    expect(vinculo).toBeTruthy();
    expect(vinculo.is_active).toBe(true);
  }, 180000);
});

describeLive('Isolamento — o usuário vê só a carteira dele', () => {

  let idB: string;

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);
  }, 300000);

  afterAll(async () => {
    if (db) { await limpar(); await db.destroy(); }
  });

  beforeEach(async () => {
    await limpar();
    await criarAdmin();
    carregarServicos();

    const b = await UserManagementService.criar({
      email: 'b@teste.local', senha: SENHA_OK, nome_completo: 'Usuário B',
    }, ADMIN_ID);
    idB = b.id;

    // Empresa do admin: o usuário B nunca deve alcançá-la.
    await CompanyService.create({
      cnpj: CNPJ.doAdmin, name: 'Empresa Do Admin Ltda', tax_regime: 'lucro_presumido',
    }, ADMIN_ID);
  });

  it('não enxerga a empresa do admin ao listar', async () => {
    const lista = await CompanyService.list(undefined, idB, false);
    expect(lista.data.map((c: { cnpj: string }) => c.cnpj)).not.toContain(CNPJ.doAdmin);
    expect(lista.data).toHaveLength(0);
  }, 180000);

  it('não alcança a empresa do admin nem sabendo o id', async () => {
    // O caminho que a listagem filtrada não cobre: bater direto no id. Antes de
    // existir um segundo usuário, ninguém podia explorar isso.
    const doAdmin = await db('companies').where('cnpj', CNPJ.doAdmin).first();

    await expect(
      CompanyService.getById(doAdmin.id, undefined, idB, 'accountant'),
    ).rejects.toThrow(/Access denied/i);

    await expect(
      CompanyService.update(doAdmin.id, { name: 'Renomeada Por Invasor' }, idB, undefined, 'accountant'),
    ).rejects.toThrow(/Access denied/i);

    // E o nome continua o que era.
    expect((await db('companies').where('id', doAdmin.id).first()).legal_name)
      .toBe('Empresa Do Admin Ltda');
  }, 180000);

  it('ENXERGA a empresa que ele mesmo criou', async () => {
    const criada = await CompanyService.create({
      cnpj: CNPJ.criadaPeloB, name: 'Empresa Do B Ltda', tax_regime: 'simples_nacional',
    }, idB);

    const lista = await CompanyService.list(undefined, idB, false);
    expect(lista.data.map((c: { cnpj: string }) => c.cnpj)).toEqual([CNPJ.criadaPeloB]);

    // E consegue abrir e editar a dele.
    const aberta = await CompanyService.getById(criada.id, undefined, idB, 'accountant');
    expect(aberta.cnpj).toBe(CNPJ.criadaPeloB);
  }, 180000);

  it('ENXERGA a empresa que o admin atribuir', async () => {
    const empresa = await CompanyService.create({
      cnpj: CNPJ.atribuidaAoB, name: 'Empresa Atribuida Ltda', tax_regime: 'simples_nacional',
    }, ADMIN_ID);

    // Antes: fora do alcance.
    await expect(CompanyService.getById(empresa.id, undefined, idB, 'accountant'))
      .rejects.toThrow(/Access denied/i);

    await UserManagementService.atribuirEmpresa(idB, empresa.id, ADMIN_ID);

    // Depois: dentro.
    const lista = await CompanyService.list(undefined, idB, false);
    expect(lista.data.map((c: { cnpj: string }) => c.cnpj)).toContain(CNPJ.atribuidaAoB);
    expect((await CompanyService.getById(empresa.id, undefined, idB, 'accountant')).cnpj)
      .toBe(CNPJ.atribuidaAoB);
  }, 180000);

  it('PERDE o acesso quando o admin revoga', async () => {
    const empresa = await CompanyService.create({
      cnpj: CNPJ.atribuidaAoB, name: 'Empresa Atribuida Ltda', tax_regime: 'simples_nacional',
    }, ADMIN_ID);
    await UserManagementService.atribuirEmpresa(idB, empresa.id, ADMIN_ID);

    await UserManagementService.revogarEmpresa(idB, empresa.id, ADMIN_ID);

    expect((await CompanyService.list(undefined, idB, false)).data).toHaveLength(0);
    await expect(CompanyService.getById(empresa.id, undefined, idB, 'accountant'))
      .rejects.toThrow(/Access denied/i);

    // Revogar desativa o vínculo, não apaga: a data original diz desde quando
    // aquele usuário tinha acesso.
    const vinculo = await db('company_users')
      .where({ user_id: idB, company_id: empresa.id }).first();
    expect(vinculo).toBeTruthy();
    expect(vinculo.is_active).toBe(false);
  }, 180000);

  it('reatribuir reativa o vínculo em vez de duplicar', async () => {
    const empresa = await CompanyService.create({
      cnpj: CNPJ.atribuidaAoB, name: 'Empresa Atribuida Ltda', tax_regime: 'simples_nacional',
    }, ADMIN_ID);

    await UserManagementService.atribuirEmpresa(idB, empresa.id, ADMIN_ID);
    await UserManagementService.revogarEmpresa(idB, empresa.id, ADMIN_ID);
    await UserManagementService.atribuirEmpresa(idB, empresa.id, ADMIN_ID);

    const vinculos = await db('company_users').where({ user_id: idB, company_id: empresa.id });
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].is_active).toBe(true);
  }, 180000);

  it('a listagem de empresas do usuário reflete as duas origens', async () => {
    const atribuida = await CompanyService.create({
      cnpj: CNPJ.atribuidaAoB, name: 'Empresa Atribuida Ltda', tax_regime: 'simples_nacional',
    }, ADMIN_ID);
    await CompanyService.create({
      cnpj: CNPJ.criadaPeloB, name: 'Empresa Do B Ltda', tax_regime: 'simples_nacional',
    }, idB);
    await UserManagementService.atribuirEmpresa(idB, atribuida.id, ADMIN_ID);

    const empresas = await UserManagementService.empresasDoUsuario(idB);
    expect(empresas.map((e) => e.cnpj).sort())
      .toEqual([CNPJ.atribuidaAoB, CNPJ.criadaPeloB].sort());
  }, 180000);

  it('para o admin, a listagem mostra a base inteira', async () => {
    await CompanyService.create({
      cnpj: CNPJ.criadaPeloB, name: 'Empresa Do B Ltda', tax_regime: 'simples_nacional',
    }, idB);

    // Admin não tem vínculos em company_users e mesmo assim enxerga tudo:
    // listar só os vínculos dele devolveria vazio para quem vê a base inteira.
    const empresas = await UserManagementService.empresasDoUsuario(ADMIN_ID);
    const cnpjs = empresas.map((e) => e.cnpj);
    expect(cnpjs).toContain(CNPJ.doAdmin);
    expect(cnpjs).toContain(CNPJ.criadaPeloB);
  }, 180000);
});
