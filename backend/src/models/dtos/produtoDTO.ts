/**
 * Produtos: catálogo por empresa usado na emissão de NF-e.
 *
 * Cada empresa tende a emitir sempre os mesmos itens; sem catálogo, o operador
 * reprocura descrição, NCM, CFOP e CST a cada nota. O catálogo é alimentado de
 * duas formas: cadastro manual (POST /produtos) e aprendizado automático a
 * partir de cada NF-e criada (ver ProdutoService.registrarEmissao).
 */

export interface ProdutoRecord {
  id:              string;
  company_id:      string;
  /** Identidade normalizada do produto dentro da empresa (ver chaveDoProduto). */
  chave:           string;
  codigo:          string | null;
  descricao:       string;
  ncm:             string | null;
  /** Código + descrição + NCM em minúsculas e sem acento (coluna de busca). */
  busca:           string;
  cfop:            string | null;
  unidade:         string;
  valor_unitario:  number;
  /** CST (2 dígitos, regime normal) ou CSOSN (3 dígitos, Simples). */
  cst_icms:        string | null;
  aliquota_icms:   number;
  cst_pis:         string | null;
  aliquota_pis:    number;
  cst_cofins:      string | null;
  aliquota_cofins: number;
  cst_ipi:         string | null;
  aliquota_ipi:    number;
  codigo_enquadramento_ipi: string | null;
  /** Quantas NF-e já saíram com este produto (ordena a busca). */
  vezes_emitido:   number;
  ultima_emissao_em: string | null;
  created_at:      string;
  updated_at:      string;
}

/** Campos aceitos no cadastro/edição manual. */
export interface ProdutoInputDTO {
  codigo?:          string;
  descricao:        string;
  ncm?:             string;
  cfop?:            string;
  unidade?:         string;
  valor_unitario?:  number;
  cst_icms?:        string;
  aliquota_icms?:   number;
  cst_pis?:         string;
  aliquota_pis?:    number;
  cst_cofins?:      string;
  aliquota_cofins?: number;
  cst_ipi?:         string;
  aliquota_ipi?:    number;
  codigo_enquadramento_ipi?: string;
}

export interface ProdutoBuscaFiltros {
  /** Texto livre: casa com descrição, código ou NCM. Vazio = mais usados. */
  q?:     string;
  limit?: number;
}

export interface ProdutoListFiltros extends ProdutoBuscaFiltros {
  page?: number;
}
