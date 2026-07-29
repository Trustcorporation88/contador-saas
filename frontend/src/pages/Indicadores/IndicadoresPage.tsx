/**
 * IndicadoresPage.tsx — Principais Indicadores e Skills
 * Aba 1: KPIs FP&A calculados (Balanço + DRE)
 * Aba 2: Catálogo educacional Skills (fundamentos + demonstrações + gestão)
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
  BookOpen,
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
import {
  SKILLS_CONTABEIS,
  SKILL_CATEGORIA_META,
  SKILLS_TOTAL,
  INDICES_CLASSICOS,
  CST_IBS_CBS,
  type SkillItem,
  type SkillCategoria,
} from '../../services/skillsContabeisCatalog';

type Aba = 'kpis' | 'skills';

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
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">Destaque</p>
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

function SkillDetail({ skill }: { skill: SkillItem }) {
  const cat = SKILL_CATEGORIA_META[skill.categoria];
  return (
    <div className="space-y-5 rounded-2xl border border-gray-100 bg-white/95 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
            Skill {String(skill.numero).padStart(2, '0')} de {SKILLS_TOTAL}
          </p>
          <h3 className="mt-1 text-xl font-bold text-gray-900">{skill.titulo}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${cat.cor}`}>
          {cat.titulo}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Definição</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">{skill.definicao}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Objetivo</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">{skill.objetivo}</p>
        </div>
      </div>

      {(skill.baseLegal || skill.formula) && (
        <div className="flex flex-wrap gap-3 text-xs">
          {skill.baseLegal && (
            <span className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-gray-600">
              <strong className="text-gray-800">Base:</strong> {skill.baseLegal}
            </span>
          )}
          {skill.formula && (
            <span className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 font-mono text-primary-800">
              {skill.formula}
            </span>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Pontos-chave</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {skill.pontos.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {skill.exemplo && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800">Exemplo prático</p>
          <p className="mt-1 text-sm text-amber-900">{skill.exemplo}</p>
        </div>
      )}

      {skill.lancamento && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 font-mono text-sm">
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-gray-400">
            Lançamento contábil
          </p>
          <p><span className="text-emerald-700">D</span> — {skill.lancamento.debito}</p>
          <p><span className="text-rose-700">C</span> — {skill.lancamento.credito}</p>
          {skill.lancamento.historico && (
            <p className="mt-2 font-sans text-xs text-gray-500">{skill.lancamento.historico}</p>
          )}
        </div>
      )}

      {skill.numero === 15 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Índice</th>
                <th className="px-3 py-2">Fórmula</th>
              </tr>
            </thead>
            <tbody>
              {INDICES_CLASSICOS.map((i) => (
                <tr key={i.nome} className="border-b border-gray-50">
                  <td className="px-3 py-2 text-gray-500">{i.grupo}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{i.nome}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{i.formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {skill.numero === 16 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {CST_IBS_CBS.map((c) => (
            <div
              key={c.codigo}
              className="flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-2"
            >
              <span className="rounded-lg bg-teal-800 px-2 py-1 font-mono text-xs font-bold text-white">
                {c.codigo}
              </span>
              <span className="text-sm text-teal-900">{c.descricao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillsPanel() {
  const [selected, setSelected] = useState(1);
  const [filtroCat, setFiltroCat] = useState<SkillCategoria | 'todos'>('todos');
  const skill = SKILLS_CONTABEIS.find((s) => s.numero === selected)!;

  const lista =
    filtroCat === 'todos'
      ? SKILLS_CONTABEIS
      : SKILLS_CONTABEIS.filter((s) => s.categoria === filtroCat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFiltroCat('todos')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            filtroCat === 'todos' ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
          }`}
        >
          Todos ({SKILLS_TOTAL})
        </button>
        {(Object.keys(SKILL_CATEGORIA_META) as SkillCategoria[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFiltroCat(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filtroCat === c ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            {SKILL_CATEGORIA_META[c].titulo}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <div className="max-h-[70vh] space-y-1 overflow-y-auto rounded-2xl border border-gray-100 bg-white/80 p-2">
          {lista.map((s) => (
            <button
              key={s.numero}
              type="button"
              onClick={() => setSelected(s.numero)}
              className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                selected === s.numero
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className={`mt-0.5 font-mono text-xs font-bold ${selected === s.numero ? 'text-primary-100' : 'text-gray-400'}`}>
                {String(s.numero).padStart(2, '0')}
              </span>
              <span className="text-sm font-medium leading-snug">{s.titulo}</span>
            </button>
          ))}
        </div>
        <SkillDetail skill={skill} />
      </div>
    </div>
  );
}

function KpisPanel({
  companyId,
}: {
  companyId: string;
}) {
  const [filtro, setFiltro] = useState<IndicadorCategoria | 'todos'>('todos');
  const monthStart = useMemo(() => format(new Date(), 'yyyy-MM-01'), []);
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['indicadores', 'balance', companyId],
    queryFn: () => DashboardService.getBalanceSheet(companyId),
    staleTime: 5 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['indicadores', 'dre', companyId, monthStart],
    queryFn: () => DashboardService.getDRE(companyId, monthStart, today),
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

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(qBalance.isError || qDRE.isError) && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Não foi possível carregar parte dos dados contábeis. Os indicadores disponíveis usam o que retornou.
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-primary-700">
          {disponiveis}/{indicadores.length} com dados no período
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-500">
          <Info className="h-3.5 w-3.5" />
          DRE: {format(new Date(monthStart), 'dd/MM/yyyy')} → {format(new Date(today), 'dd/MM/yyyy')}
        </span>
      </div>

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
            filtro === 'todos' ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
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
                filtro === categoria ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
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
    </div>
  );
}

export default function IndicadoresPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const [aba, setAba] = useState<Aba>('skills');

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="glass-strip px-5 py-5 sm:px-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Target className="h-6 w-6 text-primary-600" />
          Principais Indicadores e Skills
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Catálogo educacional com {SKILLS_TOTAL} skills contábeis e KPIs FP&A (Margem Bruta, Margem EBITDA, Margem FCL) calculados com o Balanço e a DRE.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAba('skills')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              aba === 'skills' ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Skills 1–{SKILLS_TOTAL}
          </button>
          <button
            type="button"
            onClick={() => setAba('kpis')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              aba === 'kpis' ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            <PieChart className="h-4 w-4" />
            Indicadores calculados
          </button>
        </div>
      </div>

      {aba === 'skills' && <SkillsPanel />}

      {aba === 'kpis' && (
        !companyId ? (
          <div className="card card-body max-w-sm py-12 text-center">
            <PieChart className="mx-auto mb-4 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              Selecione uma empresa para calcular os indicadores financeiros.
            </p>
          </div>
        ) : (
          <KpisPanel companyId={companyId} />
        )
      )}
    </div>
  );
}
