import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CircleDollarSign, FileText, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { ReportService, type ClientPeriodSummaryReport } from '../../services/reportService';

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function deltaLabel(current: number, previous: number) {
  const delta = current - previous;
  const signal = delta >= 0 ? '+' : '-';
  return `${signal}${brl(Math.abs(delta))}`;
}

function SummaryCard({
  label,
  value,
  comparison,
  positive,
}: {
  label: string;
  value: string;
  comparison: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      <p className={clsx('mt-2 text-xs font-semibold', positive === false ? 'text-red-600' : 'text-emerald-600')}>
        vs período anterior: {comparison}
      </p>
    </div>
  );
}

function AlertList({ summary }: { summary?: ClientPeriodSummaryReport }) {
  if (!summary) return null;

  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-900">Alertas do período</h2>
      </div>
      <div className="mt-4 space-y-3">
        {summary.alerts.map((alert) => (
          <div key={alert.code} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">{alert.level}</p>
            <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientePage() {
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const user = useAuthStore((state) => state.user);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(new Date().getFullYear());

  const monthlyQuery = useQuery({
    queryKey: ['reports', 'client-summary', 'monthly', currentCompanyId, period],
    queryFn: () => ReportService.getClientMonthlySummary(currentCompanyId!, period),
    enabled: !!currentCompanyId,
    staleTime: 30_000,
  });

  const annualQuery = useQuery({
    queryKey: ['reports', 'client-summary', 'annual', currentCompanyId, year],
    queryFn: () => ReportService.getClientAnnualSummary(currentCompanyId!, year),
    enabled: !!currentCompanyId,
    staleTime: 30_000,
  });

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <Wallet className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Selecione uma empresa para visualizar o resumo do cliente.</p>
      </div>
    );
  }

  const monthly = monthlyQuery.data;
  const annual = annualQuery.data;
  const isLoading = monthlyQuery.isLoading || annualQuery.isLoading;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="glass-strip flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <p className="shell-title">Portal do Cliente</p>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <FileText className="h-5 w-5 text-primary-600" />
            Cliente
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Resumo executivo mensal e anual da empresa para acompanhamento de resultado, caixa e pendências.
          </p>
        </div>
        <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Perfil ativo: <strong className="capitalize">{user?.role ?? 'viewer'}</strong>
        </div>
      </div>

      <div className="glass-strip flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5">
        <div>
          <label className="input-label">Resumo mensal</label>
          <input type="month" className="input-field" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </div>
        <div>
          <label className="input-label">Resumo anual</label>
          <input type="number" className="input-field" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} />
        </div>
        <button
          onClick={() => {
            monthlyQuery.refetch();
            annualQuery.refetch();
          }}
          className="btn btn-secondary flex items-center gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Faturamento do mês"
          value={brl(monthly?.metrics.revenue ?? 0)}
          comparison={deltaLabel(monthly?.metrics.revenue ?? 0, monthly?.comparison.revenue ?? 0)}
        />
        <SummaryCard
          label="Despesas do mês"
          value={brl(monthly?.metrics.expenses ?? 0)}
          comparison={deltaLabel(monthly?.metrics.expenses ?? 0, monthly?.comparison.expenses ?? 0)}
          positive={false}
        />
        <SummaryCard
          label="Resultado do mês"
          value={brl(monthly?.metrics.net_income ?? 0)}
          comparison={deltaLabel(monthly?.metrics.net_income ?? 0, monthly?.comparison.net_income ?? 0)}
          positive={(monthly?.metrics.net_income ?? 0) >= 0}
        />
        <SummaryCard
          label="Caixa estrutural"
          value={brl(monthly?.metrics.cash_position ?? 0)}
          comparison={deltaLabel(monthly?.metrics.cash_position ?? 0, monthly?.comparison.cash_position ?? 0)}
          positive={(monthly?.metrics.cash_position ?? 0) >= 0}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-900">Resumo mensal publicado</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Período</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{monthly?.label ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Impostos apurados</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{brl(monthly?.metrics.taxes_due ?? 0)}</p>
                <p className="mt-1 text-xs text-gray-500">Pendências: {monthly?.metrics.pending_tax_items ?? 0}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">A receber em aberto</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{brl(monthly?.metrics.open_receivables ?? 0)}</p>
                <p className="mt-1 text-xs text-red-500">Vencido: {brl(monthly?.metrics.overdue_receivables ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">A pagar em aberto</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{brl(monthly?.metrics.open_payables ?? 0)}</p>
                <p className="mt-1 text-xs text-red-500">Vencido: {brl(monthly?.metrics.overdue_payables ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-900">Resumo anual</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Faturamento</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{brl(annual?.metrics.revenue ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Despesas</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{brl(annual?.metrics.expenses ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Resultado</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{brl(annual?.metrics.net_income ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Patrimônio líquido</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{brl(annual?.metrics.equity_total ?? 0)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Comparativo com {annual?.comparison.label ?? 'período anterior'}: resultado {deltaLabel(annual?.metrics.net_income ?? 0, annual?.comparison.net_income ?? 0)}.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <AlertList summary={monthly} />
          <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-900">Leitura rápida</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Ativo circulante</span>
                <strong>{brl(monthly?.metrics.current_assets ?? 0)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Passivo circulante</span>
                <strong>{brl(monthly?.metrics.current_liabilities ?? 0)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Última atualização</span>
                <strong>{monthly?.generated_at ? new Date(monthly.generated_at).toLocaleDateString('pt-BR') : '—'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
