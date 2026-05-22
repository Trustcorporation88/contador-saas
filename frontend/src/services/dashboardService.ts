import api from '../config/api';
import type { BalanceSheet, DRE, JournalEntry } from '../types';
import type { APICompany } from './companyService';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type BalanceSheetReportShape = {
  date_to?: string;
  assets?: {
    current?: Array<{ account_id?: string; code?: string; name?: string; balance?: number }>;
    non_current?: Array<{ account_id?: string; code?: string; name?: string; balance?: number }>;
    total?: number;
  };
  liabilities?: {
    current?: Array<{ account_id?: string; code?: string; name?: string; balance?: number }>;
    non_current?: Array<{ account_id?: string; code?: string; name?: string; balance?: number }>;
    total?: number;
  };
  equity?: {
    items?: Array<{ account_id?: string; code?: string; name?: string; balance?: number }>;
    total?: number;
  };
};

type IncomeStatementReportShape = {
  date_from?: string;
  date_to?: string;
  revenues?: Array<{ account_id?: string; code?: string; name?: string; balance?: number }>;
  gross_revenue?: number;
  total_expenses?: number;
  net_income?: number;
};

type JournalEntryApiShape = {
  id: string;
  entry_date?: string;
  description?: string;
  company_id?: string;
  companyId?: string;
  lines?: Array<{
    id?: string;
    account_id?: string;
    accountId?: string;
    account_code?: string;
    account_name?: string;
    debit?: number;
    credit?: number;
    description?: string;
  }>;
  created_by?: string;
  createdBy?: string;
  created_at?: string;
  updated_at?: string;
  reference_number?: string;
  reference_type?: string;
  total_debit?: number;
  total_credit?: number;
  is_posted?: boolean;
};

function mapBalanceItem(item: { account_id?: string; code?: string; name?: string; balance?: number }) {
  return {
    accountId: item.account_id ?? item.code ?? item.name ?? 'demo-item',
    accountCode: item.code ?? '',
    accountName: item.name ?? 'Conta demo',
    balance: item.balance ?? 0,
  };
}

function normalizeBalanceSheet(data: BalanceSheet | BalanceSheetReportShape): BalanceSheet {
  if ('ativo' in data && 'passivo' in data && 'patrimonioLiquido' in data) {
    return data;
  }

  const report = data as BalanceSheetReportShape;
  const ativoCirculante = (report.assets?.current ?? []).map(mapBalanceItem);
  const ativoNaoCirculante = (report.assets?.non_current ?? []).map(mapBalanceItem);
  const passivoCirculante = (report.liabilities?.current ?? []).map(mapBalanceItem);
  const passivoNaoCirculante = (report.liabilities?.non_current ?? []).map(mapBalanceItem);
  const patrimonio = (report.equity?.items ?? []).map(mapBalanceItem);

  return {
    date: report.date_to ?? format(new Date(), 'yyyy-MM-dd'),
    ativo: {
      circulante: ativoCirculante,
      naoCirculante: ativoNaoCirculante,
      total: report.assets?.total ?? ativoCirculante.reduce((sum, item) => sum + item.balance, 0) + ativoNaoCirculante.reduce((sum, item) => sum + item.balance, 0),
    },
    passivo: {
      circulante: passivoCirculante,
      naoCirculante: passivoNaoCirculante,
      total: report.liabilities?.total ?? passivoCirculante.reduce((sum, item) => sum + item.balance, 0) + passivoNaoCirculante.reduce((sum, item) => sum + item.balance, 0),
    },
    patrimonioLiquido: {
      items: patrimonio,
      total: report.equity?.total ?? patrimonio.reduce((sum, item) => sum + item.balance, 0),
    },
  };
}

function normalizeDRE(data: DRE | IncomeStatementReportShape): DRE {
  if ('receitaLiquida' in data && 'lucroLiquido' in data) {
    return data;
  }

  const report = data as IncomeStatementReportShape;
  const receitaBruta = (report.revenues ?? []).map((item) => ({
    accountId: item.account_id ?? item.code ?? item.name ?? 'demo-item',
    accountCode: item.code ?? '',
    accountName: item.name ?? 'Conta demo',
    value: item.balance ?? 0,
  }));
  const grossRevenue = report.gross_revenue ?? receitaBruta.reduce((sum, item) => sum + item.value, 0);
  const totalExpenses = report.total_expenses ?? 0;
  const netIncome = report.net_income ?? 0;

  return {
    startDate: report.date_from ?? format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: report.date_to ?? format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    receitaBruta,
    deducoes: [],
    receitaLiquida: grossRevenue,
    custoVendas: 0,
    lucroBruto: grossRevenue,
    despesasOperacionais: totalExpenses > 0
      ? [{ accountId: 'demo-expenses', accountCode: '4.1', accountName: 'Despesas Operacionais', value: totalExpenses }]
      : [],
    resultadoOperacional: netIncome,
    receitasFinanceiras: 0,
    despesasFinanceiras: 0,
    resultadoAntesIR: netIncome,
    impostos: 0,
    lucroLiquido: netIncome,
  };
}

function normalizeJournalEntry(entry: JournalEntryApiShape): JournalEntry {
  return {
    id: entry.id,
    date: entry.entry_date ?? format(new Date(), 'yyyy-MM-dd'),
    description: entry.description ?? 'Lançamento demo',
    companyId: entry.companyId ?? entry.company_id ?? '',
    lines: (entry.lines ?? []).map((line, index) => ({
      id: line.id ?? `${entry.id}-line-${index + 1}`,
      accountId: line.accountId ?? line.account_id ?? '',
      accountCode: line.account_code,
      accountName: line.account_name,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      description: line.description,
    })),
    createdBy: entry.createdBy ?? entry.created_by ?? '',
    createdAt: entry.created_at ?? new Date().toISOString(),
    updatedAt: entry.updated_at,
    documentNumber: entry.reference_number,
    documentType: entry.is_posted ? (entry.reference_type ?? 'MANUAL') : undefined,
    totalDebit: entry.total_debit ?? 0,
    totalCredit: entry.total_credit ?? 0,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyDRE {
  label: string;
  receita: number;
  lucro: number;
}

interface PaginatedEntries {
  data: JournalEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const DashboardService = {
  async getCompany(companyId: string): Promise<APICompany> {
    const { data } = await api.get<{ success: boolean; data: APICompany }>(`/companies/${companyId}`);
    return data.data;
  },

  async getBalanceSheet(companyId: string): Promise<BalanceSheet> {
    const dateTo = format(new Date(), 'yyyy-MM-dd');
    const { data } = await api.get<BalanceSheet | BalanceSheetReportShape>(
      `/companies/${companyId}/reports/balance-sheet`,
      { params: { date_to: dateTo } }
    );
    return normalizeBalanceSheet(data);
  },

  async getDRE(companyId: string, dateFrom: string, dateTo: string): Promise<DRE> {
    const { data } = await api.get<DRE | IncomeStatementReportShape>(
      `/companies/${companyId}/reports/income-statement`,
      { params: { date_from: dateFrom, date_to: dateTo } }
    );
    return normalizeDRE(data);
  },

  async getRecentEntries(companyId: string, limit = 5): Promise<JournalEntry[]> {
    const { data } = await api.get<PaginatedEntries | { data: JournalEntryApiShape[] }>(
      `/companies/${companyId}/journal-entries`,
      { params: { limit, page: 1 } }
    );
    return data.data.map(normalizeJournalEntry);
  },

  /** Retorna DRE dos últimos 12 meses em paralelo — falhas retornam zeros. */
  async getDRE12Months(companyId: string): Promise<MonthlyDRE[]> {
    const today = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(today, 11 - i);
      return {
        from:  format(startOfMonth(d), 'yyyy-MM-dd'),
        to:    format(endOfMonth(d),   'yyyy-MM-dd'),
        label: format(d, "MMM'/'yy", { locale: ptBR }),
      };
    });

    const results = await Promise.allSettled(
      months.map((m) => DashboardService.getDRE(companyId, m.from, m.to))
    );

    return months.map((m, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        return {
          label:   m.label,
          receita: r.value.receitaLiquida  ?? 0,
          lucro:   r.value.lucroLiquido    ?? 0,
        };
      }
      return { label: m.label, receita: 0, lucro: 0 };
    });
  },
};
