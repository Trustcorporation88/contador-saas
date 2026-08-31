/**
 * Testes unitários: ProdutoService (catálogo de produtos da emissão de NF-e)
 *
 * Cobre a regra de identidade do produto (chave), a normalização dos campos
 * fiscais, a deduplicação dentro de uma mesma nota (limite do ON CONFLICT do
 * Postgres) e o formato das queries de busca e de upsert.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const registro = {
  where: [] as unknown[],
  ilike: [] as Array<[string, string]>,
  inseridos: [] as unknown[],
  conflito: null as unknown,
  merge: null as Record<string, unknown> | null,
  orderBy: null as unknown,
  limit: null as number | null,
};

jest.mock('../../src/config/database', () => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    where: jest.fn((c: unknown) => {
      registro.where.push(c);
      return builder;
    }),
    whereILike: jest.fn((col: string, val: string) => {
      registro.ilike.push([col, val]);
      return builder;
    }),
    orderBy: jest.fn((o: unknown) => {
      registro.orderBy = o;
      return builder;
    }),
    limit: jest.fn((n: number) => {
      registro.limit = n;
      return builder;
    }),
    select: jest.fn().mockResolvedValue([{ id: 'p1' }]),
    insert: jest.fn((linhas: unknown) => {
      registro.inseridos = linhas as unknown[];
      return builder;
    }),
    onConflict: jest.fn((cols: unknown) => {
      registro.conflito = cols;
      return builder;
    }),
    merge: jest.fn((m: Record<string, unknown>) => {
      registro.merge = m;
      return Promise.resolve();
    }),
  });
  const db: any = jest.fn(() => builder);
  Object.assign(db, builder, {
    raw: jest.fn((sql: string) => ({ sql })),
    fn: { now: jest.fn(() => 'NOW()') },
  });
  return { db, getDatabase: jest.fn().mockResolvedValue(db) };
});

import {
  ProdutoService,
  chaveDoProduto,
  normalizarProduto,
  deduplicarPorChave,
  textoDeBusca,
} from '../../src/services/produtoService';

beforeEach(() => {
  registro.where = [];
  registro.ilike = [];
  registro.inseridos = [];
  registro.conflito = null;
  registro.merge = null;
  registro.orderBy = null;
  registro.limit = null;
});

describe('chaveDoProduto', () => {
  it('usa o código quando informado, em caixa alta', () => {
    expect(chaveDoProduto(' abc-1 ', 'Qualquer coisa')).toBe('COD:ABC-1');
  });

  it('sem código cai na descrição normalizada (espaços colapsados, caixa alta)', () => {
    expect(chaveDoProduto('', '  Cabo   hdmi  2m ')).toBe('DESC:CABO HDMI 2M');
    expect(chaveDoProduto(undefined, 'cabo hdmi 2m')).toBe('DESC:CABO HDMI 2M');
  });

  it('o mesmo produto com e sem código tem chaves diferentes (o código manda)', () => {
    expect(chaveDoProduto('X1', 'Parafuso')).not.toBe(chaveDoProduto('', 'Parafuso'));
  });
});

describe('textoDeBusca', () => {
  it('junta código, descrição e NCM em minúsculas e sem acento', () => {
    expect(textoDeBusca('FLT-01', 'Filtro de Água  Ção', '84212300')).toBe('flt-01 filtro de agua cao 84212300');
  });

  it('ignora partes vazias', () => {
    expect(textoDeBusca(null, 'Cabo', undefined)).toBe('cabo');
  });
});

describe('normalizarProduto', () => {
  it('mantém só dígitos em NCM/CFOP/CST e converte alíquotas em número', () => {
    const p = normalizarProduto({
      codigo_produto: 'P-10',
      descricao: 'Filtro  de  água',
      ncm: '8421.23.00',
      cfop: '5.102',
      unidade: 'un',
      valor_unitario: '19.9' as unknown as number,
      cst_icms: '102',
      aliquota_icms: undefined,
    });
    expect(p).toMatchObject({
      chave: 'COD:P-10',
      codigo: 'P-10',
      descricao: 'Filtro de água',
      busca: 'p-10 filtro de agua 84212300',
      ncm: '84212300',
      cfop: '5102',
      unidade: 'UN',
      valor_unitario: 19.9,
      cst_icms: '102',
      aliquota_icms: 0,
    });
  });

  it('campos vazios viram null, não string vazia', () => {
    const p = normalizarProduto({ descricao: 'Item', ncm: '', cfop: undefined });
    expect(p.codigo).toBeNull();
    expect(p.ncm).toBeNull();
    expect(p.cfop).toBeNull();
    expect(p.cst_icms).toBeNull();
  });
});

describe('deduplicarPorChave', () => {
  it('mantém a última ocorrência de cada chave', () => {
    const r = deduplicarPorChave([
      { chave: 'A', v: 1 },
      { chave: 'B', v: 2 },
      { chave: 'A', v: 3 },
    ]);
    expect(r).toEqual([{ chave: 'A', v: 3 }, { chave: 'B', v: 2 }]);
  });
});

describe('ProdutoService.buscar', () => {
  it('filtra por empresa, quebra o termo em palavras e ordena por uso', async () => {
    await ProdutoService.buscar('emp-1', { q: 'Cabo HDMI', limit: 5 });
    expect(registro.where[0]).toEqual({ company_id: 'emp-1' });
    // Uma condição por palavra, todas na coluna de busca normalizada
    expect(registro.ilike).toEqual([['busca', '%cabo%'], ['busca', '%hdmi%']]);
    expect(registro.limit).toBe(5);
    expect((registro.orderBy as Array<{ column: string }>)[0].column).toBe('vezes_emitido');
  });

  it('tira o acento do termo digitado', async () => {
    await ProdutoService.buscar('emp-1', { q: 'Água' });
    expect(registro.ilike).toEqual([['busca', '%agua%']]);
  });

  it('escapa curingas do ILIKE no termo', async () => {
    await ProdutoService.buscar('emp-1', { q: '100%' });
    expect(registro.ilike[0]).toEqual(['busca', '%100\\%%']);
  });

  it('sem termo devolve os mais usados, com limite máximo de 50', async () => {
    await ProdutoService.buscar('emp-1', { q: '   ', limit: 999 });
    expect(registro.ilike).toHaveLength(0);
    expect(registro.limit).toBe(50);
  });
});

describe('ProdutoService.registrarEmissao', () => {
  const itemBase = {
    codigo_produto: 'P1',
    descricao: 'Produto 1',
    ncm: '84212300',
    cfop: '5102',
    quantidade: 1,
    valor_unitario: 10,
  };

  it('faz upsert por (company_id, chave) acumulando vezes_emitido', async () => {
    const n = await ProdutoService.registrarEmissao('emp-1', [
      { ...itemBase },
      { ...itemBase, codigo_produto: 'P2', descricao: 'Produto 2' },
    ]);
    expect(n).toBe(2);
    expect(registro.conflito).toEqual(['company_id', 'chave']);
    expect((registro.inseridos[0] as Record<string, unknown>).company_id).toBe('emp-1');
    expect((registro.inseridos[0] as Record<string, unknown>).vezes_emitido).toBe(1);
    expect((registro.merge?.vezes_emitido as { sql: string }).sql).toContain('vezes_emitido + 1');
    // Dados fiscais da última emissão vencem
    expect(registro.merge?.ncm).toEqual({ sql: 'excluded.ncm' });
    expect(registro.merge?.busca).toEqual({ sql: 'excluded.busca' });
    expect(registro.merge?.cst_icms).toEqual({ sql: 'excluded.cst_icms' });
  });

  it('deduplica o mesmo produto repetido na mesma nota', async () => {
    const n = await ProdutoService.registrarEmissao('emp-1', [
      { ...itemBase },
      { ...itemBase, valor_unitario: 12 },
    ]);
    expect(n).toBe(1);
    expect(registro.inseridos).toHaveLength(1);
    expect((registro.inseridos[0] as Record<string, unknown>).valor_unitario).toBe(12);
  });

  it('ignora itens sem descrição e lista vazia', async () => {
    expect(await ProdutoService.registrarEmissao('emp-1', [])).toBe(0);
    expect(
      await ProdutoService.registrarEmissao('emp-1', [{ ...itemBase, descricao: '   ' }]),
    ).toBe(0);
  });
});
