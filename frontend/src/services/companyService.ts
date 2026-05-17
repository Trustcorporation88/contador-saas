import api from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaxRegime = 'simples_nacional' | 'lucro_presumido' | 'lucro_real';

export interface APICompany {
  id: string;
  cnpj: string;
  name: string;
  email?: string;
  phone?: string;
  tax_regime: TaxRegime;
  fiscal_year_start?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyListResponse {
  success: boolean;
  data: APICompany[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  tax_regime?: string;
}

export interface CompanyPayload {
  name: string;
  tax_regime: TaxRegime;
  email?: string;
  phone?: string;
  fiscal_year_start?: number;
}

export interface CreatePayload extends CompanyPayload {
  cnpj: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const CompanyService = {
  async list(params: ListParams = {}): Promise<CompanyListResponse> {
    const { data } = await api.get<CompanyListResponse>('/companies', { params });
    return data;
  },

  async getById(id: string): Promise<APICompany> {
    const { data } = await api.get<{ success: boolean; data: APICompany }>(`/companies/${id}`);
    return data.data;
  },

  async create(payload: CreatePayload): Promise<APICompany> {
    const { data } = await api.post<{ success: boolean; data: APICompany }>('/companies', {
      ...payload,
      cnpj: payload.cnpj.replace(/\D/g, ''), // Envia apenas dígitos
    });
    return data.data;
  },

  async update(id: string, payload: CompanyPayload): Promise<APICompany> {
    const { data } = await api.put<{ success: boolean; data: APICompany }>(
      `/companies/${id}`,
      payload
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/companies/${id}`);
  },
};
