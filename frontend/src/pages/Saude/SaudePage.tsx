/**
 * SaudePage.tsx — Score de Saúde Financeira
 * Funcionalidade INÉDITA no mundo: score 0–1000 calculado em tempo real
 * a partir dos dados contábeis reais da empresa.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';
import { calcHealthScore, type HealthDimension } from '../../services/healthScoreService';

// ─── Score Ring (SVG) ─────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 80;
  const stroke = 14;
  const circumference = 2 * Math.PI * R;
  const progress = (score / 1000) * circumference;

  return (
    <svg width={200} height={200} className="mx-auto -rotate-90">
      <circle
        cx={100} cy={100} r={R}
        fill="none" stroke="#e5e7eb" strokeWidth={stroke}
      />
      <circle
        cx={100} cy={100} r={R}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${progress} ${circumference - progress}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  );
}

// ─── Barra de dimensão ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<HealthDimension['status'], string> = {
  great:   'bg-emerald-500',
  ok:      'bg-blue-500',
  warning: 'bg-amber-400',
  danger:  'bg-red-500',
};

const STATUS_BADGE: Record<HealthDimension['status'], { label: string; cls: string }> = {
  great:   { label: 'Excelente', cls: 'bg-emerald-100 text-emerald-700' },
  ok:      { label: 'Bom',       cls: 'bg-blue-100 text-blue-700'       },
  warning: { label: 'Atenção',   cls: 'bg-amber-100 text-amber-700'     },
  danger:  { label: 'Crítico',   cls: 'bg-red-100 text-red-700'         },
};

function DimensionCard({ dim }: { dim: HealthDimension }) {
  const pct = Math.round((dim.score / dim.maxScore) * 100);
  const bar = STATUS_COLORS[dim.status];
  const badge = STATUS_BADGE[dim.status];

  return (
    <div className="card card-body">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{dim.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{dim.value}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${bar} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3 flex-shrink-0" />
          {dim.description}
        </span>
        <span className="font-mono font-medium ml-2 whitespace-nowrap">
          {dim.score}/{dim.maxScore}
        </span>
      </div>
    </div>
  );
}

// ─── Recomendações automáticas ────────────────────────────────────────────────

function Recommendations({ dims }: { dims: HealthDimension[] }) {
  const issues = dims.filter((d) => d.status === 'danger' || d.status === 'warning');
  const greats = dims.filter((d) => d.status === 'great');

  if (issues.length === 0 && greats.length > 0) {
    return (
      <div className="card card-body flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-gray-800">Empresa em ótima forma</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Todos os indicadores estão dentro dos parâmetros ideais. Continue monitorando mensalmente.
          </p>
        </div>
      </div>
    );
  }

  const tips: Record<string, string> = {
    'Liquidez Corrente': 'Reduza passivo circulante antecipando pagamentos de longo prazo ou aumente o caixa disponível.',
    'Rentabilidade': 'Revise a estrutura de custos. Uma redução de 5% nas despesas pode dobrar a margem líquida.',
    'Endividamento': 'Considere renegociar dívidas de curto para longo prazo e evite novos financiamentos.',
    'Eficiência Operacional': 'Aumente a receita sem aumentar proporcionalmente os ativos — revise precificação.',
  };

  return (
    <div className="card card-body space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-gray-800">Recomendações O Contador</p>
      </div>
      {issues.map((d) => (
        <div key={d.label} className="flex items-start gap-3 py-2 border-t border-gray-100 first:border-0 first:pt-0">
          <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${STATUS_COLORS[d.status]}`} />
          <div>
            <p className="text-sm font-medium text-gray-700">{d.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{tips[d.label] ?? d.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SaudePage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);

  const monthStart = useMemo(() => format(new Date(), 'yyyy-MM-01'), []);
  const today      = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['saude', 'balance', companyId],
    queryFn:  () => DashboardService.getBalanceSheet(companyId!),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['saude', 'dre', companyId, monthStart],
    queryFn:  () => DashboardService.getDRE(companyId!, monthStart, today),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const hs = useMemo(
    () => calcHealthScore(qBalance.data, qDRE.data),
    [qBalance.data, qDRE.data]
  );

  const isLoading = qBalance.isLoading || qDRE.isLoading;

  if (!companyId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="card card-body max-w-sm text-center py-12">
          <Activity className="mx-auto h-10 w-10 text-gray-300 mb-4" />
          <p className="text-gray-500 text-sm">Selecione uma empresa para ver o score de saúde.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary-600" />
          Score de Saúde Financeira
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Diagnóstico automático da saúde financeira da sua empresa — atualizado a cada lançamento.
          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            ✦ Exclusivo O Contador
          </span>
        </p>
      </div>

      {/* Score principal */}
      {isLoading ? (
        <div className="card card-body animate-pulse h-64" />
      ) : (
        <div className={`card card-body ${hs.bgColor} border-0`}>
          <div className="flex flex-col sm:flex-row items-center gap-8">

            {/* Ring + número */}
            <div className="relative flex-shrink-0">
              <ScoreRing score={hs.total} color={hs.ringColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-black tabular-nums ${hs.color}`}>
                  {hs.total}
                </span>
                <span className={`text-xs font-semibold ${hs.color} opacity-70`}>de 1.000</span>
              </div>
            </div>

            {/* Grade + label + mini-barras */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-4xl font-black ${hs.color}`}>{hs.grade}</span>
                <span className={`text-lg font-semibold ${hs.color}`}>{hs.label}</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Calculado em {format(new Date(hs.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {' · '}Baseado em Balanço Patrimonial + DRE do período
              </p>

              {/* Mini sumário das 4 dimensões */}
              <div className="space-y-2">
                {hs.dimensions.map((d) => (
                  <div key={d.label} className="flex items-center gap-2 text-xs">
                    <span className="w-36 text-gray-600 truncate">{d.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[d.status]}`}
                        style={{ width: `${(d.score / d.maxScore) * 100}%`, transition: 'width 0.8s ease' }}
                      />
                    </div>
                    <span className="font-mono w-12 text-right text-gray-500">{d.score}/250</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Dimensões detalhadas */}
      {!isLoading && (
        <>
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Detalhamento por Dimensão
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hs.dimensions.map((d) => (
                <DimensionCard key={d.label} dim={d} />
              ))}
            </div>
          </div>

          {/* Recomendações */}
          <Recommendations dims={hs.dimensions} />

          {/* Metodologia */}
          <div className="card card-body bg-gray-50 border-dashed">
            <p className="text-xs font-semibold text-gray-600 mb-2">Como o Score é calculado</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div>📊 <strong>Liquidez Corrente</strong> (250 pts) — AC ÷ PC</div>
              <div>💰 <strong>Rentabilidade</strong> (250 pts) — Margem Líquida + ROA</div>
              <div>🏦 <strong>Endividamento</strong> (250 pts) — Passivo ÷ Ativo</div>
              <div>⚙️ <strong>Eficiência</strong> (250 pts) — Giro do Ativo</div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Baseado em indicadores clássicos da análise de balanços (Matarazzo, 2010) adaptados para PMEs brasileiras.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
