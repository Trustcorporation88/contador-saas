import api from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReferenceType = 'NF' | 'RPA' | 'CHEQUE' | 'BOLETO' | 'MANUAL';

export interface JournalLine {
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalLineResponse {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit: number;
  credit: number;
  description?: string;
  line_number: number;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  created_by: string;
  entry_date: string;
  description?: string;
  reference_type?: string;
  reference_number?: string;
  reference_issuer?: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  data_hash?: string;
  lines?: JournalLineResponse[];
  created_at: string;
  updated_at: string;
}

export interface JournalListResponse {
  data: JournalEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateJournalPayload {
  entry_date: string;
  description?: string;
  reference_type?: ReferenceType;
  reference_number?: string;
  reference_issuer?: string;
  lines: JournalLine[];
}

export interface JournalListParams {
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
  is_posted?: boolean;
  search?: string;
  account_id?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const JournalService = {
  async list(companyId: string, params: JournalListParams = {}): Promise<JournalListResponse> {
    const query: Record<string, string | number | boolean> = { page: params.page ?? 1, limit: params.limit ?? 20 };
    if (params.date_from)    query.date_from    = params.date_from;
    if (params.date_to)      query.date_to      = params.date_to;
    if (params.search)       query.search       = params.search;
    if (params.account_id)   query.account_id   = params.account_id;
    if (params.is_posted !== undefined) query.is_posted = params.is_posted;

    const { data } = await api.get<JournalListResponse>(
      `/companies/${companyId}/journal-entries`,
      { params: query }
    );
    return data;
  },

  async getById(companyId: string, entryId: string): Promise<JournalEntry> {
    const { data } = await api.get<JournalEntry>(
      `/companies/${companyId}/journal-entries/${entryId}`
    );
    return data;
  },

  async create(companyId: string, payload: CreateJournalPayload): Promise<JournalEntry> {
    const { data } = await api.post<JournalEntry>(
      `/companies/${companyId}/journal-entries`,
      payload
    );
    return data;
  },

  async update(companyId: string, entryId: string, payload: Partial<CreateJournalPayload>): Promise<JournalEntry> {
    const { data } = await api.put<JournalEntry>(
      `/companies/${companyId}/journal-entries/${entryId}`,
      payload
    );
    return data;
  },

  async remove(companyId: string, entryId: string): Promise<void> {
    await api.delete(`/companies/${companyId}/journal-entries/${entryId}`);
  },

  async post(companyId: string, entryId: string): Promise<JournalEntry> {
    const { data } = await api.post<JournalEntry>(
      `/companies/${companyId}/journal-entries/${entryId}/post`
    );
    return data;
  },

  async reverse(companyId: string, entryId: string): Promise<JournalEntry> {
    const { data } = await api.post<JournalEntry>(
      `/companies/${companyId}/journal-entries/${entryId}/reverse`
    );
    return data;
  },
};
