/**
 * Emitir NF-e com IPI — as colunas precisam existir.
 *
 * O defeito, encontrado na PRIMEIRA emissão real (12/08/2026): o IPI foi
 * implementado na geração do XML e no total da nota, e as colunas
 * cst_ipi/aliquota_ipi/valor_ipi/codigo_enquadramento_ipi nunca existiram em
 * nfe_itens. O INSERT estourava:
 *
 *   column "aliquota_ipi" of relation "nfe_itens" does not exist
 *
 * A emissão inteira respondia 500 — "Erro interno ao processar a requisição".
 * Não apareceu antes porque nenhuma nota havia sido emitida: era a primeira
 * tentativa de verdade.
 *
 * Pior que a coluna faltar: havia um comentário no código AFIRMANDO que elas
 * "existiam desde a criação da tabela". Escrito sem verificar. A tabela
 * itens_documentos_fiscais — outra — tem colunas de IPI, o que provavelmente
 * originou a confusão.
 *
 * Estes testes vão ao banco porque o defeito era do SCHEMA. Nenhum teste com
 * mock de Knex pegaria: o mock aceita qualquer coluna.
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

let db: Knex;

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn('[nfeItensIpi] BACKUP_TEST_DATABASE_URL não definida — pulado.');
}

/** Colunas de IPI que o INSERT de nfe_itens escreve. */
const COLUNAS_IPI = [
  'cst_ipi',
  'aliquota_ipi',
  'valor_ipi',
  'codigo_enquadramento_ipi',
] as const;

describeLive('nfe_itens — colunas de IPI', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');

    // Estado ANTES da correção: tabela existente e sem as colunas de IPI.
    if (await db.schema.hasTable('nfe_itens')) {
      for (const coluna of COLUNAS_IPI) {
        await db.raw(`ALTER TABLE nfe_itens DROP COLUMN IF EXISTS ${coluna}`);
      }
    }
    await db('migrations_executed').where('migration_name', '028_nfe_itens_ipi').del();

    await runMigrationsIfNeeded(db);
  }, 300000);

  afterAll(async () => {
    if (db) await db.destroy();
  });

  it('a migração 028 cria as quatro colunas', async () => {
    for (const coluna of COLUNAS_IPI) {
      expect(await db.schema.hasColumn('nfe_itens', coluna)).toBe(true);
    }
  }, 60000);

  it('O INSERT COM IPI FUNCIONA — era ele que derrubava a emissão', async () => {
    // Reproduz exatamente o payload do nfeService, com os mesmos nomes de
    // coluna. É o INSERT que respondia 500 na primeira nota emitida.
    const nfeId = (await db('nfe').insert({
      company_id: '00000000-0000-4000-8000-000000000001',
      numero: 999999,
      serie: 1,
      chave_acesso: '9'.repeat(44),
      ambiente: 'homologacao',
      status: 'rascunho',
      data_emissao: new Date(),
      valor_total: 121.0,
      // NOT NULL sem default na tabela nfe.
      emit_cnpj: '60526634000104',
      emit_razao_social: 'Emitente de Teste',
      dest_cpf_cnpj: '12345678000199',
      dest_razao_social: 'Destinatário de Teste',
    }).returning('id'))[0];

    const id = typeof nfeId === 'object' ? (nfeId as { id: string }).id : nfeId;

    try {
      await db('nfe_itens').insert({
        nfe_id: id,
        numero_item: 1,
        codigo_produto: 'PROD-1',
        descricao: 'Produto com IPI',
        ncm: '22030000',
        cfop: '5101',
        unidade: 'UN',
        quantidade: 1,
        valor_unitario: 100,
        valor_total: 100,
        aliquota_icms: 18,
        valor_icms: 18,
        aliquota_pis: 0.65,
        valor_pis: 0.65,
        aliquota_cofins: 3,
        valor_cofins: 3,
        // Os quatro campos que não tinham coluna.
        cst_ipi: '50',
        aliquota_ipi: 21,
        valor_ipi: 21,
        codigo_enquadramento_ipi: '999',
      });

      const item = await db('nfe_itens').where({ nfe_id: id, numero_item: 1 }).first();

      expect(item.cst_ipi).toBe('50');
      expect(Number(item.aliquota_ipi)).toBe(21);
      expect(Number(item.valor_ipi)).toBe(21);
      expect(item.codigo_enquadramento_ipi).toBe('999');
    } finally {
      await db('nfe_itens').where('nfe_id', id).del();
      await db('nfe').where('id', id).del();
    }
  }, 120000);

  it('item sem IPI grava nulo no CST, não zero', async () => {
    // Quem não é contribuinte de IPI não destaca o imposto, e a AUSÊNCIA do
    // grupo na nota é o correto. CST '00' significaria "tributado à alíquota
    // zero", que é outra coisa e apareceria no XML.
    const nfeId = (await db('nfe').insert({
      company_id: '00000000-0000-4000-8000-000000000001',
      numero: 999998,
      serie: 1,
      chave_acesso: '8'.repeat(44),
      ambiente: 'homologacao',
      status: 'rascunho',
      data_emissao: new Date(),
      valor_total: 100.0,
      // NOT NULL sem default na tabela nfe.
      emit_cnpj: '60526634000104',
      emit_razao_social: 'Emitente de Teste',
      dest_cpf_cnpj: '12345678000199',
      dest_razao_social: 'Destinatário de Teste',
    }).returning('id'))[0];
    const id = typeof nfeId === 'object' ? (nfeId as { id: string }).id : nfeId;

    try {
      await db('nfe_itens').insert({
        nfe_id: id,
        numero_item: 1,
        codigo_produto: 'PROD-2',
        descricao: 'Produto sem IPI',
        ncm: '00000000',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 1,
        valor_unitario: 100,
        valor_total: 100,
        cst_ipi: null,
        aliquota_ipi: 0,
        valor_ipi: 0,
        codigo_enquadramento_ipi: null,
      });

      const item = await db('nfe_itens').where({ nfe_id: id, numero_item: 1 }).first();
      expect(item.cst_ipi).toBeNull();
      expect(Number(item.valor_ipi)).toBe(0);
    } finally {
      await db('nfe_itens').where('nfe_id', id).del();
      await db('nfe').where('id', id).del();
    }
  }, 120000);

  it('a alíquota aceita casa decimal', async () => {
    // IPI de 4,5% existe. decimal(7,4) guarda; um integer truncaria para 4 e o
    // imposto sairia errado na nota.
    const nfeId = (await db('nfe').insert({
      company_id: '00000000-0000-4000-8000-000000000001',
      numero: 999997,
      serie: 1,
      chave_acesso: '7'.repeat(44),
      ambiente: 'homologacao',
      status: 'rascunho',
      data_emissao: new Date(),
      valor_total: 104.5,
      // NOT NULL sem default na tabela nfe.
      emit_cnpj: '60526634000104',
      emit_razao_social: 'Emitente de Teste',
      dest_cpf_cnpj: '12345678000199',
      dest_razao_social: 'Destinatário de Teste',
    }).returning('id'))[0];
    const id = typeof nfeId === 'object' ? (nfeId as { id: string }).id : nfeId;

    try {
      await db('nfe_itens').insert({
        nfe_id: id, numero_item: 1, codigo_produto: 'P', descricao: 'IPI fracionado',
        ncm: '84713012', cfop: '5101', unidade: 'UN',
        quantidade: 1, valor_unitario: 100, valor_total: 100,
        cst_ipi: '50', aliquota_ipi: 4.5, valor_ipi: 4.5,
        codigo_enquadramento_ipi: '999',
      });

      const item = await db('nfe_itens').where({ nfe_id: id, numero_item: 1 }).first();
      expect(Number(item.aliquota_ipi)).toBeCloseTo(4.5, 4);
    } finally {
      await db('nfe_itens').where('nfe_id', id).del();
      await db('nfe').where('id', id).del();
    }
  }, 120000);
});
