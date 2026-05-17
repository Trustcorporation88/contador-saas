import api from '../config/api';
import type { BalanceSheet, DRE, JournalEntry, Company } from '../types';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  async getCompany(companyId: string): Promise<Company> {
    const { data } = await api.get<Company>(`/companies/${companyId}`);
    return data;
  },

  async getBalanceSheet(companyId: string): Promise<BalanceSheet> {
    const dateTo = format(new Date(), 'yyyy-MM-dd');
    const { data } = await api.get<BalanceSheet>(
      `/companies/${companyId}/reports/balance-sheet`,
      { params: { date_to: dateTo } }
    );
    return data;
  },

  async getDRE(companyId: string, dateFrom: string, dateTo: string): Promise<DRE> {
    const { data } = await api.get<DRE>(
      `/companies/${companyId}/reports/income-statement`,
      { params: { date_from: dateFrom, date_to: dateTo } }
    );
    return data;
  },

  async getRecentEntries(companyId: string, limit = 5): Promise<JournalEntry[]> {
    const { data } = await api.get<PaginatedEntries>(
      `/companies/${companyId}/journal-entries`,
      { params: { limit, page: 1 } }
    );
    return data.data;
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
