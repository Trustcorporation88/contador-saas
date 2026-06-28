import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  FileText,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';
import { StatCard } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import DashboardHomeWidgets from './DashboardHomeWidgets';
import type { TaxRegime } from '../../services/companyService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function brl(value: number, compact = false): string {
  return new Intl.NumberFormat('pt-BR', {
    style:    'currency',
    currency: 'BRL',
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

function brlAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000)     return `R$${(value / 1_000).toFixed(0)}k`;
  return `R$${value}`;
}

const REGIME_LABELS: Record<TaxRegime, string> = {
  simples_nacional:  'Simples Nacional',
  lucro_presumido:   'Lucro Presumido',
  lucro_real:        'Lucro Real',
};

const REGIME_COLORS: Record<TaxRegime, string> = {
  simples_nacional:  'bg-green-100  text-green-700  border-green-200',
  lucro_presumido:   'bg-blue-100   text-blue-700   border-blue-200',
  lucro_real:        'bg-purple-100 text-purple-700 border-purple-200',
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function EntryStatusBadge({ posted }: { posted: boolean }) {
  return posted ? (
    <span className="badge-success text-xs">Postado</span>
  ) : (
    <span className="badge-warning text-xs">Rascunho</span>
  );
}

// ─── No company selected state ────────────────────────────────────────────────

function NoCompanyState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="card max-w-sm w-full card-body text-center py-12">
        <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-4" />
        <h2 className="font-semibold text-gray-700 mb-2">Nenhuma empresa selecionada</h2>
        <p className="text-sm text-gray-500 mb-6">
          Cadastre ou selecione uma empresa para visualizar o dashboard.
        </p>
        <Link to="/empresas" className="btn btn-primary justify-center">
          Ir para Empresas
        </Link>
      </div>
    </div>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="card card-body animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
      <div className="h-2 w-16 bg-gray-100 rounded" />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);

  // Data sources
  const todayStr     = useMemo(() => format(new Date(), 'yyyy-MM-dd'),                   []);
  const monthStart   = useMemo(() => format(new Date(), 'yyyy-MM-01'),                   []);
  const lastUpdated  = useMemo(() => format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), []);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const qCompany = useQuery({
    queryKey: ['company', companyId],
    queryFn:  () => DashboardService.getCompany(companyId!),
    enabled:  !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  const qBalance = useQuery({
    queryKey: ['dashboard', 'balance-sheet', companyId],
    queryFn:  () => DashboardService.getBalanceSheet(companyId!),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['dashboard', 'dre-month', companyId, monthStart],
    queryFn:  () => DashboardService.getDRE(companyId!, monthStart, todayStr),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qEntries = useQuery({
    queryKey: ['dashboard', 'entries', companyId],
    queryFn:  () => DashboardService.getRecentEntries(companyId!, 5),
    enabled:  !!companyId,
    staleTime: 2 * 60 * 1000,
  });

  const qChart = useQuery({
    queryKey: ['dashboard', 'dre-12m', companyId],
    queryFn:  () => DashboardService.getDRE12Months(companyId!),
    enabled:  !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  if (!companyId) return <NoCompanyState />;

  const company  = qCompany.data;
  const balance  = qBalance.data;
  const dre      = qDRE.data;
  const entries  = qEntries.data ?? [];
  const chart    = qChart.data  ?? [];

  const kpisLoading = qBalance.isLoading || qDRE.isLoading;

  // KPI values
  const receitaLiquida       = dre?.receitaLiquida       ?? 0;
  const lucroLiquido         = dre?.lucroLiquido         ?? 0;
  const resultadoOperacional = dre?.resultadoOperacional ?? 0;
  const totalAtivo           = balance?.ativo.total       ?? 0;

  const lucroPositivo       = lucroLiquido >= 0;
  const resultadoPositivo   = resultadoOperacional >= 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative space-y-6 p-4 sm:p-6 lg:p-8 pb-24">

      {/* Header */}
      <div className="glass-strip flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="shell-title">Painel · visão executiva</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
              {greeting}
              {company?.name ? `, ${company.name}` : ''}
            </h1>
            {company && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  REGIME_COLORS[company.tax_regime]
                }`}
              >
                {REGIME_LABELS[company.tax_regime]}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Resumo do negócio, indicadores e lançamentos recentes
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <Link to="/copiloto" className="btn btn-primary text-sm inline-flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Copiloto IA
          </Link>
          <p className="text-xs text-gray-400 whitespace-nowrap">
            Atualizado: {lastUpdated}
          </p>
        </div>
      </div>

      <DashboardHomeWidgets />

      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-4">
          Indicadores executivos
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpisLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Receita Líquida"
              value={brl(receitaLiquida)}
              subtitle="Mês atual"
              icon={<DollarSign className="h-5 w-5" />}
              trend={{ value: 'vs. mês anterior', positive: receitaLiquida >= 0 }}
            />
            <StatCard
              label="Lucro Líquido"
              value={brl(lucroLiquido)}
              subtitle="Mês atual"
              icon={lucroPositivo
                ? <TrendingUp   className="h-5 w-5" />
                : <TrendingDown className="h-5 w-5" />}
              trend={{ value: lucroPositivo ? 'Positivo' : 'Negativo', positive: lucroPositivo }}
            />
            <StatCard
              label="Resultado Operacional"
              value={brl(resultadoOperacional)}
              subtitle="Mês atual"
              icon={resultadoPositivo
                ? <TrendingUp   className="h-5 w-5" />
                : <TrendingDown className="h-5 w-5" />}
              trend={{ value: resultadoPositivo ? 'Operando com lucro' : 'Operando com prejuízo', positive: resultadoPositivo }}
            />
            <StatCard
              label="Total Ativo"
              value={brl(totalAtivo)}
              subtitle="Posição hoje"
              icon={<Building2 className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      {/* DRE 12 months chart */}
      <div className="card card-body">
        <div className="card-header mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">DRE — Últimos 12 Meses</h2>
            <p className="text-xs text-gray-500 mt-0.5">Receita Líquida vs. Lucro Líquido (R$)</p>
          </div>
        </div>

        {qChart.isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="h-2 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        ) : qChart.isError ? (
          <div className="h-64 flex items-center justify-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            Não foi possível carregar o gráfico
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={brlAxis}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  brl(value),
                  name === 'receita' ? 'Receita Líquida' : 'Lucro Líquido',
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                }}
              />
              <Legend
                formatter={(v) => (v === 'receita' ? 'Receita Líquida' : 'Lucro Líquido')}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="receita" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="lucro"   fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Indicadores Financeiros Avançados */}
      {!kpisLoading && (balance || dre) && (
        <div className="card card-body">
          <div className="card-header mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Indicadores Financeiros</h2>
            <p className="text-xs text-gray-500 mt-0.5">Análise de liquidez, endividamento e rentabilidade</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Liquidez Corrente */}
            {(() => {
              const sumItems = (items: { balance?: number }[] | undefined) =>
                (items ?? []).reduce((acc, i) => acc + (i.balance ?? 0), 0);
              const ativoCirc  = sumItems(balance?.ativo?.circulante);
              const passivCirc = sumItems(balance?.passivo?.circulante);
              const lc = passivCirc > 0 ? ativoCirc / passivCirc : null;
              const ok = lc !== null && lc >= 1;
              return (
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Liquidez Corrente</p>
                  <p className={`text-2xl font-bold tabular-nums ${ok ? 'text-green-600' : lc !== null ? 'text-red-500' : 'text-gray-400'}`}>
                    {lc !== null ? lc.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {lc === null ? 'Sem dados' : ok ? 'Solvência adequada' : 'Atenção: < 1,0'}
                  </p>
                </div>
              );
            })()}
            {/* Margem Líquida */}
            {(() => {
              const margem = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : null;
              const ok = margem !== null && margem >= 0;
              return (
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Margem Líquida</p>
                  <p className={`text-2xl font-bold tabular-nums ${ok ? 'text-green-600' : margem !== null ? 'text-red-500' : 'text-gray-400'}`}>
                    {margem !== null ? `${margem.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {margem === null ? 'Sem receita' : ok ? 'Resultado positivo' : 'Prejuízo no período'}
                  </p>
                </div>
              );
            })()}
            {/* Endividamento */}
            {(() => {
              const passivo    = balance?.passivo?.total ?? 0;
              const ativo      = totalAtivo;
              const endiv = ativo > 0 ? (passivo / ativo) * 100 : null;
              const ok = endiv !== null && endiv <= 60;
              return (
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Endividamento</p>
                  <p className={`text-2xl font-bold tabular-nums ${ok ? 'text-green-600' : endiv !== null ? 'text-amber-500' : 'text-gray-400'}`}>
                    {endiv !== null ? `${endiv.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {endiv === null ? 'Sem dados' : ok ? 'Nível saudável' : 'Alavancagem elevada'}
                  </p>
                </div>
              );
            })()}
            {/* Giro do Ativo */}
            {(() => {
              const giro = totalAtivo > 0 ? receitaLiquida / totalAtivo : null;
              const ok = giro !== null && giro >= 0.5;
              return (
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Giro do Ativo</p>
                  <p className={`text-2xl font-bold tabular-nums ${ok ? 'text-green-600' : giro !== null ? 'text-amber-500' : 'text-gray-400'}`}>
                    {giro !== null ? giro.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {giro === null ? 'Sem dados' : ok ? 'Eficiência adequada' : 'Baixo aproveitamento'}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Recent journal entries */}
      <div className="card card-body">
        <div className="card-header mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Últimos Lançamentos</h2>
            <p className="text-xs text-gray-500 mt-0.5">5 lançamentos mais recentes</p>
          </div>
          <Link
            to="/lancamentos"
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Ver todos →
          </Link>
        </div>

        {qEntries.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : qEntries.isError ? (
          <div className="py-8 text-center text-sm text-red-500 flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Erro ao carregar lançamentos
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Nenhum lançamento encontrado</p>
            <Link to="/lancamentos" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
              Criar primeiro lançamento
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 font-medium">Data</th>
                  <th className="pb-2 font-medium">Descrição</th>
                  <th className="pb-2 font-medium text-right">Débito</th>
                  <th className="pb-2 font-medium text-right">Crédito</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 text-gray-600 tabular-nums whitespace-nowrap">
                      {format(new Date(entry.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-800 max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-700 tabular-nums whitespace-nowrap">
                      {entry.totalDebit != null ? brl(entry.totalDebit) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-700 tabular-nums whitespace-nowrap">
                      {entry.totalCredit != null ? brl(entry.totalCredit) : '—'}
                    </td>
                    <td className="py-2.5 text-center">
                      <EntryStatusBadge posted={!!entry.documentType} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link
        to="/copiloto"
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-500/30 transition hover:scale-105"
        title="Abrir Copiloto IA"
      >
        <Bot className="h-6 w-6" />
      </Link>
    </div>
  );
}
