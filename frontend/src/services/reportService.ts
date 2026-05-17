import api from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountBalance {
  account_id: string;
  code: string;
  name: string;
  type: string;
  parent_code?: string;
  debit_total: number;
  credit_total: number;
  balance: number;
  children?: AccountBalance[];
}

export interface BalanceSheetReport {
  company_id: string;
  date_from?: string;
  date_to?: string;
  generated_at: string;
  assets: {
    current: AccountBalance[];
    non_current: AccountBalance[];
    total: number;
  };
  liabilities: {
    current: AccountBalance[];
    non_current: AccountBalance[];
    total: number;
  };
  equity: {
    items: AccountBalance[];
    total: number;
  };
  total_assets: number;
  total_liabilities_and_equity: number;
  is_balanced: boolean;
}

export interface IncomeStatementReport {
  company_id: string;
  date_from: string;
  date_to: string;
  generated_at: string;
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  gross_revenue: number;
  total_expenses: number;
  net_income: number;
}

export interface TrialBalanceItem {
  account_id: string;
  code: string;
  name: string;
  type: string;
  debit_total: number;
  credit_total: number;
  balance: number;
}

export interface TrialBalanceReport {
  company_id: string;
  date_from?: string;
  date_to?: string;
  generated_at: string;
  items: TrialBalanceItem[];
  totals: { debit: number; credit: number };
  is_balanced: boolean;
}

export interface LedgerEntry {
  date: string;
  journal_entry_id: string;
  description?: string;
  reference_number?: string;
  debit: number;
  credit: number;
  running_balance: number;
}

export interface LedgerReport {
  account_id: string;
  account_code: string;
  account_name: string;
  opening_balance: number;
  entries: LedgerEntry[];
  closing_balance: number;
  total_debit: number;
  total_credit: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const ReportService = {
  async getBalanceSheet(companyId: string, dateTo?: string): Promise<BalanceSheetReport> {
    const params: Record<string, string> = {};
    if (dateTo) params.date_to = dateTo;
    const { data } = await api.get<BalanceSheetReport>(
      `/companies/${companyId}/reports/balance-sheet`,
      { params }
    );
    return data;
  },

  async getIncomeStatement(companyId: string, dateFrom: string, dateTo: string): Promise<IncomeStatementReport> {
    const { data } = await api.get<IncomeStatementReport>(
      `/companies/${companyId}/reports/income-statement`,
      { params: { date_from: dateFrom, date_to: dateTo } }
    );
    return data;
  },

  async getTrialBalance(companyId: string, dateFrom?: string, dateTo?: string): Promise<TrialBalanceReport> {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    const { data } = await api.get<TrialBalanceReport>(
      `/companies/${companyId}/reports/trial-balance`,
      { params }
    );
    return data;
  },

  async getLedger(companyId: string, accountId: string, dateFrom?: string, dateTo?: string): Promise<LedgerReport> {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    const { data } = await api.get<LedgerReport>(
      `/companies/${companyId}/reports/ledger/${accountId}`,
      { params }
    );
    return data;
  },

  /** Download de exportação — retorna blob para salvar */
  async exportReport(
    type: 'balance-sheet' | 'income-statement' | 'trial-balance',
    companyId: string,
    params: Record<string, string>,
    format: 'xlsx' | 'pdf'
  ): Promise<Blob> {
    const { data } = await api.get(
      `/companies/${companyId}/reports/${type}/export`,
      { params: { ...params, format }, responseType: 'blob' }
    );
    return data as Blob;
  },
};

/** Helper: dispara download de blob no browser/Electron */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
