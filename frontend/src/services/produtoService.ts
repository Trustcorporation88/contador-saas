import api from '../config/api';

/**
 * Catálogo de produtos da empresa: alimenta o campo "Buscar produto" da
 * emissão de NF-e. O backend aprende sozinho com cada nota criada, então o
 * catálogo cresce sem cadastro manual; o CRUD existe para ajustar/limpar.
 */
export interface ProdutoRecord {
  id: string;
  company_id: string;
  chave: string;
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string;
  valor_unitario: number | string;
  /** CST (2 dígitos, regime normal) ou CSOSN (3 dígitos, Simples). */
  cst_icms: string | null;
  aliquota_icms: number | string;
  cst_pis: string | null;
  aliquota_pis: number | string;
  cst_cofins: string | null;
  aliquota_cofins: number | string;
  cst_ipi: string | null;
  aliquota_ipi: number | string;
  codigo_enquadramento_ipi: string | null;
  vezes_emitido: number;
  ultima_emissao_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProdutoInput {
  codigo?: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
  valor_unitario?: number;
  cst_icms?: string;
  aliquota_icms?: number;
  cst_pis?: string;
  aliquota_pis?: number;
  cst_cofins?: string;
  aliquota_cofins?: number;
  cst_ipi?: string;
  aliquota_ipi?: number;
  codigo_enquadramento_ipi?: string;
}

export interface ProdutoListResponse {
  data: ProdutoRecord[];
  total: number;
  page: number;
  limit: number;
}

export class ProdutoService {
  static base(companyId: string) {
    return `/companies/${companyId}/produtos`;
  }

  /** Autocomplete: texto vazio devolve os produtos mais emitidos. */
  static async buscar(companyId: string, q: string, limit = 15): Promise<ProdutoRecord[]> {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set('q', q.trim());
    qs.set('limit', String(limit));
    const { data } = await api.get<{ data: ProdutoRecord[] }>(
      `${this.base(companyId)}/buscar?${qs.toString()}`,
    );
    return data.data;
  }

  static async listar(
    companyId: string,
    params: { q?: string; page?: number; limit?: number } = {},
  ): Promise<ProdutoListResponse> {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const { data } = await api.get<ProdutoListResponse>(
      `${this.base(companyId)}${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
    return data;
  }

  static async criar(companyId: string, payload: ProdutoInput): Promise<ProdutoRecord> {
    const { data } = await api.post<ProdutoRecord>(this.base(companyId), payload);
    return data;
  }

  static async atualizar(companyId: string, id: string, payload: ProdutoInput): Promise<ProdutoRecord> {
    const { data } = await api.put<ProdutoRecord>(`${this.base(companyId)}/${id}`, payload);
    return data;
  }

  static async remover(companyId: string, id: string): Promise<void> {
    await api.delete(`${this.base(companyId)}/${id}`);
  }
}
