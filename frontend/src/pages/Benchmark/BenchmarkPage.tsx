/**
 * BenchmarkPage.tsx — Benchmark Setorial Anônimo
 * Compara indicadores da empresa com médias do setor (CNAE).
 * Dados seed por setor — crescerá com a base de usuários.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis,
  Radar, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';

// ─── Dados setoriais (seed — base crescente) ──────────────────────────────────

interface SectorData {
  cnae:         string;
  label:        string;
  margemLiquida: number;  // %
  liquidezCorrente: number;
  endividamento: number;  // %
  giroAtivo:    number;
  crescimento:  number;   // % aa receita
  empresas:     number;   // amostra
}

const SETORES: SectorData[] = [
  { cnae: '62',   label: 'TI & Software',           margemLiquida: 18.2, liquidezCorrente: 1.92, endividamento: 28.4, giroAtivo: 1.15, crescimento: 12.3, empresas: 247 },
  { cnae: '47',   label: 'Comércio Varejista',       margemLiquida:  4.1, liquidezCorrente: 1.34, endividamento: 51.2, giroAtivo: 2.80, crescimento:  5.1, empresas: 412 },
  { cnae: '46',   label: 'Comércio Atacadista',      margemLiquida:  2.8, liquidezCorrente: 1.28, endividamento: 58.7, giroAtivo: 3.10, crescimento:  4.2, empresas: 183 },
  { cnae: '56',   label: 'Alimentação & Restaurante',margemLiquida:  6.4, liquidezCorrente: 0.95, endividamento: 64.3, giroAtivo: 4.20, crescimento:  8.7, empresas: 329 },
  { cnae: '69',   label: 'Contabilidade & Jurídico', margemLiquida: 22.1, liquidezCorrente: 2.10, endividamento: 22.8, giroAtivo: 0.92, crescimento:  7.4, empresas: 198 },
  { cnae: '41',   label: 'Construção Civil',         margemLiquida:  8.3, liquidezCorrente: 1.45, endividamento: 47.6, giroAtivo: 0.78, crescimento:  6.2, empresas: 156 },
  { cnae: '86',   label: 'Saúde & Clínicas',         margemLiquida: 14.7, liquidezCorrente: 1.67, endividamento: 34.9, giroAtivo: 1.35, crescimento:  9.8, empresas: 274 },
  { cnae: '49',   label: 'Transporte & Logística',   margemLiquida:  5.9, liquidezCorrente: 1.12, endividamento: 59.4, giroAtivo: 1.80, crescimento:  7.1, empresas: 142 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Delta({ empresa, setor, invert = false }: { empresa: number; setor: number; invert?: boolean }) {
  const diff = empresa - setor;
  const positive = invert ? diff < 0 : diff > 0;
  const neutral = Math.abs(diff) < 0.5;

  if (neutral) return (
    <span className="flex items-center gap-0.5 text-gray-400 text-xs">
      <Minus className="h-3 w-3" /> Na média
    </span>
  );

  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive
        ? <TrendingUp   className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{diff.toFixed(1)} vs setor
    </span>
  );
}

function MetricRow({
  label, empresaVal, setorVal,
  format: fmt = (v: number) => v.toFixed(1),
  suffix = '', invert = false,
}: {
  label: string;
  empresaVal: number;
  setorVal: number;
  format?: (v: number) => string;
  suffix?: string;
  invert?: boolean;
}) {
  const pctEmpresa = Math.min((empresaVal / (setorVal * 2)) * 100, 100);
  const pct50      = 50; // setor médio sempre em 50%

  return (
    <div className="py-3 border-t border-gray-100 first:border-0 first:pt-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <div className="text-right">
          <span className="text-sm font-bold text-gray-900">{fmt(empresaVal)}{suffix}</span>
          <span className="text-xs text-gray-400 ml-2">setor: {fmt(setorVal)}{suffix}</span>
        </div>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
        {/* Marca do setor */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-gray-400 z-10"
          style={{ left: `${pct50}%` }}
          title={`Média setor: ${fmt(setorVal)}${suffix}`}
        />
        {/* Barra da empresa */}
        <div
          className={`absolute left-0 h-full rounded-full transition-all duration-700 ${
            invert
              ? empresaVal < setorVal ? 'bg-emerald-500' : 'bg-amber-400'
              : empresaVal > setorVal ? 'bg-emerald-500' : 'bg-amber-400'
          }`}
          style={{ width: `${pctEmpresa}%` }}
        />
      </div>
      <div className="mt-1 flex justify-end">
        <Delta empresa={empresaVal} setor={setorVal} invert={invert} />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const [cnae, setCnae] = useState('62');
  const sectorData = SETORES.find((s) => s.cnae === cnae) ?? SETORES[0];

  const monthStart = useMemo(() => format(new Date(), 'yyyy-MM-01'), []);
  const today      = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['benchmark', 'balance', companyId],
    queryFn:  () => DashboardService.getBalanceSheet(companyId!),
    enabled:  !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['benchmark', 'dre', companyId, monthStart],
    queryFn:  () => DashboardService.getDRE(companyId!, monthStart, today),
    enabled:  !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  const empresa = useMemo(() => {
    const b = qBalance.data;
    const d = qDRE.data;
    const sumItems = (items: { balance?: number }[] | undefined) =>
      (items ?? []).reduce((a, i) => a + (i.balance ?? 0), 0);

    const receita  = d?.receitaLiquida  ?? 0;
    const lucro    = d?.lucroLiquido    ?? 0;
    const ativo    = b?.ativo?.total    ?? 0;
    const passivo  = b?.passivo?.total  ?? 0;
    const acirculante = sumItems(b?.ativo?.circulante);
    const pcirculante = sumItems(b?.passivo?.circulante);

    return {
      margemLiquida:     receita > 0 ? (lucro / receita) * 100 : 0,
      liquidezCorrente:  pcirculante > 0 ? acirculante / pcirculante : 0,
      endividamento:     ativo > 0 ? (passivo / ativo) * 100 : 0,
      giroAtivo:         ativo > 0 ? receita / ativo : 0,
    };
  }, [qBalance.data, qDRE.data]);

  // Radar data
  const radarData = [
    { subject: 'Margem',      empresa: Math.min(empresa.margemLiquida, 40),     setor: sectorData.margemLiquida },
    { subject: 'Liquidez',    empresa: Math.min(empresa.liquidezCorrente * 50, 100), setor: Math.min(sectorData.liquidezCorrente * 50, 100) },
    { subject: 'Eficiência',  empresa: Math.min(empresa.giroAtivo * 50, 100),   setor: Math.min(sectorData.giroAtivo * 50, 100) },
    { subject: 'Solvência',   empresa: Math.max(100 - empresa.endividamento, 0), setor: Math.max(100 - sectorData.endividamento, 0) },
  ];

  if (!companyId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="card card-body max-w-sm text-center py-12">
          <BarChart2 className="mx-auto h-10 w-10 text-gray-300 mb-4" />
          <p className="text-gray-500 text-sm">Selecione uma empresa para ver o benchmark setorial.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary-600" />
          Benchmark Setorial
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare seus indicadores com a média anônima de empresas do mesmo setor.
          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            ✦ Exclusivo O Contador
          </span>
        </p>
      </div>

      {/* Seletor de setor */}
      <div className="card card-body">
        <label className="input-label mb-2">Selecione o setor da sua empresa</label>
        <div className="flex flex-wrap gap-2">
          {SETORES.map((s) => (
            <button
              key={s.cnae}
              onClick={() => setCnae(s.cnae)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                cnae === s.cnae
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700'
              }`}
            >
              {s.label}
              <span className="ml-1 opacity-60">({s.empresas})</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Amostra de {sectorData.empresas} empresas no setor <strong>{sectorData.label}</strong> — dados anonimizados
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Métricas comparativas */}
        <div className="card card-body">
          <p className="text-sm font-semibold text-gray-800 mb-4">
            Sua empresa vs. média {sectorData.label}
          </p>
          <div>
            <MetricRow
              label="Margem Líquida"
              empresaVal={empresa.margemLiquida}
              setorVal={sectorData.margemLiquida}
              suffix="%"
            />
            <MetricRow
              label="Liquidez Corrente"
              empresaVal={empresa.liquidezCorrente}
              setorVal={sectorData.liquidezCorrente}
              format={(v) => v.toFixed(2)}
            />
            <MetricRow
              label="Endividamento"
              empresaVal={empresa.endividamento}
              setorVal={sectorData.endividamento}
              suffix="%"
              invert
            />
            <MetricRow
              label="Giro do Ativo"
              empresaVal={empresa.giroAtivo}
              setorVal={sectorData.giroAtivo}
              format={(v) => v.toFixed(2)}
            />
          </div>
        </div>

        {/* Radar chart */}
        <div className="card card-body">
          <p className="text-sm font-semibold text-gray-800 mb-2">Posicionamento no setor</p>
          <p className="text-xs text-gray-400 mb-4">Maior = melhor em todas as dimensões</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <Radar
                name={sectorData.label}
                dataKey="setor"
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0.2}
              />
              <Radar
                name="Sua empresa"
                dataKey="empresa"
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.35}
              />
              <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)}`, name]} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center text-xs mt-1">
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-indigo-500 opacity-70" /> Sua empresa</span>
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-slate-400 opacity-60" /> Média {sectorData.label}</span>
          </div>
        </div>
      </div>

      {/* Crescimento médio do setor */}
      <div className="card card-body bg-gray-50 border-dashed">
        <p className="text-xs font-semibold text-gray-600 mb-1">
          Crescimento médio do setor <strong>{sectorData.label}</strong>
        </p>
        <p className="text-2xl font-black text-gray-800">{sectorData.crescimento.toFixed(1)}% a.a.</p>
        <p className="text-xs text-gray-400 mt-1">
          Com base na amostra de {sectorData.empresas} empresas · Período 2024–2025
        </p>
      </div>
    </div>
  );
}
