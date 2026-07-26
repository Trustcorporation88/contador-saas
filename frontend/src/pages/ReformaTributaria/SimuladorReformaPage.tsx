/**
 * SimuladorReformaPage.tsx — Simulador da Reforma Tributária (CBS/IBS)
 * Projeta a carga tributária da Reforma (EC 132/2023 + LC 214/2025) ano a
 * ano, de 2026 (fase de testes) a 2033 (sistema definitivo).
 *
 * O cálculo roda no backend (ReformaTributariaService), nunca duplicado
 * aqui — as alíquotas de CBS/IBS pós-2027 ainda não são fixadas por lei e
 * são atualizadas sem deploy, então o front sempre reflete o dado mais
 * recente cadastrado.
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

  const semAliquota = result.taxes.every((t) => !t.aliquota_publicada);
  const informativo = result.ano === ANO_INICIO;

  return (
    <div className={`card card-body relative ${result.ano === ANO_FIM ? 'ring-2 ring-primary-500' : ''}`}>
      {result.ano === ANO_FIM && (
        <span className="absolute -top-2.5 left-4 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full font-medium">
          Sistema definitivo
        </span>
      )}
      <p className="text-sm font-semibold text-gray-800 mb-1">{result.ano}</p>
      <p className="text-xs text-gray-500 mb-3">
        {informativo ? (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3 w-3" /> Fase de testes — sem recolhimento
          </span>
        ) : semAliquota ? (
          <span className="inline-flex items-center gap-1 text-gray-400">
            <Info className="h-3 w-3" /> Alíquota ainda não publicada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Valor devido
          </span>
        )}
      </p>

      <div className="space-y-1.5 mb-3">
        {result.taxes.map((t) => (
          <div key={t.tax_type} className="flex justify-between text-xs">
            <span className="text-gray-500">
              {t.tax_type} {t.aliquota_publicada ? `(${(t.rate * 100).toFixed(2)}%)` : ''}
            </span>
            <span className={`font-mono ${t.collectible ? 'text-red-600' : 'text-amber-600'}`}>
              {t.aliquota_publicada ? brl(t.amount) : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-gray-50 p-2.5 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Total devido</span>
          <span className="font-bold text-red-600">{brl(result.total_devido)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Total informativo</span>
          <span className="font-mono text-amber-600">{brl(result.total_informativo)}</span>
        </div>
      </div>

      {result.taxes.some((t) => t.notes) && (
        <p className="text-[11px] text-gray-400 mt-2 leading-snug">
          {result.taxes.find((t) => t.notes)?.notes}
        </p>
      )}
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
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary-600" />
          Simulador da Reforma Tributária
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Projeção de CBS/IBS de {ANO_INICIO} (fase de testes) a {ANO_FIM} (sistema definitivo) — EC 132/2023 + LC 214/2025.
          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            ✦ Exclusivo Pro Contador
          </span>
        </p>
      </div>

      {/* Controles */}
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
                <AlertTriangle className="h-3 w-3" /> Simples Nacional só entra na Reforma em 2027.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Erro */}
      {isError && (
        <div className="card card-body bg-red-50 border-red-200 text-sm text-red-700">
          Não foi possível calcular a projeção. Tente novamente em instantes.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="card card-body text-sm text-gray-500">Calculando projeção…</div>
      )}

      {/* Timeline 2026-2033 */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {data.map((r) => (
            <AnoCard key={r.ano} result={r} />
          ))}
        </div>
      )}

      {/* Resumo */}
      <div className="card card-body bg-primary-50 border-primary-100">
        <p className="text-sm font-semibold text-primary-800 mb-2">Como ler esta simulação</p>
        <ul className="text-sm text-primary-700 space-y-1 list-disc list-inside">
          <li><strong>2026</strong>: CBS/IBS calculados e destacados, mas sem recolhimento em dinheiro (compensável).</li>
          <li><strong>2027-2028</strong>: PIS/COFINS extintos, CBS cobrada de fato. IBS ainda simbólico (0,1%).</li>
          <li><strong>2029-2032</strong>: IBS substitui ICMS/ISS gradualmente.</li>
          <li><strong>2033</strong>: sistema definitivo — só CBS + IBS.</li>
        </ul>
        <p className="text-xs text-primary-600 mt-2 flex items-start gap-1">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Alíquotas de referência pós-2027 ainda dependem de cálculo anual do Comitê Gestor do IBS/Receita Federal — anos sem "—" no valor ainda não têm alíquota oficial publicada.
        </p>
      </div>
    </div>
  );
}
