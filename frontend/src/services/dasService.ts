import api from '../config/api';

export interface DASBoleto {
  id: string;
  company_id: string;
  tax_calculation_id: string | null;
  
  data_emissao: string;
  data_vencimento: string;
  mes_competencia: number;
  ano_competencia: number;
  
  valor_original: number;
  juros: number;
  multa: number;
  desconto: number;
  valor_total: number;
  valor_pago: number;
  valor_devido: number;
  
  status: 'EMITIDO' | 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  
  codigo_receita: string;
  numero_boleto: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  
  data_pagamento: string | null;
  juros_pago: number | null;
  multa_paga: number | null;
  numero_comprovante: string | null;
  
  regime_tributario: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES';
  observacoes: string | null;
  
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface DASListFilters {
  status?: string;
  regime_tributario?: string;
  mes_competencia?: number;
  ano_competencia?: number;
  data_vencimento_de?: string;
  data_vencimento_ate?: string;
  somente_atrasadas?: boolean;
  somente_nao_pagos?: boolean;
  limit?: number;
  page?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface DASListResponse {
  success: boolean;
  data: DASBoleto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class DASService {
  static getBaseURL(companyId: string) {
    return `/companies/${companyId}/das`;
  }

  static async list(companyId: string, filters?: DASListFilters): Promise<DASListResponse> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.regime_tributario) params.append('regime_tributario', filters.regime_tributario);
    if (filters?.mes_competencia) params.append('mes_competencia', filters.mes_competencia.toString());
    if (filters?.ano_competencia) params.append('ano_competencia', filters.ano_competencia.toString());
    if (filters?.somente_atrasadas) params.append('somente_atrasadas', 'true');
    if (filters?.somente_nao_pagos) params.append('somente_nao_pagos', 'true');
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await api.get<DASListResponse>(
      `${this.getBaseURL(companyId)}?${params.toString()}`
    );
    return response.data;
  }

  static async getById(companyId: string, dasId: string): Promise<DASBoleto> {
    const response = await api.get<{ success: boolean; data: DASBoleto }>(
      `${this.getBaseURL(companyId)}/${dasId}`
    );
    return response.data.data;
  }

  static async create(companyId: string, data: {
    mes_competencia: number;
    ano_competencia: number;
    valor_original: number;
    regime_tributario: string;
    juros?: number;
    multa?: number;
    desconto?: number;
    observacoes?: string;
    tax_calculation_id?: string;
  }): Promise<DASBoleto> {
    const response = await api.post<{ success: boolean; data: DASBoleto }>(
      `${this.getBaseURL(companyId)}/generate`,
      data
    );
    
    if (!response.data.success) {
      throw new Error('Erro ao criar DAS');
    }
    
    return response.data.data;
  }

  static async update(companyId: string, dasId: string, data: {
    juros?: number;
    multa?: number;
    desconto?: number;
    observacoes?: string;
  }): Promise<DASBoleto> {
    const response = await api.patch<{ success: boolean; data: DASBoleto }>(
      `${this.getBaseURL(companyId)}/${dasId}`,
      data
    );
    
    if (!response.data.success) {
      throw new Error('Erro ao atualizar DAS');
    }
    
    return response.data.data;
  }

  static async registrarPagamento(companyId: string, dasId: string, data: {
    data_pagamento: string;
    valor_pago: number;
    juros_pago?: number;
    multa_paga?: number;
    numero_comprovante?: string;
  }): Promise<DASBoleto> {
    const response = await api.post<{ success: boolean; data: DASBoleto }>(
      `${this.getBaseURL(companyId)}/${dasId}/pay`,
      data
    );
    
    if (!response.data.success) {
      throw new Error('Erro ao registrar pagamento');
    }
    
    return response.data.data;
  }

  static async cancelar(companyId: string, dasId: string): Promise<DASBoleto> {
    const response = await api.delete<{ success: boolean; data: DASBoleto }>(
      `${this.getBaseURL(companyId)}/${dasId}`,
      { data: { motivo: 'Cancelamento via sistema' } }
    );
    
    if (!response.data.success) {
      throw new Error('Erro ao cancelar DAS');
    }
    
    return response.data.data;
  }

  static async getEstatisticas(companyId: string): Promise<{
    totalApagar: number;
    atrasados: number;
    pagosEsteMes: number;
    totalRegistrado: number;
  }> {
    const listResponse = await this.list(companyId, {
      limit: 1000,
      page: 1,
    });

    const dados = listResponse.data;
    const totalApagar = dados
      .filter(d => d.status !== 'PAGO')
      .reduce((sum, d) => sum + (d.valor_total - d.valor_pago), 0);

    const atrasados = dados.filter(d => d.status === 'VENCIDO').length;
    const pagosEsteMes = dados.filter(d => d.status === 'PAGO').length;

    return {
      totalApagar,
      atrasados,
      pagosEsteMes,
      totalRegistrado: dados.length,
    };
  }
}
