/**
 * SimuladorPage.tsx — Simulador de Cenários Fiscais
 * "E se eu faturar R$X a mais?" / "E se eu mudar de regime?"
 * Mostra impacto fiscal em tempo real. INÉDITO no Brasil.
 */
import { useState, useMemo } from 'react';
import { Sliders, TrendingUp, TrendingDown, Info } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface TaxResult {
  regime:         string;
  receita:        number;
  despesas:       number;
  lucroLiquido:   number;
  impostoTotal:   number;
  cargaTributaria: number;  // %
  breakdown: { label: string; valor: number }[];
}

// ─── Lógica fiscal simplificada ───────────────────────────────────────────────

function calcSimples(receita: number, rbt12: number): TaxResult {
  // Simples Nacional – Anexo III (Serviços) — faixas 2025
  const faixas = [
    { limite: 180_000,    aliq: 0.060,  deducao: 0         },
    { limite: 360_000,    aliq: 0.1123, deducao: 9360      },
    { limite: 720_000,    aliq: 0.1350, deducao: 17640     },
    { limite: 1_800_000,  aliq: 0.1600, deducao: 35640     },
    { limite: 3_600_000,  aliq: 0.2100, deducao: 125640    },
    { limite: 4_800_000,  aliq: 0.3300, deducao: 648000    },
  ];

  const faixa = faixas.find((f) => rbt12 <= f.limite) ?? faixas[faixas.length - 1];
  const aliqEfetiva = rbt12 > 0 ? (rbt12 * faixa.aliq - faixa.deducao) / rbt12 : faixa.aliq;
  const das = receita * Math.max(0, aliqEfetiva);
  const lucro = receita * 0.3; // estimativa 30% de margem

  return {
    regime: 'Simples Nacional',
    receita,
    despesas: receita * 0.7,
    lucroLiquido: lucro - das,
    impostoTotal: das,
    cargaTributaria: receita > 0 ? (das / receita) * 100 : 0,
    breakdown: [
      { label: 'DAS (alíquota efetiva)', valor: das },
    ],
  };
}

function calcLucroPresumido(receita: number, despesas: number, atividade: string): TaxResult {
  const pres = atividade === 'servicos' ? 0.32 : atividade === 'comercio' ? 0.08 : 0.16;
  const baseIR = receita * pres;
  const irpj = baseIR * 0.15 + Math.max(0, baseIR - 20_000) * 0.10;
  const csll = receita * 0.32 * 0.09;
  const pis  = receita * 0.0065;
  const cofins = receita * 0.03;
  const total  = irpj + csll + pis + cofins;
  const lucro  = receita - despesas - total;

  return {
    regime: 'Lucro Presumido',
    receita,
    despesas,
    lucroLiquido: lucro,
    impostoTotal: total,
    cargaTributaria: receita > 0 ? (total / receita) * 100 : 0,
    breakdown: [
      { label: 'IRPJ (15% + adicional 10%)', valor: irpj   },
      { label: 'CSLL (9%)',                   valor: csll   },
      { label: 'PIS (0,65%)',                 valor: pis    },
      { label: 'COFINS (3%)',                 valor: cofins },
    ],
  };
}

function calcLucroReal(receita: number, despesas: number): TaxResult {
  const lucroContabil = receita - despesas;
  const irpj = lucroContabil > 0
    ? lucroContabil * 0.15 + Math.max(0, lucroContabil - 20_000) * 0.10
    : 0;
  const csll   = lucroContabil > 0 ? lucroContabil * 0.09 : 0;
  const pis    = receita * 0.0165;
  const cofins = receita * 0.076;
  const total  = irpj + csll + pis + cofins;
  const lucro  = lucroContabil - irpj - csll;

  return {
    regime: 'Lucro Real',
    receita,
    despesas,
    lucroLiquido: lucro,
    impostoTotal: total,
    cargaTributaria: receita > 0 ? (total / receita) * 100 : 0,
    breakdown: [
      { label: 'IRPJ (15% + adicional 10%)', valor: irpj   },
      { label: 'CSLL (9%)',                   valor: csll   },
      { label: 'PIS não-cumulativo (1,65%)',  valor: pis    },
      { label: 'COFINS n.c. (7,6%)',          valor: cofins },
    ],
  };
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ─── Card de resultado ────────────────────────────────────────────────────────

function RegimeCard({
  result,
  highlight = false,
  isBest = false,
}: {
  result: TaxResult;
  highlight?: boolean;
  isBest?: boolean;
}) {
  const positivo = result.lucroLiquido >= 0;

  return (
    <div className={`card card-body relative ${highlight ? 'ring-2 ring-primary-500' : ''}`}>
      {isBest && (
        <span className="absolute -top-2.5 left-4 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full font-medium">
          ✦ Menor carga tributária
        </span>
      )}
      <p className="text-sm font-semibold text-gray-800 mb-4">{result.regime}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Receita</span>
          <span className="font-medium">{brl(result.receita)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Despesas (est.)</span>
          <span className="font-medium text-red-600">−{brl(result.despesas)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
          <span className="text-gray-500">Total de Impostos</span>
          <span className="font-bold text-amber-600">−{brl(result.impostoTotal)}</span>
        </div>
        <div className={`flex justify-between text-sm font-bold border-t border-gray-200 pt-2 ${positivo ? 'text-green-700' : 'text-red-600'}`}>
          <span>Lucro Líquido Estimado</span>
          <span className="flex items-center gap-1">
            {positivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {brl(result.lucroLiquido)}
          </span>
        </div>
      </div>

      {/* Carga tributária */}
      <div className="rounded-lg bg-gray-50 p-3 mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Carga tributária</span>
          <span className="text-lg font-black text-amber-600">
            {result.cargaTributaria.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400"
            style={{ width: `${Math.min(result.cargaTributaria, 100)}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-1">
        {result.breakdown.map((b) => (
          <div key={b.label} className="flex justify-between text-xs text-gray-500">
            <span>{b.label}</span>
            <span className="font-mono">{brl(b.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SimuladorPage() {
  const [receita,    setReceita]    = useState(100_000);
  const [despesas,   setDespesas]   = useState(70_000);
  const [rbt12,      setRbt12]      = useState(1_200_000);
  const [atividade,  setAtividade]  = useState<'servicos' | 'comercio' | 'industria'>('servicos');

  const results = useMemo<TaxResult[]>(() => [
    calcSimples(receita, rbt12),
    calcLucroPresumido(receita, despesas, atividade),
    calcLucroReal(receita, despesas),
  ], [receita, despesas, rbt12, atividade]);

  const bestIdx = results.reduce(
    (best, r, i) => r.impostoTotal < results[best].impostoTotal ? i : best, 0
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Sliders className="h-6 w-6 text-primary-600" />
          Simulador de Cenários Fiscais
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare os três regimes tributários em tempo real e descubra qual paga menos imposto para o seu cenário.
          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            ✦ Exclusivo Pro Contador
          </span>
        </p>
      </div>

      {/* Controles */}
      <div className="card card-body">
        <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-gray-400" />
          Ajuste os parâmetros para simular diferentes cenários
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Receita mensal */}
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

          {/* Despesas mensais */}
          <div>
            <label className="input-label">
              Despesas mensais: <strong>{brl(despesas)}</strong>
            </label>
            <input
              type="range"
              min={0} max={receita} step={5_000}
              value={Math.min(despesas, receita)}
              onChange={(e) => setDespesas(Number(e.target.value))}
              className="w-full accent-primary-600 mt-1"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>R$0</span><span>{brl(receita)}</span>
            </div>
          </div>

          {/* RBT12 para Simples */}
          <div>
            <label className="input-label">
              Faturamento 12 meses (Simples): <strong>{brl(rbt12)}</strong>
            </label>
            <input
              type="range"
              min={0} max={4_800_000} step={50_000}
              value={rbt12}
              onChange={(e) => setRbt12(Number(e.target.value))}
              className="w-full accent-primary-600 mt-1"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>R$0</span><span>R$4,8M</span>
            </div>
          </div>

          {/* Atividade */}
          <div>
            <label className="input-label">Atividade (Lucro Presumido)</label>
            <select
              value={atividade}
              onChange={(e) => setAtividade(e.target.value as typeof atividade)}
              className="input-field mt-1"
            >
              <option value="servicos">Serviços (32%)</option>
              <option value="comercio">Comércio (8%)</option>
              <option value="industria">Indústria (16%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Comparativo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {results.map((r, i) => (
          <RegimeCard
            key={r.regime}
            result={r}
            highlight={i === bestIdx}
            isBest={i === bestIdx}
          />
        ))}
      </div>

      {/* Resumo */}
      <div className="card card-body bg-primary-50 border-primary-100">
        <p className="text-sm font-semibold text-primary-800 mb-2">Resumo da simulação</p>
        <p className="text-sm text-primary-700">
          Para uma receita mensal de <strong>{brl(receita)}</strong> com despesas de <strong>{brl(despesas)}</strong>,
          o regime <strong>{results[bestIdx].regime}</strong> é o mais eficiente fiscalmente,
          com carga tributária de <strong>{results[bestIdx].cargaTributaria.toFixed(1)}%</strong> e imposto total de{' '}
          <strong>{brl(results[bestIdx].impostoTotal)}</strong>/mês.
        </p>
        <p className="text-xs text-primary-600 mt-2 flex items-start gap-1">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Simulação estimativa para fins de planejamento tributário. Consulte seu contador para decisões definitivas.
        </p>
      </div>
    </div>
  );
}
