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
  inscricao_estadual?: string;
  address?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  codigo_municipio?: string;
  crt?: string;
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
  inscricao_estadual?: string;
  address?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  codigo_municipio?: string;
  crt?: string;
}

export interface CreatePayload extends CompanyPayload {
  cnpj: string;
}

export interface CnpjLookupResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao: string;
  ativa: boolean;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  contato: {
    telefone: string;
    email: string;
  };
  porte: string;
  natureza_juridica: string;
  cnae_principal: { codigo: number; descricao: string };
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>;
  socios: Array<{ nome: string; qualificacao: string }>;
  capital_social: number;
  simples_nacional: boolean;
  mei: boolean;
  fonte: string;
  cached: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const CompanyService = {
  async lookupCNPJ(cnpj: string): Promise<CnpjLookupResult> {
    const clean = cnpj.replace(/\D/g, '');
    const { data } = await api.get<CnpjLookupResult>(`/cnpj/${clean}`);
    return data;
  },

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
