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
  projeto?: string | null;
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
  projeto?: string;
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
  projeto?: string | null;
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
    codigo_municipio_ibge?: string;
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

export interface CpfLookupResult {
  cpf: string;
  nome: string;
  situacao: string;
  ativo: boolean;
  data_nascimento?: string;
  nome_mae?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  fonte: string;
  cached: boolean;
}

export type DocumentoLookupResult =
  | ({ tipo: 'cnpj' } & CnpjLookupResult)
  | ({ tipo: 'cpf' } & CpfLookupResult);

// ─── Service ─────────────────────────────────────────────────────────────────

export const CompanyService = {
  async lookupCNPJ(cnpj: string): Promise<CnpjLookupResult> {
    const clean = cnpj.replace(/\D/g, '');
    const { data } = await api.get<CnpjLookupResult>(`/cnpj/${clean}`);
    return data;
  },

  async lookupCPF(cpf: string): Promise<CpfLookupResult> {
    const clean = cpf.replace(/\D/g, '');
    const { data } = await api.get<CpfLookupResult>(`/cnpj/cpf/${clean}`);
    return data;
  },

  async lookupDocumento(documento: string, dataNascimento?: string): Promise<DocumentoLookupResult> {
    const clean = documento.replace(/\D/g, '');
    // A Receita so responde consulta de CPF com data de nascimento junto.
    const params = dataNascimento ? { 'data-nascimento': dataNascimento } : undefined;
    const { data } = await api.get<DocumentoLookupResult>(`/cnpj/documento/${clean}`, { params });
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

/** Projetos/carteiras para os seletores da UI. Espelha PROJETOS do backend. */
export const PROJETOS_UI: Array<{ valor: string; rotulo: string }> = [
  { valor: 'LIDER_MEI', rotulo: 'Líder MEI' },
  { valor: 'LIDER_ME', rotulo: 'Líder ME' },
  { valor: 'CBPJ_MEI', rotulo: 'CBPJ MEI' },
  { valor: 'CBPJ_ME', rotulo: 'CBPJ ME' },
  { valor: 'TREINADORAS', rotulo: 'Treinadoras' },
];

export function rotuloProjeto(v?: string | null): string {
  return PROJETOS_UI.find((p) => p.valor === v)?.rotulo ?? '';
}
