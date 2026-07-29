/**
 * IndicadoresPage.tsx — Principais Indicadores Financeiros
 * Setor FP&A: margens, rentabilidade, capital, estrutura, dividendos e valuation.
 * Calcula o que for possível com Balanço + DRE; mantém o catálogo educacional
 * para indicadores de mercado ainda sem dados.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Target,
  Info,
  AlertTriangle,
  TrendingUp,
  Landmark,
  PieChart,
  Coins,
  LineChart,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';
import {
  calcIndicadoresFinanceiros,
  groupIndicadoresByCategoria,
  type IndicadorCategoria,
  type IndicadorResultado,
  type IndicadorStatus,
} from '../../services/indicadoresFinanceirosService';

const STATUS_STYLE: Record<IndicadorStatus, { dot: string; text: string; label: string }> = {
  great:   { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Excelente' },
  ok:      { dot: 'bg-sky-500',     text: 'text-sky-700',     label: 'Bom' },
  warning: { dot: 'bg-amber-500',   text: 'text-amber-700',   label: 'Atenção' },
  danger:  { dot: 'bg-red-500',     text: 'text-red-700',     label: 'Crítico' },
  na:      { dot: 'bg-gray-300',    text: 'text-gray-500',    label: 'Catálogo' },
};

const CAT_ICON: Record<IndicadorCategoria, LucideIcon> = {
  margens: TrendingUp,
  rentabilidade: Target,
  capital: Landmark,
  estrutura: Shield,
  dividendos: Coins,
  valuation: LineChart,
};

function HighlightCard({ item }: { item: IndicadorResultado }) {
  const st = STATUS_STYLE[item.status];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-500/10" />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">
            Destaque
          </p>
          <h3 className="mt-1 text-base font-semibold text-gray-900">{item.nome}</h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>
      <p className="text-[clamp(1.75rem,3vw,2.4rem)] font-black tracking-[-0.04em] text-gray-900 tabular-nums">
        {item.valorFormatado}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{item.descricao}</p>
      <p className="mt-3 font-mono text-[11px] text-gray-400">{item.formula}</p>
    </div>
  );
}

function IndicatorCard({ item }: { item: IndicadorResultado }) {
  const st = STATUS_STYLE[item.status];
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white/90 p-4 transition duration-300 hover:border-primary-200 hover:shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">{item.nome}</h4>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${st.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-gray-900">{item.valorFormatado}</p>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-gray-500">{item.descricao}</p>
      <div className="mt-3 border-t border-gray-50 pt-2">
        <p className="font-mono text-[11px] text-gray-400">{item.formula}</p>
        <p className="mt-1 text-[11px] text-gray-500">
          {item.disponivel ? item.interpretacao : item.motivoIndisponivel}
        </p>
      </div>
    </div>
  );
}

export default function IndicadoresPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const [filtro, setFiltro] = useState<IndicadorCategoria | 'todos'>('todos');

  const monthStart = useMemo(() => format(new Date(), 'yyyy-MM-01'), []);
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['indicadores', 'balance', companyId],
    queryFn: () => DashboardService.getBalanceSheet(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['indicadores', 'dre', companyId, monthStart],
    queryFn: () => DashboardService.getDRE(companyId!, monthStart, today),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const indicadores = useMemo(
    () => calcIndicadoresFinanceiros({ balance: qBalance.data, dre: qDRE.data }),
    [qBalance.data, qDRE.data],
  );

  const destaques = indicadores.filter((i) => i.destaque);
  const grupos = groupIndicadoresByCategoria(indicadores);
  const gruposVisiveis =
    filtro === 'todos' ? grupos : grupos.filter((g) => g.categoria === filtro);

  const disponiveis = indicadores.filter((i) => i.disponivel).length;
  const isLoading = qBalance.isLoading || qDRE.isLoading;

  if (!companyId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="card card-body max-w-sm py-12 text-center">
          <PieChart className="mx-auto mb-4 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            Selecione uma empresa para ver os principais indicadores financeiros.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="glass-strip px-5 py-5 sm:px-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Target className="h-6 w-6 text-primary-600" />
          Principais Indicadores Financeiros
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Mapa FP&A das margens, rentabilidade, capital, estrutura financeira, dividendos e valuation —
          calculados com o Balanço e a DRE da empresa ativa.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-primary-700">
            {disponiveis}/{indicadores.length} com dados no período
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-500">
            <Info className="h-3.5 w-3.5" />
            Período DRE: {format(new Date(monthStart), 'dd/MM/yyyy')} → {format(new Date(today), 'dd/MM/yyyy')}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          {(qBalance.isError || qDRE.isError) && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Não foi possível carregar parte dos dados contábeis. Os indicadores disponíveis usam o que retornou.
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Três margens de referência</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {destaques.map((item) => (
                <HighlightCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltro('todos')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filtro === 'todos'
                  ? 'bg-ink-900 text-white'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
              }`}
            >
              Todos
            </button>
            {grupos.map(({ categoria, meta }) => {
              const Icon = CAT_ICON[categoria];
              return (
                <button
                  key={categoria}
                  type="button"
                  onClick={() => setFiltro(categoria)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    filtro === categoria
                      ? 'bg-ink-900 text-white'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.titulo}
                </button>
              );
            })}
          </div>

          {gruposVisiveis.map(({ categoria, meta, itens }) => {
            const Icon = CAT_ICON[categoria];
            return (
              <section key={categoria} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-primary-50 p-2 text-primary-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{meta.titulo}</h2>
                    <p className="text-xs text-gray-500">{meta.subtitulo}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {itens.map((item) => (
                    <IndicatorCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="rounded-2xl border border-primary-100 bg-primary-50/70 px-5 py-4">
            <p className="text-sm font-semibold text-primary-900">Como usar este setor</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-primary-800">
              <li>Margens e rentabilidade vêm da DRE e do Patrimônio Líquido do período.</li>
              <li>Estrutura de capital usa o Balanço (ativo, passivo e PL).</li>
              <li>Capex, dividendos e valuation ficam no catálogo até haver DFC completo ou cotação.</li>
              <li>Combine com Saúde Financeira e Benchmark Setorial para leitura gerencial.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
