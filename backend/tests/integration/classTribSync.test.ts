/**
 * Sincronização e validação do cClassTrib — contra PostgreSQL real.
 *
 * A tabela de Classificação Tributária muda por ato normativo até 2032, nos
 * dois eixos: quais códigos existem e em que janela cada um vale. O que precisa
 * ser provado aqui não é "o parse funciona" (isso está no teste unitário), e sim
 * o comportamento da tabela ao longo do tempo:
 *
 *  - a validação usa a DATA DE EMISSÃO, não "hoje";
 *  - um sync que falha PRESERVA a tabela anterior em vez de esvaziá-la;
 *  - código que sai da origem é MARCADO, nunca apagado;
 *  - tabela vazia se identifica como tal, em vez de acusar o código do usuário.
 *
 * Com mock de banco nenhuma dessas propriedades seria provada: todas são sobre
 * o que fica gravado.
 *
 * Precisa de banco real: BACKUP_TEST_DATABASE_URL.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import fs from 'fs';
import path from 'path';
import knex, { Knex } from 'knex';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'svrs-classificacao-tributaria.html');
const HTML_REAL = fs.readFileSync(FIXTURE, 'utf8');

let db: Knex;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[classTribSync.integration] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

/** Instância nova dos serviços, apontando para o banco de teste. */
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

type GrupoCst = { ClassificacoesTributarias: Array<Record<string, unknown>> | null };

/**
 * Reescreve o fixture aplicando uma transformação nos dados.
 *
 * Usa o mesmo extrator balanceado da produção para achar os limites do array:
 * `lastIndexOf(']')` pegaria um colchete do epílogo da página.
 */
function reescreverFixture(transformar: (dados: GrupoCst[]) => void): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { extrairArrayJson } = require('../../src/services/classTribSyncService');
  const inicio = HTML_REAL.indexOf('[', HTML_REAL.indexOf('var dadosOriginais'));
  const bruto = extrairArrayJson(HTML_REAL, inicio);
  const dados = JSON.parse(bruto) as GrupoCst[];
  transformar(dados);
  return HTML_REAL.slice(0, inicio) + JSON.stringify(dados)
       + HTML_REAL.slice(inicio + bruto.length);
}

/** Recorta o fixture para conter apenas os N primeiros códigos. */
function fixtureCom(quantidade: number): string {
  return reescreverFixture((dados) => {
    let restam = quantidade;
    for (const cst of dados) {
      const filhas = cst.ClassificacoesTributarias ?? [];
      cst.ClassificacoesTributarias = filhas.slice(0, Math.max(0, restam));
      restam -= cst.ClassificacoesTributarias.length;
    }
  });
}

/** Fixture com o código informado removido da origem. */
function fixtureSem(codigo: string): string {
  return reescreverFixture((dados) => {
    for (const cst of dados) {
      cst.ClassificacoesTributarias = (cst.ClassificacoesTributarias ?? [])
        .filter((c) => c.CodClassTrib !== codigo);
    }
  });
}

/** Fixture com um campo alterado num código. */
function fixtureAlterando(codigo: string, campo: string, valor: unknown): string {
  return reescreverFixture((dados) => {
    for (const cst of dados) {
      for (const c of cst.ClassificacoesTributarias ?? []) {
        if (c.CodClassTrib === codigo) c[campo] = valor;
      }
    }
  });
}

async function contar(): Promise<number> {
  const linha = await db('fiscal_class_trib').count<{ count: string }>({ count: '*' }).first();
  return Number(linha?.count ?? 0);
}

describeLive('cClassTrib — sincronização com o SVRS', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');

    // Estado ANTES da correção: as tabelas não existem.
    await db.schema.dropTableIfExists('fiscal_class_trib');
    await db.schema.dropTableIfExists('fiscal_class_trib_sync');
    await db('migrations_executed').where('migration_name', '027_fiscal_class_trib').del();

    await runMigrationsIfNeeded(db);
  }, 300000);

  afterAll(async () => {
    if (db) await db.destroy();
  });

  beforeEach(async () => {
    await db('fiscal_class_trib').del();
    await db('fiscal_class_trib_sync').del();
  });

  it('a migração 027 cria a tabela com vigência e documentos', async () => {
    expect(await db.schema.hasTable('fiscal_class_trib')).toBe(true);
    for (const coluna of [
      'cod_class_trib', 'cst', 'nome', 'vigencia_inicio', 'vigencia_fim',
      'perc_red_ibs', 'perc_red_cbs', 'documentos', 'dados_brutos',
      'ausente_na_origem_desde', 'sincronizado_em',
    ]) {
      expect(await db.schema.hasColumn('fiscal_class_trib', coluna)).toBe(true);
    }
    expect(await db.schema.hasTable('fiscal_class_trib_sync')).toBe(true);
  });

  it('grava os 164 códigos com vigência e documentos', async () => {
    const { sync } = carregarServicos();
    const r = await sync.sincronizar({ html: HTML_REAL, lancarErro: true });

    expect(r.status).toBe('ok');
    expect(r.total_recebido).toBe(164);
    expect(r.inseridos).toBe(164);
    expect(await contar()).toBe(164);

    const linha = await db('fiscal_class_trib').where('cod_class_trib', '000001').first();
    expect(linha.cst).toBe('000');
    // text[] volta como array, não como string.
    expect(Array.isArray(linha.documentos)).toBe(true);
    expect(linha.documentos).toContain('NFE');
    expect(linha.dados_brutos.CodClassTrib).toBe('000001');
  }, 120000);

  it('rodar de novo não duplica nem altera nada', async () => {
    const { sync } = carregarServicos();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });
    const segundo = await sync.sincronizar({ html: HTML_REAL, lancarErro: true });

    expect(segundo.inseridos).toBe(0);
    expect(segundo.atualizados).toBe(0);
    expect(segundo.inalterados).toBe(164);
    expect(await contar()).toBe(164);
  }, 180000);

  it('detecta a alteração de um código publicada pelo SVRS', async () => {
    const { sync } = carregarServicos();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });

    // Cenário real: ato normativo encerra a vigência de um código.
    const alterado = fixtureAlterando('000001', 'DthFimVig', '2026-12-31T00:00:00');
    const r = await sync.sincronizar({ html: alterado, lancarErro: true });

    expect(r.atualizados).toBe(1);
    expect(r.inalterados).toBe(163);

    const linha = await db('fiscal_class_trib').where('cod_class_trib', '000001').first();
    const fim = linha.vigencia_fim instanceof Date
      ? linha.vigencia_fim.toISOString().slice(0, 10) : String(linha.vigencia_fim).slice(0, 10);
    expect(fim).toBe('2026-12-31');
  }, 180000);

  it('PRESERVA A TABELA quando a origem devolve menos que o piso', async () => {
    // O caso que justifica o piso: o SVRS muda a página e o parse passa a
    // enxergar poucos códigos. Gravar isso apagaria a validação de toda a
    // emissão. Tabela desatualizada é um problema; tabela vazia é uma parada.
    const { sync } = carregarServicos();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });
    expect(await contar()).toBe(164);

    const r = await sync.sincronizar({ html: fixtureCom(5) });

    expect(r.status).toBe('erro');
    expect(r.erro).toMatch(/piso/i);
    // Nada foi tocado.
    expect(await contar()).toBe(164);
  }, 180000);

  it('PRESERVA A TABELA quando a página muda de layout', async () => {
    const { sync } = carregarServicos();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });

    const r = await sync.sincronizar({ html: '<html><body>portal em manutenção</body></html>' });

    expect(r.status).toBe('erro');
    expect(await contar()).toBe(164);
  }, 180000);

  it('NÃO APAGA o código que sumiu da origem — marca a ausência', async () => {
    // Notas já emitidas referenciam o código. Sem a linha não há como
    // reconstituir a validação daquela emissão numa fiscalização.
    const { sync } = carregarServicos();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });

    await sync.sincronizar({ html: fixtureSem('000001'), lancarErro: true });

    const linha = await db('fiscal_class_trib').where('cod_class_trib', '000001').first();
    expect(linha).toBeTruthy();
    expect(linha.ausente_na_origem_desde).toBeTruthy();
    expect(await contar()).toBe(164);
  }, 180000);

  it('limpa a marca de ausência quando o código volta', async () => {
    const { sync } = carregarServicos();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });
    await sync.sincronizar({ html: fixtureSem('000001'), lancarErro: true });
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });

    const linha = await db('fiscal_class_trib').where('cod_class_trib', '000001').first();
    expect(linha.ausente_na_origem_desde).toBeNull();
  }, 240000);

  it('registra a tentativa que falhou, e não só as que deram certo', async () => {
    // Sem isto, "tabela estável" e "sync quebrado há três meses" têm a mesma
    // aparência para quem consulta.
    const { sync, consulta } = carregarServicos();
    await sync.sincronizar({ html: '<html>nada</html>' });

    const ultima = await consulta.ultimaSincronizacao();
    expect(ultima.status).toBe('erro');
    expect(ultima.erro).toBeTruthy();
    expect(ultima.concluido_em).toBeTruthy();
  }, 120000);

  it('a sincronização bem-sucedida fica registrada com os números', async () => {
    const { sync, consulta } = carregarServicos();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });

    const ultima = await consulta.ultimaSincronizacao();
    expect(ultima.status).toBe('ok');
    expect(ultima.total_recebido).toBe(164);
    expect(ultima.erro).toBeNull();
  }, 120000);
});

describeLive('cClassTrib — validação na emissão', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);

    const { sync } = carregarServicos();
    await db('fiscal_class_trib').del();
    await sync.sincronizar({ html: HTML_REAL, lancarErro: true });
  }, 300000);

  afterAll(async () => {
    if (db) await db.destroy();
  });

  it('aceita um código vigente para NF-e', async () => {
    const { consulta } = carregarServicos();
    const r = await consulta.validar({ codigo: '000001', data: '2026-08-10', documento: 'NFE' });
    expect(r.valido).toBe(true);
    expect(r.registro.cst).toBe('000');
  });

  it('RECUSA o código de incorporação imobiliária hoje — a vigência acabou', async () => {
    // 220001 valeu de 2025-05-05 a 2026-01-01 e não tem sucessor no CST 220.
    // É o caso que uma constante no código continuaria oferecendo.
    const { consulta } = carregarServicos();
    const r = await consulta.validar({ codigo: '220001', data: '2026-08-10' });

    expect(r.valido).toBe(false);
    expect(r.motivo).toBe('FORA_DE_VIGENCIA');
    expect(r.mensagem).toMatch(/encerrada em 2026-01-01/);
  });

  it('ACEITA o mesmo código numa emissão de 2025 — vale a data do fato gerador', async () => {
    // Uma nota de junho/2025 reemitida hoje tem de ser validada contra a tabela
    // de junho/2025. Validar contra "hoje" recusaria uma emissão legítima.
    const { consulta } = carregarServicos();
    const r = await consulta.validar({ codigo: '220001', data: '2025-06-01' });
    expect(r.valido).toBe(true);
  });

  it('recusa código antes do início da vigência', async () => {
    const { consulta } = carregarServicos();
    const r = await consulta.validar({ codigo: '220001', data: '2025-01-01' });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe('FORA_DE_VIGENCIA');
    expect(r.mensagem).toMatch(/só passa a vigorar/);
  });

  it('recusa em NF-e um código que só vale para outro documento', async () => {
    const { consulta } = carregarServicos();
    const soOutros = await db('fiscal_class_trib')
      .whereRaw("NOT ('NFE' = ANY (documentos))")
      .whereNull('vigencia_fim')
      .first();

    const r = await consulta.validar({
      codigo: soOutros.cod_class_trib, data: '2026-08-10', documento: 'NFE',
    });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe('DOCUMENTO_NAO_PERMITIDO');
    expect(r.mensagem).toMatch(/não é aceito em NFE/);
  });

  it('recusa código inexistente', async () => {
    const { consulta } = carregarServicos();
    const r = await consulta.validar({ codigo: '999999', data: '2026-08-10' });
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe('CODIGO_INEXISTENTE');
  });

  it('lista só os códigos válidos para NF-e', async () => {
    const { consulta } = carregarServicos();
    const nfe = await consulta.listarVigentes({ data: '2026-08-10', documento: 'NFE' });
    const todos = await consulta.listarVigentes({ data: '2026-08-10' });

    expect(nfe.length).toBeLessThan(todos.length);
    expect(nfe.every((c: { documentos: string[] }) => c.documentos.includes('NFE'))).toBe(true);
    // Os 3 encerrados não entram em nenhuma das listas de hoje.
    expect(todos.map((c: { cod_class_trib: string }) => c.cod_class_trib)).not.toContain('220001');
  });

  it('a lista de 2025 inclui os códigos que depois foram encerrados', async () => {
    const { consulta } = carregarServicos();
    const lista = await consulta.listarVigentes({ data: '2025-06-01' });
    expect(lista.map((c: { cod_class_trib: string }) => c.cod_class_trib)).toContain('220001');
  });

  it('as reduções voltam como número, não como string do Postgres', async () => {
    const { consulta } = carregarServicos();
    const reduzido = (await consulta.listarVigentes({ data: '2026-08-10' }))
      .find((c: { perc_red_ibs: number | null }) => (c.perc_red_ibs ?? 0) > 0);

    expect(typeof reduzido.perc_red_ibs).toBe('number');
    // numeric do Postgres chega como string no pg: '60' * 2 daria '6060'.
    expect(reduzido.perc_red_ibs).toBeGreaterThan(1);
    expect(reduzido.perc_red_ibs).toBeLessThanOrEqual(100);
  });
});

describeLive('cClassTrib — tabela vazia não é culpa do usuário', () => {

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

  it('diz que a tabela nunca foi sincronizada, em vez de acusar o código', async () => {
    // Os dois casos são indistinguíveis para quem consulta e a ação corretiva é
    // oposta: "código inexistente" manda conferir a legislação; o problema real
    // é de infraestrutura.
    const { consulta } = carregarServicos();
    const r = await consulta.validar({ codigo: '000001', data: '2026-08-10' });

    expect(r.valido).toBe(false);
    expect(r.motivo).toBe('TABELA_VAZIA');
    expect(r.mensagem).toMatch(/nunca foi sincronizada/i);
  });

  it('listar com a tabela vazia devolve lista vazia sem quebrar', async () => {
    const { consulta } = carregarServicos();
    expect(await consulta.listarVigentes({ documento: 'NFE' })).toEqual([]);
  });
});
