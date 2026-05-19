import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { ReportService, downloadBlob } from '../../services/reportService';

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function brlAxis(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$${(value / 1_000).toFixed(0)}k`;
  return `R$${value}`;
}

export default function FluxoCaixaPage() {
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [months, setMonths] = useState(12);
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['reports', 'executive-summary', currentCompanyId, dateFrom, dateTo],
    queryFn: () => ReportService.getExecutiveSummary(currentCompanyId!, dateFrom, dateTo),
    enabled: !!currentCompanyId,
    staleTime: 30_000,
  });

  const cashFlowQuery = useQuery({
    queryKey: ['reports', 'cash-flow-summary', currentCompanyId, months],
    queryFn: () => ReportService.getCashFlowSummary(currentCompanyId!, months),
    enabled: !!currentCompanyId,
    staleTime: 30_000,
  });

  const handleExport = async (
    type: 'balance-sheet' | 'income-statement',
    fmt: 'xlsx' | 'pdf'
  ) => {
    if (!currentCompanyId) return;
    const key = `${type}-${fmt}`;
    setExportLoading(key);
    try {
      const blob = await ReportService.exportReport(
        type,
        currentCompanyId,
        type === 'income-statement'
          ? { date_from: dateFrom, date_to: dateTo }
          : { date_to: dateTo },
        fmt
      );
      const label = type === 'income-statement' ? `dre-${dateFrom}_${dateTo}` : `balanco-${dateTo}`;
      downloadBlob(blob, `${label}.${fmt}`);
    } finally {
      setExportLoading(null);
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <Wallet className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Selecione uma empresa para visualizar o fluxo de caixa.</p>
      </div>
    );
  }

  const summary = summaryQuery.data;
  const chart = cashFlowQuery.data;
  const isLoading = summaryQuery.isLoading || cashFlowQuery.isLoading;
  const netPositive = (summary?.net_income ?? 0) >= 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="glass-strip flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <p className="shell-title">Prioridade 5</p>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            Fluxo de Caixa + Relatórios Básicos
          </h1>
          <p className="mt-1 text-sm text-gray-500">Visão simples de entradas, saídas, saldo do período e atalhos para DRE e Balanço.</p>
        </div>
      </div>

      <div className="glass-strip flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5">
        <div>
          <label className="input-label">Período inicial</label>
          <input type="date" className="input-field" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </div>
        <div>
          <label className="input-label">Período final</label>
          <input type="date" className="input-field" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <div>
          <label className="input-label">Meses no gráfico</label>
          <select className="input-field" value={months} onChange={(event) => setMonths(Number(event.target.value))}>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
            <option value={18}>18 meses</option>
            <option value={24}>24 meses</option>
          </select>
        </div>
        <button onClick={() => { summaryQuery.refetch(); cashFlowQuery.refetch(); }} className="btn btn-secondary flex items-center gap-2" disabled={isLoading}>
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Receita total</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{brl(summary?.total_revenue ?? 0)}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Despesa total</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{brl(summary?.total_expenses ?? 0)}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            {netPositive ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Saldo do período</p>
          </div>
          <p className={clsx('mt-3 text-3xl font-bold', netPositive ? 'text-green-700' : 'text-red-700')}>{brl(summary?.net_income ?? 0)}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Caixa estrutural</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{brl((summary?.current_assets ?? 0) - (summary?.current_liabilities ?? 0))}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="card card-body min-h-[380px]">
          <div className="card-header mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Fluxo mensal</h2>
              <p className="text-xs text-gray-500 mt-0.5">Entradas vs saídas com resultado líquido por mês</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-[280px] items-center justify-center text-gray-400">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Consolidando fluxo...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chart?.series ?? []} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tickFormatter={brlAxis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip
                  formatter={(value: number, name: string) => [brl(value), name === 'revenue' ? 'Entradas' : name === 'expenses' ? 'Saídas' : 'Saldo']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend formatter={(value) => value === 'revenue' ? 'Entradas' : value === 'expenses' ? 'Saídas' : 'Saldo'} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="net_income" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">A receber em aberto</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{brl(summary?.open_receivables ?? 0)}</p>
            <p className="mt-2 text-xs text-red-500">Vencido: {brl(summary?.overdue_receivables ?? 0)}</p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">A pagar em aberto</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{brl(summary?.open_payables ?? 0)}</p>
            <p className="mt-2 text-xs text-red-500">Vencido: {brl(summary?.overdue_payables ?? 0)}</p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Relatórios básicos</p>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <div className="flex items-center justify-between"><span>Ativo circulante</span><strong>{brl(summary?.current_assets ?? 0)}</strong></div>
              <div className="flex items-center justify-between"><span>Passivo circulante</span><strong>{brl(summary?.current_liabilities ?? 0)}</strong></div>
              <div className="flex items-center justify-between"><span>Patrimônio líquido</span><strong>{brl(summary?.equity_total ?? 0)}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-strip px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-secondary flex items-center gap-2 text-sm" disabled={!!exportLoading} onClick={() => handleExport('income-statement', 'xlsx')}>
            <Download className="h-4 w-4" />
            {exportLoading === 'income-statement-xlsx' ? 'Gerando...' : 'DRE XLSX'}
          </button>
          <button className="btn btn-secondary flex items-center gap-2 text-sm" disabled={!!exportLoading} onClick={() => handleExport('income-statement', 'pdf')}>
            <Download className="h-4 w-4" />
            {exportLoading === 'income-statement-pdf' ? 'Gerando...' : 'DRE PDF'}
          </button>
          <button className="btn btn-secondary flex items-center gap-2 text-sm" disabled={!!exportLoading} onClick={() => handleExport('balance-sheet', 'xlsx')}>
            <Download className="h-4 w-4" />
            {exportLoading === 'balance-sheet-xlsx' ? 'Gerando...' : 'Balanço XLSX'}
          </button>
          <button className="btn btn-secondary flex items-center gap-2 text-sm" disabled={!!exportLoading} onClick={() => handleExport('balance-sheet', 'pdf')}>
            <Download className="h-4 w-4" />
            {exportLoading === 'balance-sheet-pdf' ? 'Gerando...' : 'Balanço PDF'}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Período ativo: {format(new Date(`${dateFrom}T00:00:00`), 'dd/MM/yyyy', { locale: ptBR })} até {format(new Date(`${dateTo}T00:00:00`), 'dd/MM/yyyy', { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}