/**
 * Produto Service: catálogo de produtos por empresa.
 *
 * Fonte de dados para o campo "Buscar produto" da emissão de NF-e. Dois
 * caminhos alimentam a tabela `produtos`:
 *
 *  1. Cadastro manual (criar/atualizar/remover).
 *  2. Aprendizado automático: toda NF-e criada passa por registrarEmissao(),
 *     que faz upsert de cada item. A última emissão sempre vence (é o dado que
 *     o operador acabou de usar numa nota real) e o contador vezes_emitido
 *     sobe, o que faz os produtos mais frequentes aparecerem primeiro.
 *
 * A migração 032 faz o backfill a partir de nfe_itens, então notas emitidas
 * antes desta feature já entram no catálogo no primeiro deploy.
 */

import { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  ProdutoBuscaFiltros,
  ProdutoInputDTO,
  ProdutoListFiltros,
  ProdutoRecord,
} from '../models/dtos/produtoDTO';
import { NfeItemDTO } from '../models/dtos/nfeDTO';

const TABELA = 'produtos';

/** Só dígitos, cortado no tamanho do campo. Vazio vira null (o banco distingue). */
function digitos(v: unknown, tamanho: number): string | null {
  const s = String(v ?? '').replace(/\D/g, '').slice(0, tamanho);
  return s || null;
}

function texto(v: unknown, tamanho: number): string | null {
  const s = String(v ?? '').trim().slice(0, tamanho);
  return s || null;
}

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Texto de busca do produto: código, descrição e NCM juntos, em minúsculas e
 * sem acento. Quem digita "filtro agua" precisa achar "Filtro de Água", e
 * ILIKE sozinho não faz isso. A coluna `busca` é gravada aqui (JS) e, no
 * backfill da migração 032, via translate() no SQL; as duas regras precisam
 * produzir o mesmo resultado para os acentos do português.
 */
export function textoDeBusca(...partes: Array<string | null | undefined>): string {
  return partes
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/**
 * Identidade do produto dentro da empresa.
 *
 * Com código informado, o código manda (é o que o ERP/etiqueta usa e permite
 * corrigir a descrição sem duplicar). Sem código, cai na descrição
 * normalizada: espaços colapsados, caixa alta. A mesma regra está replicada em
 * SQL na migração 032 (backfill); se mudar aqui, mude lá.
 */
export function chaveDoProduto(codigo: unknown, descricao: unknown): string {
  const cod = String(codigo ?? '').trim();
  if (cod) return `COD:${cod.toUpperCase()}`.slice(0, 140);
  const desc = String(descricao ?? '').trim().replace(/\s+/g, ' ');
  return `DESC:${desc.toUpperCase()}`.slice(0, 140);
}

/** Normaliza um item (da NF-e ou do cadastro) para as colunas da tabela. */
export function normalizarProduto(
  entrada: Partial<NfeItemDTO> & Partial<ProdutoInputDTO> & { codigo_produto?: string },
): Omit<ProdutoRecord, 'id' | 'company_id' | 'vezes_emitido' | 'ultima_emissao_em' | 'created_at' | 'updated_at'> & { busca: string } {
  const codigo = texto(entrada.codigo ?? entrada.codigo_produto, 60);
  const descricao = String(entrada.descricao ?? '').trim().replace(/\s+/g, ' ').slice(0, 255);
  const ncm = digitos(entrada.ncm, 8);
  return {
    chave:           chaveDoProduto(codigo, descricao),
    codigo,
    descricao,
    ncm,
    busca:           textoDeBusca(codigo, descricao, ncm),
    cfop:            digitos(entrada.cfop, 4),
    unidade:         (texto(entrada.unidade, 6) ?? 'UN').toUpperCase(),
    valor_unitario:  numero(entrada.valor_unitario),
    // CST (2 díg.) ou CSOSN (3 díg.): guarda como veio, só dígitos.
    cst_icms:        digitos(entrada.cst_icms, 3),
    aliquota_icms:   numero(entrada.aliquota_icms),
    cst_pis:         digitos(entrada.cst_pis, 2),
    aliquota_pis:    numero(entrada.aliquota_pis),
    cst_cofins:      digitos(entrada.cst_cofins, 2),
    aliquota_cofins: numero(entrada.aliquota_cofins),
    cst_ipi:         digitos(entrada.cst_ipi, 2),
    aliquota_ipi:    numero(entrada.aliquota_ipi),
    codigo_enquadramento_ipi: digitos(entrada.codigo_enquadramento_ipi, 3),
  };
}

/**
 * Remove repetições do mesmo produto dentro de uma única nota. Necessário
 * porque um INSERT ... ON CONFLICT DO UPDATE não pode tocar a mesma linha duas
 * vezes no mesmo comando (Postgres: "cannot affect row a second time").
 * Fica a última ocorrência, que é a mais recente na ordem dos itens.
 */
export function deduplicarPorChave<T extends { chave: string }>(itens: T[]): T[] {
  const porChave = new Map<string, T>();
  for (const item of itens) porChave.set(item.chave, item);
  return Array.from(porChave.values());
}

function erro(mensagem: string, status: number): Error {
  return Object.assign(new Error(mensagem), { status });
}

export class ProdutoService {

  /**
   * Busca para autocomplete. Texto vazio devolve os mais usados, o que cobre
   * o caso comum de empresa com poucos produtos: abrir o campo já mostra tudo.
   */
  static async buscar(companyId: string, filtros: ProdutoBuscaFiltros): Promise<ProdutoRecord[]> {
    const db = await getDatabase();
    const limit = Math.min(50, Math.max(1, filtros.limit ?? 20));
    const termo = String(filtros.q ?? '').trim();

    let query = db(TABELA).where({ company_id: companyId });
    if (termo) query = ProdutoService.aplicarTermo(query, termo);

    const linhas = await query
      .orderBy([
        { column: 'vezes_emitido', order: 'desc' },
        { column: 'ultima_emissao_em', order: 'desc', nulls: 'last' },
        { column: 'descricao', order: 'asc' },
      ])
      .limit(limit)
      .select('*');
    return linhas as ProdutoRecord[];
  }

  /** Listagem paginada (tela de cadastro). */
  static async listar(
    companyId: string,
    filtros: ProdutoListFiltros,
  ): Promise<{ data: ProdutoRecord[]; total: number; page: number; limit: number }> {
    const db = await getDatabase();
    const page  = Math.max(1, filtros.page ?? 1);
    const limit = Math.min(100, Math.max(1, filtros.limit ?? 20));
    const termo = String(filtros.q ?? '').trim();

    let query = db(TABELA).where({ company_id: companyId });
    if (termo) query = ProdutoService.aplicarTermo(query, termo);

    const [{ count }] = await query.clone().count<[{ count: string }]>('id as count');
    const data = await query
      .orderBy('descricao', 'asc')
      .limit(limit)
      .offset((page - 1) * limit)
      .select('*');
    return { data: data as ProdutoRecord[], total: parseInt(count, 10), page, limit };
  }

  static async obter(companyId: string, id: string): Promise<ProdutoRecord> {
    const db = await getDatabase();
    const produto = await db(TABELA).where({ id, company_id: companyId }).first();
    if (!produto) throw erro('Produto não encontrado', 404);
    return produto as ProdutoRecord;
  }

  static async criar(companyId: string, dto: ProdutoInputDTO): Promise<ProdutoRecord> {
    const db = await getDatabase();
    const dados = ProdutoService.validar(dto);
    const existente = await db(TABELA)
      .where({ company_id: companyId, chave: dados.chave })
      .first();
    if (existente) {
      throw erro(
        dados.codigo
          ? `Já existe um produto com o código "${dados.codigo}" nesta empresa.`
          : 'Já existe um produto com esta descrição nesta empresa. Informe um código para diferenciá-los.',
        409,
      );
    }
    const [criado] = await db(TABELA)
      .insert({ ...dados, company_id: companyId })
      .returning('*');
    return criado as ProdutoRecord;
  }

  static async atualizar(companyId: string, id: string, dto: ProdutoInputDTO): Promise<ProdutoRecord> {
    const db = await getDatabase();
    await ProdutoService.obter(companyId, id);
    const dados = ProdutoService.validar(dto);
    const conflito = await db(TABELA)
      .where({ company_id: companyId, chave: dados.chave })
      .whereNot({ id })
      .first();
    if (conflito) throw erro('Outro produto desta empresa já usa este código/descrição.', 409);
    const [atualizado] = await db(TABELA)
      .where({ id, company_id: companyId })
      .update({ ...dados, updated_at: db.fn.now() })
      .returning('*');
    return atualizado as ProdutoRecord;
  }

  static async remover(companyId: string, id: string): Promise<void> {
    const db = await getDatabase();
    const apagados = await db(TABELA).where({ id, company_id: companyId }).del();
    if (!apagados) throw erro('Produto não encontrado', 404);
  }

  /**
   * Aprende com uma NF-e recém-criada: upsert de cada item no catálogo.
   *
   * Chamado FORA da transação da nota e protegido por try/catch pelo chamador:
   * o catálogo é conveniência, e uma falha aqui jamais pode derrubar uma
   * emissão fiscal. Aceita um `db` opcional para testes.
   */
  static async registrarEmissao(
    companyId: string,
    itens: NfeItemDTO[],
    dbOverride?: Knex,
  ): Promise<number> {
    if (!Array.isArray(itens) || itens.length === 0) return 0;
    const db = dbOverride ?? (await getDatabase());

    const linhas = deduplicarPorChave(
      itens
        .map((item) => normalizarProduto(item))
        .filter((p) => p.descricao.length > 0),
    ).map((p) => ({ ...p, company_id: companyId, vezes_emitido: 1, ultima_emissao_em: db.fn.now() }));
    if (linhas.length === 0) return 0;

    // A última emissão vence em todos os campos fiscais: é o que o operador
    // acabou de validar numa nota de verdade. O contador acumula.
    await db(TABELA)
      .insert(linhas)
      .onConflict(['company_id', 'chave'])
      .merge({
        codigo:          db.raw('excluded.codigo'),
        descricao:       db.raw('excluded.descricao'),
        ncm:             db.raw('excluded.ncm'),
        busca:           db.raw('excluded.busca'),
        cfop:            db.raw('excluded.cfop'),
        unidade:         db.raw('excluded.unidade'),
        valor_unitario:  db.raw('excluded.valor_unitario'),
        cst_icms:        db.raw('excluded.cst_icms'),
        aliquota_icms:   db.raw('excluded.aliquota_icms'),
        cst_pis:         db.raw('excluded.cst_pis'),
        aliquota_pis:    db.raw('excluded.aliquota_pis'),
        cst_cofins:      db.raw('excluded.cst_cofins'),
        aliquota_cofins: db.raw('excluded.aliquota_cofins'),
        cst_ipi:         db.raw('excluded.cst_ipi'),
        aliquota_ipi:    db.raw('excluded.aliquota_ipi'),
        codigo_enquadramento_ipi: db.raw('excluded.codigo_enquadramento_ipi'),
        vezes_emitido:   db.raw(`${TABELA}.vezes_emitido + 1`),
        ultima_emissao_em: db.fn.now(),
        updated_at:      db.fn.now(),
      });

    logger.debug('Catálogo de produtos atualizado a partir de NF-e', {
      companyId,
      produtos: linhas.length,
    });
    return linhas.length;
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private static aplicarTermo(query: Knex.QueryBuilder, termo: string): Knex.QueryBuilder {
    // Cada palavra precisa aparecer na coluna `busca` (código + descrição +
    // NCM, sem acento): "cabo hdmi 2m" acha "CABO HDMI 2 METROS" com as
    // palavras em outra ordem, e "agua" acha "Água".
    const palavras = textoDeBusca(termo).split(' ').filter(Boolean).slice(0, 6);
    for (const palavra of palavras) {
      const like = `%${palavra.replace(/[%_\\]/g, '\\$&')}%`;
      query = query.whereILike('busca', like);
    }
    return query;
  }

  private static validar(dto: ProdutoInputDTO) {
    const dados = normalizarProduto(dto ?? {});
    if (!dados.descricao) throw erro('Informe a descrição do produto.', 400);
    if (dados.ncm && dados.ncm.length !== 8) {
      throw erro('NCM deve ter 8 dígitos (ex.: 84212300).', 400);
    }
    if (dados.cfop && dados.cfop.length !== 4) {
      throw erro('CFOP deve ter 4 dígitos (ex.: 5102).', 400);
    }
    if (dados.cst_icms && dados.cst_icms.length !== 2 && dados.cst_icms.length !== 3) {
      throw erro('CST do ICMS deve ter 2 dígitos (CST) ou 3 dígitos (CSOSN).', 400);
    }
    if (dados.valor_unitario < 0) throw erro('Valor unitário não pode ser negativo.', 400);
    return dados;
  }
}
