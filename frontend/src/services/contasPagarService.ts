import api from '../config/api';

export type StatusContaPagar = 'pendente' | 'parcial' | 'pago' | 'vencido' | 'cancelado';
export type CategoriaContaPagar = 'boleto' | 'fornecedor' | 'imposto' | 'salario' | 'aluguel' | 'outro';
export type FormaPagamentoContaPagar = 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cartao' | 'outro';

export interface PagamentoContaPagar {
  id: string;
  conta_pagar_id: string;
  data_pagamento: string;
  valor_pago: number;
  juros: number;
  multa: number;
  desconto: number;
  forma_pagamento: FormaPagamentoContaPagar;
  observacoes?: string;
  created_at: string;
  created_by: string;
}

export interface ContaPagar {
  id: string;
  categoria: CategoriaContaPagar;
  numero_titulo: string;
  descricao: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  fornecedor_email?: string;
  fornecedor_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  valor_pago: number;
  juros: number;
  multa: number;
  desconto: number;
  status: StatusContaPagar;
  observacoes?: string;
  saldo_aberto?: number;
  dias_atraso?: number;
  pagamentos?: PagamentoContaPagar[];
}

export interface ContaPagarListParams {
  categoria?: CategoriaContaPagar;
  status?: StatusContaPagar;
  fornecedor_nome?: string;
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

export interface ContaPagarPayload {
  documento_fiscal_id?: string;
  categoria: CategoriaContaPagar;
  numero_titulo: string;
  descricao: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  fornecedor_email?: string;
  fornecedor_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  observacoes?: string;
}

export interface RegistrarPagamentoPayload {
  data_pagamento: string;
  valor_pago: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  forma_pagamento: FormaPagamentoContaPagar;
  observacoes?: string;
}

export interface ContasPagarListResponse {
  success: boolean;
  data: ContaPagar[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ContasPagarStats {
  total_titulos: number;
  total_aberto: number;
  total_pago: number;
  total_vencido: number;
  proximos_7_dias: number;
  proximos_14_dias: number;
  proximos_30_dias: number;
  por_status: Record<string, { quantidade: number; valor: number }>;
}

export const ContasPagarService = {
  async list(params: ContaPagarListParams = {}): Promise<ContasPagarListResponse> {
    const { data } = await api.get<ContasPagarListResponse>('/contas-pagar', { params });
    return data;
  },

  async getById(id: string): Promise<ContaPagar> {
    const { data } = await api.get<{ success: boolean; data: ContaPagar }>(`/contas-pagar/${id}`);
    return data.data;
  },

  async create(payload: ContaPagarPayload): Promise<ContaPagar> {
    const { data } = await api.post<{ success: boolean; data: ContaPagar }>('/contas-pagar', {
      ...payload,
      fornecedor_cnpj: payload.fornecedor_cnpj?.replace(/\D/g, ''),
    });
    return data.data;
  },

  async update(id: string, payload: Partial<ContaPagarPayload>): Promise<ContaPagar> {
    const { data } = await api.put<{ success: boolean; data: ContaPagar }>(`/contas-pagar/${id}`, {
      ...payload,
      fornecedor_cnpj: payload.fornecedor_cnpj?.replace(/\D/g, ''),
    });
    return data.data;
  },

  async registrarPagamento(id: string, payload: RegistrarPagamentoPayload): Promise<ContaPagar> {
    const { data } = await api.post<{ success: boolean; data: ContaPagar }>(`/contas-pagar/${id}/pagamentos`, payload);
    return data.data;
  },

  async cancelar(id: string): Promise<void> {
    await api.delete(`/contas-pagar/${id}`);
  },

  async getEstatisticas(): Promise<ContasPagarStats> {
    const { data } = await api.get<{ success: boolean; data: ContasPagarStats }>('/contas-pagar/stats/estatisticas');
    return data.data;
  },
};