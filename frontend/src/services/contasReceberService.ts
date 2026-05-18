import api from '../config/api';

export type StatusContaReceber = 'pendente' | 'parcial' | 'recebido' | 'vencido' | 'cancelado';
export type CategoriaContaReceber = 'boleto' | 'duplicata' | 'promissoria' | 'pix' | 'outro';
export type FormaRecebimento = 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cartao' | 'outro';

export interface RecebimentoContaReceber {
  id: string;
  conta_receber_id: string;
  data_recebimento: string;
  valor_recebido: number;
  juros: number;
  multa: number;
  desconto: number;
  forma_recebimento: FormaRecebimento;
  observacoes?: string;
  created_at: string;
  created_by: string;
}

export interface ContaReceber {
  id: string;
  categoria: CategoriaContaReceber;
  numero_titulo: string;
  descricao: string;
  cliente_nome: string;
  cliente_cnpj?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  valor_recebido: number;
  juros: number;
  multa: number;
  desconto: number;
  status: StatusContaReceber;
  observacoes?: string;
  saldo_aberto?: number;
  dias_atraso?: number;
  recebimentos?: RecebimentoContaReceber[];
}

export interface ContaReceberListParams {
  categoria?: CategoriaContaReceber;
  status?: StatusContaReceber;
  cliente_nome?: string;
  data_vencimento_de?: string;
  data_vencimento_ate?: string;
  valor_minimo?: number;
  valor_maximo?: number;
  somente_atrasadas?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'data_vencimento' | 'valor_original' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface ContaReceberPayload {
  documento_fiscal_id?: string;
  categoria: CategoriaContaReceber;
  numero_titulo: string;
  descricao: string;
  cliente_nome: string;
  cliente_cnpj?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  observacoes?: string;
}

export interface RegistrarRecebimentoPayload {
  data_recebimento: string;
  valor_recebido: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  forma_recebimento: FormaRecebimento;
  observacoes?: string;
}

export interface ContasReceberListResponse {
  success: boolean;
  data: ContaReceber[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ContasReceberStats {
  total_titulos: number;
  total_aberto: number;
  total_recebido: number;
  total_vencido: number;
  proximos_7_dias: number;
  proximos_14_dias: number;
  proximos_30_dias: number;
  por_status: Record<string, { quantidade: number; valor: number }>;
}

export const ContasReceberService = {
  async list(params: ContaReceberListParams = {}): Promise<ContasReceberListResponse> {
    const { data } = await api.get<ContasReceberListResponse>('/contas-receber', { params });
    return data;
  },

  async getById(id: string): Promise<ContaReceber> {
    const { data } = await api.get<{ success: boolean; data: ContaReceber }>(`/contas-receber/${id}`);
    return data.data;
  },

  async create(payload: ContaReceberPayload): Promise<ContaReceber> {
    const { data } = await api.post<{ success: boolean; data: ContaReceber }>('/contas-receber', {
      ...payload,
      cliente_cnpj: payload.cliente_cnpj?.replace(/\D/g, ''),
    });
    return data.data;
  },

  async update(id: string, payload: Partial<ContaReceberPayload>): Promise<ContaReceber> {
    const { data } = await api.put<{ success: boolean; data: ContaReceber }>(`/contas-receber/${id}`, {
      ...payload,
      cliente_cnpj: payload.cliente_cnpj?.replace(/\D/g, ''),
    });
    return data.data;
  },

  async registrarRecebimento(id: string, payload: RegistrarRecebimentoPayload): Promise<ContaReceber> {
    const { data } = await api.post<{ success: boolean; data: ContaReceber }>(`/contas-receber/${id}/recebimentos`, payload);
    return data.data;
  },

  async cancelar(id: string): Promise<void> {
    await api.delete(`/contas-receber/${id}`);
  },

  async getEstatisticas(): Promise<ContasReceberStats> {
    const { data } = await api.get<{ success: boolean; data: ContasReceberStats }>('/contas-receber/stats/estatisticas');
    return data.data;
  },
};