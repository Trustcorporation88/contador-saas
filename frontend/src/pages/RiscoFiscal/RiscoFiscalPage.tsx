/**
 * RiscoFiscalPage.tsx — Mapa de Riscos Fiscais Pré-SPED
 * Detecta inconsistências que a Receita Federal pode questionar.
 * Motor de regras que roda sobre os dados contábeis reais.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';
import type { BalanceSheet, DRE } from '../../types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info' | 'ok';

interface RiskItem {
  id:          string;
  severity:    Severity;
  categoria:   string;
  titulo:      string;
  descricao:   string;
  recomendacao: string;
  referencia?: string;
}

// ─── Motor de regras fiscais ──────────────────────────────────────────────────

function runRiskEngine(
  balance: BalanceSheet | undefined,
  dre:     DRE         | undefined,
): RiskItem[] {
  const items: RiskItem[] = [];

  const sumItems = (arr: { balance?: number }[] | undefined) =>
    (arr ?? []).reduce((a, i) => a + (i.balance ?? 0), 0);

  const receita      = dre?.receitaLiquida    ?? 0;
  const lucro        = dre?.lucroLiquido      ?? 0;
  const custos       = dre?.custoVendas       ?? 0;
  const impostos     = dre?.impostos          ?? 0;
  const ativoTotal   = balance?.ativo?.total  ?? 0;
  const passivoTotal = balance?.passivo?.total ?? 0;
  const plTotal      = balance?.patrimonioLiquido?.total ?? 0;

  const acirculante = sumItems(balance?.ativo?.circulante);
  const pcirculante = sumItems(balance?.passivo?.circulante);

  // ── Regra 1: Patrimônio Líquido Negativo ─────────────────────────────────
  if (plTotal < 0) {
    items.push({
      id: 'PL_NEGATIVO',
      severity: 'critical',
      categoria: 'Patrimônio Líquido',
      titulo: 'Patrimônio Líquido negativo',
      descricao: `PL de ${plTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} indica que as dívidas superam os ativos.`,
      recomendacao: 'Verifique lançamentos de capital social e resultados acumulados. A Receita Federal pode solicitar explicação.',
      referencia: 'Lei 6.404/76, Art. 178',
    });
  } else if (plTotal > 0) {
    items.push({
      id: 'PL_OK',
      severity: 'ok',
      categoria: 'Patrimônio Líquido',
      titulo: 'Patrimônio Líquido positivo',
      descricao: 'A empresa possui patrimônio positivo — sinal de saúde financeira.',
      recomendacao: 'Nenhuma ação necessária.',
    });
  }

  // ── Regra 2: Custo acima de 95% da receita ───────────────────────────────
  if (receita > 0 && custos / receita > 0.95) {
    items.push({
      id: 'CUSTO_ELEVADO',
      severity: 'critical',
      categoria: 'DRE',
      titulo: 'Custo das vendas > 95% da receita',
      descricao: `Custo representa ${((custos / receita) * 100).toFixed(1)}% da receita líquida — margem bruta quase nula ou negativa.`,
      recomendacao: 'Revise o plano de contas de custos. Possível classificação incorreta de despesas operacionais como CMV.',
      referencia: 'NBC TG 16 — Estoques',
    });
  }

  // ── Regra 3: Impostos < 1% da receita (suspeita de subapuração) ──────────
  if (receita > 50_000 && impostos / receita < 0.01) {
    items.push({
      id: 'IMPOSTO_BAIXO',
      severity: 'warning',
      categoria: 'Tributação',
      titulo: 'Carga tributária abaixo de 1% da receita',
      descricao: `Impostos representam ${((impostos / receita) * 100).toFixed(2)}% da receita. Pode indicar subapuração ou ausência de provisões.`,
      recomendacao: 'Verifique se todas as obrigações fiscais (IRPJ, CSLL, PIS, COFINS) estão sendo provisionadas corretamente.',
      referencia: 'IN RFB 1700/2017',
    });
  }

  // ── Regra 4: Descasamento Ativo x Passivo + PL ───────────────────────────
  if (ativoTotal > 0 && Math.abs(ativoTotal - (passivoTotal + plTotal)) > ativoTotal * 0.01) {
    items.push({
      id: 'BALANCO_DESCASADO',
      severity: 'critical',
      categoria: 'Balanço Patrimonial',
      titulo: 'Balanço não está equilibrado',
      descricao: `Ativo (${ativoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) ≠ Passivo + PL. Diferença detectada.`,
      recomendacao: 'Localize lançamentos sem contrapartida. Nenhum SPED deve ser enviado com balanço descasado.',
      referencia: 'Lei 6.404/76, Art. 178 — partidas dobradas',
    });
  } else if (ativoTotal > 0) {
    items.push({
      id: 'BALANCO_OK',
      severity: 'ok',
      categoria: 'Balanço Patrimonial',
      titulo: 'Balanço equilibrado (partidas dobradas)',
      descricao: 'Ativo = Passivo + PL. Princípio das partidas dobradas respeitado.',
      recomendacao: 'Nenhuma ação necessária.',
    });
  }

  // ── Regra 5: Liquidez < 0.5 ──────────────────────────────────────────────
  if (pcirculante > 0 && acirculante / pcirculante < 0.5) {
    items.push({
      id: 'LIQUIDEZ_CRITICA',
      severity: 'warning',
      categoria: 'Liquidez',
      titulo: 'Liquidez corrente crítica (< 0,5)',
      descricao: `LC = ${(acirculante / pcirculante).toFixed(2)} indica risco de insolvência de curto prazo.`,
      recomendacao: 'Verifique contas a pagar vencidas e classifique corretamente as obrigações de curto vs. longo prazo.',
    });
  }

  // ── Regra 6: Resultado antes IR com sinal oposto ao IRPJ ─────────────────
  if (dre) {
    const resultadoAntes = dre.resultadoAntesIR ?? 0;
    const irpjRegistrado = dre.impostos ?? 0;
    if (resultadoAntes < 0 && irpjRegistrado > 0) {
      items.push({
        id: 'IRPJ_LUCRO_NEGATIVO',
        severity: 'warning',
        categoria: 'Tributação',
        titulo: 'IRPJ provisionado com resultado negativo',
        descricao: 'A empresa apresenta prejuízo antes do IR mas há IRPJ lançado. Pode indicar erro de provisão.',
        recomendacao: 'No Lucro Real, não há IRPJ em períodos de prejuízo. Revise os lançamentos de provisão fiscal.',
        referencia: 'Decreto 9.580/2018 — RIR',
      });
    }
  }

  // ── Regra 7: Receita zerada com ativo relevante ───────────────────────────
  if (receita === 0 && ativoTotal > 10_000) {
    items.push({
      id: 'SEM_RECEITA',
      severity: 'info',
      categoria: 'DRE',
      titulo: 'Sem receita registrada no período',
      descricao: 'A empresa possui ativos mas nenhuma receita foi lançada. Pode ser início de atividades ou ausência de lançamentos.',
      recomendacao: 'Certifique-se de que todas as notas de receita foram lançadas antes do fechamento do período.',
    });
  }

  return items;
}

// ─── Cores por severidade ─────────────────────────────────────────────────────

const SEV_CONFIG: Record<Severity, {
  icon: React.ElementType;
  iconCls: string;
  border: string;
  bg: string;
  badge: string;
  label: string;
}> = {
  critical: { icon: XCircle,      iconCls: 'text-red-500',    border: 'border-red-200',    bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',     label: 'Crítico'   },
  warning:  { icon: AlertTriangle, iconCls: 'text-amber-500', border: 'border-amber-200',  bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700', label: 'Atenção'   },
  info:     { icon: ShieldAlert,   iconCls: 'text-blue-500',  border: 'border-blue-200',   bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',   label: 'Informação'},
  ok:       { icon: CheckCircle,   iconCls: 'text-emerald-500',border: 'border-emerald-200',bg: 'bg-emerald-50',badge: 'bg-emerald-100 text-emerald-700',label: 'OK'     },
};

function RiskCard({ item }: { item: RiskItem }) {
  const cfg = SEV_CONFIG[item.severity];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border p-4 ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${cfg.iconCls}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{item.titulo}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400">{item.categoria}</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{item.descricao}</p>
          <div className="bg-white/60 rounded-lg px-3 py-2 text-xs text-gray-600">
            💡 <strong>Recomendação:</strong> {item.recomendacao}
            {item.referencia && (
              <span className="ml-2 text-gray-400">· {item.referencia}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RiscoFiscalPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const monthStart = useMemo(() => format(new Date(), 'yyyy-MM-01'), []);
  const today      = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['risco', 'balance', companyId],
    queryFn:  () => DashboardService.getBalanceSheet(companyId!),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['risco', 'dre', companyId, monthStart],
    queryFn:  () => DashboardService.getDRE(companyId!, monthStart, today),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const risks = useMemo(
    () => runRiskEngine(qBalance.data, qDRE.data),
    [qBalance.data, qDRE.data]
  );

  const criticals = risks.filter((r) => r.severity === 'critical');
  const warnings  = risks.filter((r) => r.severity === 'warning');
  const oks       = risks.filter((r) => r.severity === 'ok');
  const infos     = risks.filter((r) => r.severity === 'info');

  const isLoading = qBalance.isLoading || qDRE.isLoading;

  if (!companyId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="card card-body max-w-sm text-center py-12">
          <ShieldAlert className="mx-auto h-10 w-10 text-gray-300 mb-4" />
          <p className="text-gray-500 text-sm">Selecione uma empresa para ver o mapa de riscos fiscais.</p>
        </div>
      </div>
    );
  }

  const allClear = criticals.length === 0 && warnings.length === 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary-600" />
          Mapa de Riscos Fiscais
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Detecta inconsistências que a Receita Federal pode questionar — antes do envio do SPED.
          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            ✦ Exclusivo Pro Contador
          </span>
        </p>
      </div>

      {/* Resumo */}
      {!isLoading && (
        <div className={`card card-body flex items-center gap-4 ${allClear ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          {allClear
            ? <ShieldCheck className="h-8 w-8 text-emerald-500 flex-shrink-0" />
            : <ShieldAlert  className="h-8 w-8 text-amber-500 flex-shrink-0" />
          }
          <div>
            <p className={`font-semibold ${allClear ? 'text-emerald-800' : 'text-amber-800'}`}>
              {allClear
                ? 'Empresa sem riscos críticos identificados'
                : `${criticals.length} crítico(s) · ${warnings.length} atenção · ${oks.length} verificados`
              }
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {risks.length} regras verificadas · {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          </div>
        </div>
      )}

      {/* Riscos */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card card-body h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {[...criticals, ...warnings, ...infos, ...oks].map((r) => (
            <RiskCard key={r.id} item={r} />
          ))}
        </div>
      )}

      {/* Nota metodológica */}
      <div className="card card-body bg-gray-50 border-dashed text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600">Sobre este diagnóstico</p>
        <p>As verificações são baseadas nas regras da Lei 6.404/76, NBC TG, IN RFB 1700/2017 e Decreto 9.580/2018.</p>
        <p>Este relatório é informativo. Consulte sempre um profissional contábil habilitado antes do envio do SPED.</p>
      </div>
    </div>
  );
}
