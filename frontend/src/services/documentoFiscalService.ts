import api from '../config/api';

export type TipoDocumentoFiscal = 'nfe' | 'boleto' | 'recibo' | 'cupom_fiscal';
export type StatusDocumentoFiscal = 'rascunho' | 'registrado' | 'cancelado';
export type ContraparteTipo = 'cliente' | 'fornecedor';

export interface ItemDocumentoFiscalPayload {
  id?: string;
  descricao: string;
  codigo_produto?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total?: number;
  aliquota_icms?: number;
  aliquota_ipi?: number;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  ordem?: number;
}

export interface DocumentoFiscal {
  id: string;
  company_id: string;
  created_by: string;
  tipo: TipoDocumentoFiscal;
  numero: string;
  serie: string;
  descricao: string;
  data_emissao: string;
  data_vencimento?: string;
  valor_total: number;
  valor_impostos?: number;
  valor_desconto?: number;
  contraparte_tipo?: ContraparteTipo;
  contraparte_cnpj?: string;
  contraparte_nome?: string;
  contraparte_email?: string;
  contraparte_telefone?: string;
  status: StatusDocumentoFiscal;
  registrado_no_diario: boolean;
  is_active: boolean;
  itens?: ItemDocumentoFiscalPayload[];
  anexos?: Array<{
    id: string;
    arquivo_nome: string;
    arquivo_url?: string;
    tipo?: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface DocumentoFiscalListParams {
  page?: number;
  limit?: number;
  tipo?: TipoDocumentoFiscal;
  status?: StatusDocumentoFiscal;
  contraparte_tipo?: ContraparteTipo;
  contraparte_cnpj?: string;
  descricao?: string;
  data_emissao_de?: string;
  data_emissao_ate?: string;
  valor_minimo?: number;
  valor_maximo?: number;
  sort_by?: 'data_emissao' | 'valor_total' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface DocumentoFiscalListResponse {
  success: boolean;
  data: DocumentoFiscal[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DocumentoFiscalStats {
  total_documentos: number;
  total_valor: number;
  por_tipo: Record<string, { quantidade: number; valor_total: number }>;
  por_status: Record<string, { quantidade: number; valor_total: number }>;
}

export interface DocumentoFiscalPayload {
  tipo: TipoDocumentoFiscal;
  numero: string;
  serie: string;
  descricao: string;
  data_emissao: string;
  data_vencimento?: string;
  valor_total?: number;
  valor_impostos?: number;
  valor_desconto?: number;
  contraparte_tipo?: ContraparteTipo;
  contraparte_cnpj?: string;
  contraparte_nome?: string;
  contraparte_email?: string;
  contraparte_telefone?: string;
  itens: ItemDocumentoFiscalPayload[];
}

export const DocumentoFiscalService = {
  async list(params: DocumentoFiscalListParams = {}): Promise<DocumentoFiscalListResponse> {
    const { data } = await api.get<DocumentoFiscalListResponse>('/documentos', { params });
    return data;
  },

  async getById(id: string): Promise<DocumentoFiscal> {
    const { data } = await api.get<{ success: boolean; data: DocumentoFiscal }>(`/documentos/${id}`);
    return data.data;
  },

  async create(payload: DocumentoFiscalPayload): Promise<DocumentoFiscal> {
    const body = {
      ...payload,
      contraparte_cnpj: payload.contraparte_cnpj?.replace(/\D/g, ''),
      itens: payload.itens.map((item, index) => ({
        ...item,
        valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
        ordem: item.ordem ?? index,
      })),
    };

    const { data } = await api.post<{ success: boolean; data: DocumentoFiscal }>('/documentos', body);
    return data.data;
  },

  async update(id: string, payload: Partial<DocumentoFiscalPayload>): Promise<DocumentoFiscal> {
    const body = {
      ...payload,
      contraparte_cnpj: payload.contraparte_cnpj?.replace(/\D/g, ''),
      itens: payload.itens?.map((item, index) => ({
        ...item,
        valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
        ordem: item.ordem ?? index,
      })),
    };

    const { data } = await api.put<{ success: boolean; data: DocumentoFiscal }>(`/documentos/${id}`, body);
    return data.data;
  },

  async registrar(id: string): Promise<void> {
    await api.post(`/documentos/${id}/registrar`);
  },

  async cancelar(id: string): Promise<void> {
    await api.delete(`/documentos/${id}`);
  },

  async getEstatisticas(): Promise<DocumentoFiscalStats> {
    const { data } = await api.get<{ success: boolean; data: DocumentoFiscalStats }>('/documentos/stats/estatisticas');
    return data.data;
  },
};