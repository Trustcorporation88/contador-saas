/**
 * Report Service
 * Geração de demonstrações financeiras conforme Lei 6.404/76
 * - Balanço Patrimonial (BP)
 * - DRE - Demonstração do Resultado do Exercício
 * - Balancete de Verificação
 * - Livro Razão (Ledger)
 */

import { getDatabase } from '../config/database';

export interface AccountBalance {
  account_id: string;
  code: string;
  name: string;
  type: string;
  parent_code?: string;
  debit_total: number;
  credit_total: number;
  balance: number;         // debit - credit (para ASSET/EXPENSE) ou credit - debit (para LIABILITY/EQUITY/REVENUE)
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
  net_income: number;     // Lucro ou Prejuízo (positivo = lucro)
}

export interface ExecutiveSummaryReport {
  company_id: string;
  date_from: string;
  date_to: string;
  generated_at: string;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  open_receivables: number;
  open_payables: number;
  overdue_receivables: number;
  overdue_payables: number;
  current_assets: number;
  current_liabilities: number;
  equity_total: number;
}

export interface CashFlowSummaryPoint {
  month: string;
  revenue: number;
  expenses: number;
  net_income: number;
}

export interface CashFlowSummaryReport {
  company_id: string;
  generated_at: string;
  months: number;
  series: CashFlowSummaryPoint[];
  totals: {
    revenue: number;
    expenses: number;
    net_income: number;
  };
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
  totals: {
    debit: number;
    credit: number;
  };
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

/**
 * ReportService - Geração de demonstrações financeiras
 */
export class ReportService {
  private static formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private static monthLabel(date: Date): string {
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  }

  private static async getContaResumo(companyId: string, tableName: 'contas_receber' | 'contas_pagar') {
    const db = await getDatabase();
    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      return { aberto: 0, vencido: 0 };
    }

    const isReceber = tableName === 'contas_receber';
    const paidColumn = isReceber ? 'valor_recebido' : 'valor_pago';
    const activeRows = await db(tableName)
      .where({ company_id: companyId, is_active: true })
      .whereNot('status', isReceber ? 'recebido' : 'pago')
      .whereNot('status', 'cancelado')
      .select('valor_original', paidColumn, 'data_vencimento');

    const hoje = new Date();

    return activeRows.reduce((acc, row: Record<string, unknown>) => {
      const aberto = Number(row.valor_original || 0) - Number(row[paidColumn] || 0);
      if (aberto <= 0) return acc;
      acc.aberto += aberto;
      if (new Date(String(row.data_vencimento)) < hoje) {
        acc.vencido += aberto;
      }
      return acc;
    }, { aberto: 0, vencido: 0 });
  }

  /**
   * Buscar saldos de contas para um período
   * Base para todos os relatórios
   */
  private static async getAccountBalances(
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    types?: string[],
    onlyPosted = true,
  ): Promise<AccountBalance[]> {
    const db = await getDatabase();

    let query = db('accounts as a')
      .leftJoin('journal_lines as jl', 'jl.account_id', 'a.id')
      .leftJoin('journal_entries as je', function () {
        this.on('je.id', 'jl.journal_entry_id').andOn('je.company_id', db.raw('?', [companyId]));
        if (onlyPosted) this.andOn('je.is_posted', db.raw('?', [true]));
        if (dateFrom) this.andOn('je.entry_date', '>=', db.raw('?', [dateFrom]));
        if (dateTo) this.andOn('je.entry_date', '<=', db.raw('?', [dateTo]));
      })
      .where('a.company_id', companyId)
      .where('a.is_active', true);

    if (types && types.length > 0) {
      query = query.whereIn('a.type', types);
    }

    const rows = await query
      .groupBy('a.id', 'a.code', 'a.name', 'a.type', 'a.parent_id')
      .orderBy('a.code', 'asc')
      .select(
        'a.id as account_id',
        'a.code',
        'a.name',
        'a.type',
        'a.parent_id',
        db.raw('COALESCE(SUM(jl.debit), 0) as debit_total'),
        db.raw('COALESCE(SUM(jl.credit), 0) as credit_total'),
      );

    return rows.map((r: Record<string, unknown>) => {
      const debit = Number(r.debit_total);
      const credit = Number(r.credit_total);
      const type = r.type as string;

      // Saldo normal por tipo de conta (lógica contábil brasileira)
      const balance = ['ASSET', 'EXPENSE'].includes(type)
        ? debit - credit
        : credit - debit;

      return {
        account_id: r.account_id as string,
        code: r.code as string,
        name: r.name as string,
        type,
        parent_code: undefined,
        debit_total: debit,
        credit_total: credit,
        balance,
      };
    });
  }

  /**
   * Balanço Patrimonial
   * Lei 6.404/76 Art. 178-186
   * Ativo = Passivo + Patrimônio Líquido
   */
  static async getBalanceSheet(
    companyId: string,
    dateTo?: string,
  ): Promise<BalanceSheetReport> {
    const balances = await this.getAccountBalances(
      companyId,
      undefined,
      dateTo,
      ['ASSET', 'LIABILITY', 'EQUITY'],
    );

    const assets = balances.filter(b => b.type === 'ASSET');
    const liabilities = balances.filter(b => b.type === 'LIABILITY');
    const equity = balances.filter(b => b.type === 'EQUITY');

    // Separar circulante / não-circulante pelo código (1.1.x = circulante, 1.2.x = não-circulante)
    const currentAssets = assets.filter(a => a.code.startsWith('1.1'));
    const nonCurrentAssets = assets.filter(a => !a.code.startsWith('1.1'));
    const currentLiabilities = liabilities.filter(l => l.code.startsWith('2.1'));
    const nonCurrentLiabilities = liabilities.filter(l => !l.code.startsWith('2.1'));

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      company_id: companyId,
      date_to: dateTo,
      generated_at: new Date().toISOString(),
      assets: {
        current: currentAssets,
        non_current: nonCurrentAssets,
        total: totalAssets,
      },
      liabilities: {
        current: currentLiabilities,
        non_current: nonCurrentLiabilities,
        total: totalLiabilities,
      },
      equity: {
        items: equity,
        total: totalEquity,
      },
      total_assets: totalAssets,
      total_liabilities_and_equity: totalLiabilitiesAndEquity,
      is_balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    };
  }

  /**
   * DRE - Demonstração do Resultado do Exercício
   * Lei 6.404/76 Art. 187
   * Lucro/Prejuízo = Receitas - Despesas
   */
  static async getIncomeStatement(
    companyId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<IncomeStatementReport> {
    const balances = await this.getAccountBalances(
      companyId,
      dateFrom,
      dateTo,
      ['REVENUE', 'EXPENSE'],
    );

    const revenues = balances.filter(b => b.type === 'REVENUE');
    const expenses = balances.filter(b => b.type === 'EXPENSE');

    const grossRevenue = revenues.reduce((s, r) => s + r.balance, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.balance, 0);
    const netIncome = grossRevenue - totalExpenses;

    return {
      company_id: companyId,
      date_from: dateFrom,
      date_to: dateTo,
      generated_at: new Date().toISOString(),
      revenues,
      expenses,
      gross_revenue: grossRevenue,
      total_expenses: totalExpenses,
      net_income: netIncome,
    };
  }

  static async getExecutiveSummary(
    companyId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<ExecutiveSummaryReport> {
    const [dre, balanco, receberResumo, pagarResumo] = await Promise.all([
      this.getIncomeStatement(companyId, dateFrom, dateTo),
      this.getBalanceSheet(companyId, dateTo),
      this.getContaResumo(companyId, 'contas_receber'),
      this.getContaResumo(companyId, 'contas_pagar'),
    ]);

    const currentAssets = balanco.assets.current.reduce((sum, item) => sum + item.balance, 0);
    const currentLiabilities = balanco.liabilities.current.reduce((sum, item) => sum + item.balance, 0);

    return {
      company_id: companyId,
      date_from: dateFrom,
      date_to: dateTo,
      generated_at: new Date().toISOString(),
      total_revenue: dre.gross_revenue,
      total_expenses: dre.total_expenses,
      net_income: dre.net_income,
      open_receivables: receberResumo.aberto,
      open_payables: pagarResumo.aberto,
      overdue_receivables: receberResumo.vencido,
      overdue_payables: pagarResumo.vencido,
      current_assets: currentAssets,
      current_liabilities: currentLiabilities,
      equity_total: balanco.equity.total,
    };
  }

  static async getCashFlowSummary(
    companyId: string,
    months = 12,
  ): Promise<CashFlowSummaryReport> {
    const safeMonths = Math.min(Math.max(months, 1), 24);
    const today = new Date();
    const monthRefs = Array.from({ length: safeMonths }, (_, index) => {
      const ref = new Date(today.getFullYear(), today.getMonth() - (safeMonths - 1 - index), 1);
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return {
        label: this.monthLabel(ref),
        dateFrom: this.formatDate(start),
        dateTo: this.formatDate(end),
      };
    });

    const dreSeries = await Promise.all(
      monthRefs.map(async (monthRef) => {
        const dre = await this.getIncomeStatement(companyId, monthRef.dateFrom, monthRef.dateTo);
        return {
          month: monthRef.label,
          revenue: dre.gross_revenue,
          expenses: dre.total_expenses,
          net_income: dre.net_income,
        };
      })
    );

    const totals = dreSeries.reduce((acc, point) => {
      acc.revenue += point.revenue;
      acc.expenses += point.expenses;
      acc.net_income += point.net_income;
      return acc;
    }, { revenue: 0, expenses: 0, net_income: 0 });

    return {
      company_id: companyId,
      generated_at: new Date().toISOString(),
      months: safeMonths,
      series: dreSeries,
      totals,
    };
  }

  /**
   * Balancete de Verificação
   * Lista todas as contas com débitos, créditos e saldo
   */
  static async getTrialBalance(
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<TrialBalanceReport> {
    const balances = await this.getAccountBalances(companyId, dateFrom, dateTo);

    const totalDebit = balances.reduce((s, b) => s + b.debit_total, 0);
    const totalCredit = balances.reduce((s, b) => s + b.credit_total, 0);

    return {
      company_id: companyId,
      date_from: dateFrom,
      date_to: dateTo,
      generated_at: new Date().toISOString(),
      items: balances.map(b => ({
        account_id: b.account_id,
        code: b.code,
        name: b.name,
        type: b.type,
        debit_total: b.debit_total,
        credit_total: b.credit_total,
        balance: b.balance,
      })),
      totals: { debit: totalDebit, credit: totalCredit },
      is_balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  /**
   * Livro Razão (Ledger) por conta
   * Lista todos os lançamentos de uma conta com saldo acumulado
   */
  static async getLedger(
    companyId: string,
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<LedgerReport> {
    const db = await getDatabase();

    // Validar conta
    const account = await db('accounts')
      .where('id', accountId)
      .where('company_id', companyId)
      .first('id', 'code', 'name', 'type');

    if (!account) {
      throw Object.assign(new Error('Conta não encontrada'), { status: 404 });
    }

    // Buscar entradas
    let query = db('journal_lines as jl')
      .join('journal_entries as je', 'je.id', 'jl.journal_entry_id')
      .where('jl.account_id', accountId)
      .where('je.company_id', companyId)
      .where('je.is_posted', true);

    if (dateFrom) query = query.where('je.entry_date', '>=', dateFrom);
    if (dateTo) query = query.where('je.entry_date', '<=', dateTo);

    const rows = await query
      .orderBy('je.entry_date', 'asc')
      .orderBy('je.created_at', 'asc')
      .select(
        'je.entry_date as date',
        'je.id as journal_entry_id',
        'je.description',
        'je.reference_number',
        'jl.debit',
        'jl.credit',
      );

    // Calcular saldo acumulado
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries: LedgerEntry[] = rows.map((r: Record<string, unknown>) => {
      const debit = Number(r.debit);
      const credit = Number(r.credit);
      totalDebit += debit;
      totalCredit += credit;

      runningBalance += ['ASSET', 'EXPENSE'].includes(account.type)
        ? debit - credit
        : credit - debit;

      return {
        date: r.date as string,
        journal_entry_id: r.journal_entry_id as string,
        description: r.description as string | undefined,
        reference_number: r.reference_number as string | undefined,
        debit,
        credit,
        running_balance: runningBalance,
      };
    });

    return {
      account_id: accountId,
      account_code: account.code,
      account_name: account.name,
      opening_balance: 0,
      entries,
      closing_balance: runningBalance,
      total_debit: totalDebit,
      total_credit: totalCredit,
    };
  }
}
