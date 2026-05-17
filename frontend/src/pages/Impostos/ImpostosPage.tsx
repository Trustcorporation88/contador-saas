/**
 * ImpostosPage — Apuração de Impostos
 * Simples Nacional / Lucro Presumido / Lucro Real
 * UX: Melhor que QuickBooks Tax Center + Omie Fiscal (BR-specific)
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calculator, RefreshCw, CheckCircle, FileCheck, Clock, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import {
  TaxService,
  type TaxCalculationResult,
  type TaxLineResult,
  type SavedTaxCalculation,
  type CalculatePayload,
  type TaxRegime,
  type TaxStatus,
} from '../../services/taxService';

// ─── Utils ────────────────────────────────────────────────────────────────────

function brl(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function pct(n: number) {
  return (n * 100).toFixed(2) + '%';
}

const TAX_LABEL: Record<string, string> = {
  IRPJ:   'IRPJ — Imposto de Renda PJ',
  CSLL:   'CSLL — Contrib. Social s/ Lucro',
  PIS:    'PIS',
  COFINS: 'COFINS',
  ICMS:   'ICMS',
  ISS:    'ISS',
  DAS:    'DAS — Simples Nacional',
};

const REGIME_LABEL: Record<TaxRegime, string> = {
  LUCRO_REAL:      'Lucro Real',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  SIMPLES:         'Simples Nacional',
};

const STATUS_CONFIG: Record<TaxStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  PENDING:  { label: 'Pendente',  icon: <Clock className="h-3.5 w-3.5" />,      badge: 'badge badge-yellow' },
  APPROVED: { label: 'Aprovado', icon: <CheckCircle className="h-3.5 w-3.5" />, badge: 'badge badge-blue' },
  FILED:    { label: 'Recolhido', icon: <FileCheck className="h-3.5 w-3.5" />,  badge: 'badge badge-green' },
};

// ─── Tax line card ────────────────────────────────────────────────────────────

function TaxLineCard({ line }: { line: TaxLineResult }) {
  const label = TAX_LABEL[line.tax_type] ?? line.tax_type;
  const total = line.amount + (line.surcharge ?? 0);
  return (
    <div className="card p-4 flex flex-col gap-1.5">
      <div className="flex items-start justify-between">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <span className="badge badge-blue text-xs">{pct(line.rate)}</span>
      </div>
      <div className="text-xs text-gray-500">Base: R$ {brl(line.base)}</div>
      {line.surcharge && line.surcharge > 0 && (
        <div className="text-xs text-orange-600">+ Adicional IRPJ (10%): R$ {brl(line.surcharge)}</div>
      )}
      <div className="text-xl font-bold font-mono text-primary-700 mt-1">
        R$ {brl(total)}
      </div>
      {line.notes && <div className="text-xs text-gray-400">{line.notes}</div>}
    </div>
  );
}

// ─── Saved appraisals table ───────────────────────────────────────────────────

function SavedAppraisalsTable({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey:  ['tax-appraisals', companyId],
    queryFn:   () => TaxService.listAppraisals(companyId),
    staleTime: 30_000,
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaxStatus }) =>
      TaxService.updateStatus(companyId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-appraisals', companyId] }),
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 text-gray-400 py-6 justify-center">
      <RefreshCw className="h-4 w-4 animate-spin" /> Carregando apurações salvas...
    </div>
  );

  if (data.length === 0) return (
    <div className="py-10 text-center text-gray-400 text-sm">
      Nenhuma apuração salva ainda. Use o formulário acima para calcular e salvar.
    </div>
  );

  return (
    <div className="table-container">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imposto</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor (R$)</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((item: SavedTaxCalculation) => {
            const s = STATUS_CONFIG[item.status];
            const nextStatus: Record<TaxStatus, TaxStatus | null> = {
              PENDING:  'APPROVED',
              APPROVED: 'FILED',
              FILED:    null,
            };
            const next = nextStatus[item.status];
            const nextLabels: Record<string, string> = { APPROVED: 'Aprovar', FILED: 'Marcar Recolhido' };
            return (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {TAX_LABEL[item.tax_type] ?? item.tax_type}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap font-mono">
                  {format(new Date(item.period_start + 'T00:00:00'), 'MM/yyyy', { locale: ptBR })}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900 whitespace-nowrap">
                  {brl(item.calculated_amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={clsx(s.badge, 'flex items-center gap-1 justify-center w-fit mx-auto')}>
                    {s.icon} {s.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {next && (
                    <button
                      onClick={() => statusMut.mutate({ id: item.id, status: next })}
                      disabled={statusMut.isPending}
                      className="btn btn-secondary text-xs"
                    >
                      {nextLabels[next]}
                    </button>
                  )}
                  {!next && (
                    <span className="text-xs text-gray-400 italic">Concluído</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImpostosPage() {
  const { currentCompanyId } = useAuthStore();
  const qc = useQueryClient();

  // Form state
  const prevMonth = subMonths(new Date(), 1);
  const [regime, setRegime]       = useState<TaxRegime>('LUCRO_PRESUMIDO');
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(prevMonth), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd]     = useState(format(prevMonth, 'yyyy-MM-dd'));
  const [rbt12, setRbt12]         = useState('');
  const [atividade, setAtividade] = useState('servicos');
  const [issRate, setIssRate]     = useState('0.05');

  // Results
  const [result, setResult] = useState<TaxCalculationResult | null>(null);
  const [apiError, setApiError] = useState('');

  // Mutations
  const calcMut = useMutation({
    mutationFn: (save: boolean) => {
      const payload: CalculatePayload = {
        tax_regime:   regime,
        period_start: periodStart,
        period_end:   periodEnd,
        rbt12:        rbt12 ? parseFloat(rbt12.replace(/\./g, '').replace(',', '.')) : undefined,
        atividade:    regime === 'LUCRO_PRESUMIDO' ? atividade : undefined,
        iss_rate:     parseFloat(issRate) || undefined,
      };
      return save
        ? TaxService.appraisal(currentCompanyId!, payload).then(() => null)
        : TaxService.calculate(currentCompanyId!, payload);
    },
    onSuccess: (data, save) => {
      setApiError('');
      if (!save && data) setResult(data as TaxCalculationResult);
      if (save) {
        qc.invalidateQueries({ queryKey: ['tax-appraisals', currentCompanyId] });
        setResult(null);
      }
    },
    onError: (e: Error) => setApiError(e.message),
  });

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <Calculator className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500">Selecione uma empresa para apurar impostos.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary-600" />
          Apuração de Impostos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Cálculo automático de IRPJ, CSLL, PIS, COFINS, ISS — Lei 6.404/76
        </p>
      </div>

      {/* Form */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Parâmetros de Apuração</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="input-label">Regime Tributário</label>
            <select className="input-field" value={regime} onChange={(e) => setRegime(e.target.value as TaxRegime)}>
              <option value="LUCRO_REAL">Lucro Real</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="SIMPLES">Simples Nacional</option>
            </select>
          </div>
          <div>
            <label className="input-label">Período inicial</label>
            <input type="date" className="input-field" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Período final</label>
            <input type="date" className="input-field" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>

        {regime === 'SIMPLES' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="input-label">RBT12 — Receita Bruta Últimos 12 Meses (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                className="input-field"
                placeholder="0,00"
                value={rbt12}
                onChange={(e) => setRbt12(e.target.value)}
              />
            </div>
          </div>
        )}

        {regime === 'LUCRO_PRESUMIDO' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="input-label">Atividade (base de presunção)</label>
              <select className="input-field" value={atividade} onChange={(e) => setAtividade(e.target.value)}>
                <option value="comercio">Comércio / Indústria (8%)</option>
                <option value="servicos">Serviços em geral (32%)</option>
                <option value="servicos_hosp">Serviços hospitalares / Transporte (16%)</option>
                <option value="atividade_rural">Atividade rural (8%)</option>
              </select>
            </div>
            <div>
              <label className="input-label">Alíquota ISS Municipal</label>
              <select className="input-field" value={issRate} onChange={(e) => setIssRate(e.target.value)}>
                <option value="0.02">2%</option>
                <option value="0.03">3%</option>
                <option value="0.04">4%</option>
                <option value="0.05">5% (máximo)</option>
              </select>
            </div>
          </div>
        )}

        {apiError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-none mt-0.5" /> {apiError}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => calcMut.mutate(false)}
            disabled={calcMut.isPending}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Calculator className={clsx('h-4 w-4', calcMut.isPending && 'animate-spin')} />
            Simular
          </button>
          {result && (
            <button
              onClick={() => calcMut.mutate(true)}
              disabled={calcMut.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Salvar Apuração
            </button>
          )}
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Receitas',         value: result.revenues,        color: 'text-green-700' },
              { label: 'Despesas',         value: result.expenses,        color: 'text-red-600' },
              { label: 'Lucro/Prejuízo',   value: result.net_income,      color: result.net_income >= 0 ? 'text-green-700' : 'text-red-600' },
              { label: 'Carga Tributária', value: null, pct: result.effective_rate, color: 'text-primary-700' },
            ].map(({ label, value, pct: p, color }) => (
              <div key={label} className="card p-3">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={clsx('font-bold text-sm font-mono', color)}>
                  {p !== undefined ? pct(p) : `R$ ${brl(value!)}`}
                </p>
              </div>
            ))}
          </div>

          {/* Tax lines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.taxes.map((line) => (
              <TaxLineCard key={line.tax_type} line={line} />
            ))}
          </div>

          {/* Total */}
          <div className={clsx(
            'card p-4 flex items-center justify-between',
            'bg-primary-50 border-primary-200'
          )}>
            <span className="text-sm font-bold text-primary-800">TOTAL DE IMPOSTOS</span>
            <span className="text-2xl font-bold font-mono text-primary-700">
              R$ {brl(result.total_tax)}
            </span>
          </div>

          <p className="text-xs text-gray-400 text-right">
            Regime: {REGIME_LABEL[result.tax_regime]} · Período: {
              format(new Date(result.period_start + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
            } a {
              format(new Date(result.period_end + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
            }
          </p>
        </div>
      )}

      {/* Saved appraisals */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Apurações Salvas</h2>
        <SavedAppraisalsTable companyId={currentCompanyId} />
      </div>
    </div>
  );
}
