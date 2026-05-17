import api from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type TaxCode = 'IRPJ' | 'CSLL' | 'PIS' | 'COFINS' | 'ICMS' | 'ISS';

export interface APIAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_code?: string;
  parent_id?: string;
  tax_code?: TaxCode;
  is_analytical: boolean;
  balance: number;
  debit_total?: number;
  credit_total?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface APIAccountHierarchy {
  code: string;
  name: string;
  type: AccountType;
  balance?: number;
  is_analytical: boolean;
  children?: APIAccountHierarchy[];
}

export interface AccountListResponse {
  data: APIAccount[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AccountListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: AccountType | '';
}

export interface CreateAccountPayload {
  code: string;
  name: string;
  type: AccountType;
  parent_code?: string;
  tax_code?: string;
  is_analytical?: boolean;
}

export interface UpdateAccountPayload {
  name?: string;
  type?: AccountType;
  parent_code?: string;
  tax_code?: string;
  is_analytical?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const AccountService = {
  async list(companyId: string, params: AccountListParams = {}): Promise<AccountListResponse> {
    const { data } = await api.get<AccountListResponse>(
      `/companies/${companyId}/accounts`,
      { params: { ...params, type: params.type || undefined } }
    );
    return data;
  },

  async getHierarchy(companyId: string): Promise<APIAccountHierarchy[]> {
    const { data } = await api.get<{ data: APIAccountHierarchy[] }>(
      `/companies/${companyId}/accounts/hierarchy`
    );
    return data.data;
  },

  async getById(companyId: string, accountId: string): Promise<APIAccount> {
    const { data } = await api.get<APIAccount>(
      `/companies/${companyId}/accounts/${accountId}`
    );
    return data;
  },

  async create(companyId: string, payload: CreateAccountPayload): Promise<APIAccount> {
    const body = { ...payload, tax_code: payload.tax_code || undefined };
    const { data } = await api.post<APIAccount>(
      `/companies/${companyId}/accounts`,
      body
    );
    return data;
  },

  async update(companyId: string, accountId: string, payload: UpdateAccountPayload): Promise<APIAccount> {
    const body = { ...payload, tax_code: payload.tax_code || undefined };
    const { data } = await api.put<APIAccount>(
      `/companies/${companyId}/accounts/${accountId}`,
      body
    );
    return data;
  },

  async remove(companyId: string, accountId: string): Promise<void> {
    await api.delete(`/companies/${companyId}/accounts/${accountId}`);
  },

  async importPlano(companyId: string, overwrite = false): Promise<{ imported: number; skipped: number }> {
    const { data } = await api.post<{ imported: number; skipped: number }>(
      `/companies/${companyId}/accounts/import-plano`,
      { overwrite }
    );
    return data;
  },
};
