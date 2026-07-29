/**
 * SimuladorReformaPage.tsx — Simulador da Reforma Tributária (CBS/IBS)
 * Projeta a carga tributária da Reforma (EC 132/2023 + LC 214/2025) ano a
 * ano, de 2026 (fase de testes) a 2033 (sistema definitivo).
 *
 * Alíquotas: cadastro oficial no backend quando existir; caso contrário,
 * referência de mercado (CBS ~8,8% / IBS ~17,7% cheio) alinhada ao cronograma
 * legal e a benchmarks públicos — até o Senado fixar as alíquotas anuais.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  ReformaTributariaService,
  type ReformaCalculationResult,
} from '../../services/reformaTributariaService';
import type { TaxRegime } from '../../services/taxService';

const ANO_INICIO = 2026;
const ANO_FIM = 2033;

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(2).replace('.', ',')}%`;
}

function totalAno(r: ReformaCalculationResult) {
  return r.total_devido + r.total_informativo;
}

// ─── Card de um ano da projeção ────────────────────────────────────────────────

function AnoCard({ result }: { result: ReformaCalculationResult }) {
  if (!result.applicable) {
    return (
      <div className="card card-body opacity-60">
        <p className="text-sm font-semibold text-gray-500">{result.ano}</p>
        <p className="text-xs text-gray-400 mt-2">{result.motivo_nao_aplicavel}</p>
      </div>
    );
  }

  const informativo = result.ano === ANO_INICIO;
  const usaReferencia = result.taxes.some((t) => t.fonte_aliquota === 'REFERENCIA_MERCADO');

  return (
    <div className={`card card-body relative ${result.ano === ANO_FIM ? 'ring-2 ring-primary-500' : ''}`}>
      {result.ano === ANO_FIM && (
        <span className="absolute -top-2.5 left-4 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full font-medium">
          Sistema definitivo
        </span>
      )}
      <p className="text-sm font-semibold text-gray-800 mb-1">{result.ano}</p>
      <p className="text-xs text-gray-500 mb-1">{result.fase}</p>
      <p className="text-xs text-gray-500 mb-3">
        {informativo ? (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3 w-3" /> Fase de testes — sem recolhimento
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Valor devido
            {usaReferencia ? ' (ref. mercado)' : ''}
          </span>
        )}
      </p>

      <div className="space-y-1.5 mb-3">
        {result.taxes.map((t) => (
          <div key={t.tax_type} className="flex justify-between text-xs">
            <span className="text-gray-500">
              {t.tax_type} {t.aliquota_publicada ? `(${pct(t.rate)})` : ''}
            </span>
            <span className={`font-mono ${t.collectible ? 'text-red-600' : 'text-amber-600'}`}>
              {t.aliquota_publicada ? brl(t.amount) : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-gray-50 p-2.5 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Alíquota efetiva</span>
          <span className="font-mono text-gray-800">{pct(result.aliquota_efetiva ?? 0)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Total devido</span>
          <span className="font-bold text-red-600">{brl(result.total_devido)}</span>
        </div>
        {result.total_informativo > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Total informativo</span>
            <span className="font-mono text-amber-600">{brl(result.total_informativo)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineTable({ data }: { data: ReformaCalculationResult[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3 font-medium">Ano</th>
            <th className="px-4 py-3 font-medium">Fase</th>
            <th className="px-4 py-3 font-medium text-right">CBS</th>
            <th className="px-4 py-3 font-medium text-right">IBS</th>
            <th className="px-4 py-3 font-medium text-right">Efetiva</th>
            <th className="px-4 py-3 font-medium text-right">Total</th>
            <th className="px-4 py-3 font-medium text-right">ICMS/ISS legado</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const cbs = r.taxes.find((t) => t.tax_type === 'CBS');
            const ibs = r.taxes.find((t) => t.tax_type === 'IBS');
            if (!r.applicable) {
              return (
                <tr key={r.ano} className="border-b border-gray-50 text-gray-400">
                  <td className="px-4 py-3 font-medium">{r.ano}</td>
                  <td className="px-4 py-3 text-xs" colSpan={6}>{r.motivo_nao_aplicavel}</td>
                </tr>
              );
            }
            const legado =
              r.percentual_icms_iss_legado !== undefined
                ? pct(r.percentual_icms_iss_legado)
                : r.ano < 2029
                  ? '100%'
                  : '—';
            return (
              <tr
                key={r.ano}
                className={`border-b border-gray-50 ${r.ano === ANO_FIM ? 'bg-primary-50/40' : ''}`}
              >
                <td className="px-4 py-3 font-semibold text-gray-900">{r.ano}</td>
                <td className="px-4 py-3 text-xs text-gray-600 max-w-[12rem]">{r.fase}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {cbs?.aliquota_publicada ? pct(cbs.rate) : '—'}
                  <div className="text-[11px] text-gray-400">{cbs?.aliquota_publicada ? brl(cbs.amount) : ''}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {ibs?.aliquota_publicada ? pct(ibs.rate) : '—'}
                  <div className="text-[11px] text-gray-400">{ibs?.aliquota_publicada ? brl(ibs.amount) : ''}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">{pct(r.aliquota_efetiva ?? 0)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">
                  {brl(totalAno(r))}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">{legado}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SimuladorReformaPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId) || '';
  const [receita, setReceita] = useState(100_000);
  const [regime, setRegime] = useState<TaxRegime>('LUCRO_PRESUMIDO');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reforma-projecao', companyId, regime, receita],
    queryFn: () =>
      ReformaTributariaService.projetar(companyId, {
        ano_inicio: ANO_INICIO,
        ano_fim: ANO_FIM,
        tax_regime: regime,
        revenues: receita,
      }),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const definitivo = data?.find((r) => r.ano === ANO_FIM && r.applicable);

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="card card-body text-sm text-gray-600">
          Selecione uma empresa para simular a Reforma Tributária.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary-600" />
          Simulador da Reforma Tributária
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Projeção de CBS/IBS de {ANO_INICIO} a {ANO_FIM} — EC 132/2023 + LC 214/2025.
          Referência de mercado: CBS 8,8% + IBS 17,7% = 26,5% no sistema definitivo.
        </p>
      </div>

      <div className="card card-body">
        <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-gray-400" />
          Ajuste os parâmetros para simular a transição da reforma
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="input-label">
              Receita mensal: <strong>{brl(receita)}</strong>
            </label>
            <input
              type="range"
              min={10_000} max={4_800_000} step={10_000}
              value={receita}
              onChange={(e) => setReceita(Number(e.target.value))}
              className="w-full accent-primary-600 mt-1"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>R$10k</span><span>R$4,8M</span>
            </div>
          </div>

          <div>
            <label className="input-label">Regime tributário atual</label>
            <select
              value={regime}
              onChange={(e) => setRegime(e.target.value as TaxRegime)}
              className="input-field mt-1"
            >
              <option value="SIMPLES">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
            </select>
            {regime === 'SIMPLES' && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Simples: fora da fase de testes em 2026; a partir de 2027 entra no novo modelo (projeção CBS/IBS — não é o DAS por anexo).
              </p>
            )}
          </div>
        </div>

        {definitivo && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs text-gray-500">Carga em 2033 (definitivo)</p>
              <p className="text-lg font-semibold text-gray-900">{brl(totalAno(definitivo))}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Alíquota efetiva 2033</p>
              <p className="text-lg font-semibold text-gray-900">{pct(definitivo.aliquota_efetiva ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Composição</p>
              <p className="text-sm font-medium text-gray-800">CBS 8,80% + IBS 17,70%</p>
            </div>
          </div>
        )}
      </div>

      {isError && (
        <div className="card card-body bg-red-50 border-red-200 text-sm text-red-700">
          Não foi possível calcular a projeção. Tente novamente em instantes.
        </div>
      )}

      {isLoading && (
        <div className="card card-body text-sm text-gray-500">Calculando projeção…</div>
      )}

      {data && (
        <>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Cronograma 2026–2033</h2>
            <TimelineTable data={data} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data.map((r) => (
              <AnoCard key={r.ano} result={r} />
            ))}
          </div>
        </>
      )}

      <div className="card card-body bg-primary-50 border-primary-100">
        <p className="text-sm font-semibold text-primary-800 mb-2">Como ler esta simulação</p>
        <ul className="text-sm text-primary-700 space-y-1 list-disc list-inside">
          <li><strong>2026</strong>: CBS 0,9% + IBS 0,1% — destacados e compensáveis; Sem recolhimento em dinheiro. Simples fora.</li>
          <li><strong>2027–2028</strong>: PIS/COFINS extintos; CBS cobrada (~8,8% ref.); IBS ainda 0,1%; IPI→0 (exc. ZFM); IS inicia.</li>
          <li><strong>2029–2032</strong>: IBS sobe 10/20/30/40% da alíquota cheia; ICMS/ISS caem para 90/80/70/60%.</li>
          <li><strong>2033</strong>: sistema definitivo — CBS + IBS ≈ 26,5%; ICMS/ISS extintos.</li>
        </ul>
        <p className="text-xs text-primary-600 mt-2 flex items-start gap-1">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Alíquotas pós-2026 usam referência de mercado até o Senado publicar a resolução anual (TCU / Comitê Gestor). Cadastros em reforma_aliquotas_anuais sobrescrevem o fallback.
        </p>
      </div>
    </div>
  );
}
