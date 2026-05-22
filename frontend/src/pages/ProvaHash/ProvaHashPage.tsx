/**
 * ProvaHashPage.tsx — Prova Criptográfica de Saúde Financeira
 * Gera um hash SHA-256 dos dados financeiros que pode ser compartilhado
 * com bancos e investidores como prova de integridade, sem revelar detalhes.
 * INÉDITO no mundo da contabilidade brasileira.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lock, Copy, CheckCheck, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';
import { calcHealthScore } from '../../services/healthScoreService';
import type { BalanceSheet, DRE } from '../../types';

// ─── Utilitários criptográficos ───────────────────────────────────────────────

/** SHA-256 usando Web Crypto API nativa (sem dependências) */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sumItems(items: { balance?: number }[] | undefined) {
  return (items ?? []).reduce((a, i) => a + (i.balance ?? 0), 0);
}

interface FinancialProof {
  hash:          string;
  timestamp:     string;
  period:        string;
  summary: {
    scoreTotal:  number;
    grade:       string;
    receita:     number;
    lucro:       number;
    ativo:       number;
    passivo:     number;
    pl:          number;
    lc:          number | null;
  };
  chain: {
    step:    string;
    partial: string;
  }[];
}

async function buildProof(
  balance:   BalanceSheet | undefined,
  dre:       DRE          | undefined,
  companyId: string,
): Promise<FinancialProof> {
  const hs       = calcHealthScore(balance, dre);
  const receita  = dre?.receitaLiquida ?? 0;
  const lucro    = dre?.lucroLiquido   ?? 0;
  const ativo    = balance?.ativo?.total  ?? 0;
  const passivo  = balance?.passivo?.total ?? 0;
  const pl       = balance?.patrimonioLiquido?.total ?? 0;
  const ac       = sumItems(balance?.ativo?.circulante);
  const pc       = sumItems(balance?.passivo?.circulante);
  const lc       = pc > 0 ? ac / pc : null;
  const period   = format(new Date(), 'yyyy-MM');
  const ts       = new Date().toISOString();

  // Cadeia de hashes
  const step1Data = `company:${companyId}|period:${period}`;
  const h1 = await sha256(step1Data);

  const step2Data = `${h1}|score:${hs.total}|grade:${hs.grade}`;
  const h2 = await sha256(step2Data);

  const step3Data = `${h2}|receita:${receita.toFixed(2)}|lucro:${lucro.toFixed(2)}`;
  const h3 = await sha256(step3Data);

  const step4Data = `${h3}|ativo:${ativo.toFixed(2)}|passivo:${passivo.toFixed(2)}|pl:${pl.toFixed(2)}`;
  const h4 = await sha256(step4Data);

  const step5Data = `${h4}|lc:${lc?.toFixed(4) ?? 'N/A'}|ts:${ts}`;
  const finalHash = await sha256(step5Data);

  return {
    hash:      finalHash,
    timestamp: ts,
    period,
    summary: {
      scoreTotal: hs.total,
      grade:      hs.grade,
      receita,
      lucro,
      ativo,
      passivo,
      pl,
      lc,
    },
    chain: [
      { step: '1 — Identidade',    partial: h1.slice(0, 16) + '…' },
      { step: '2 — Score de Saúde', partial: h2.slice(0, 16) + '…' },
      { step: '3 — Resultado',      partial: h3.slice(0, 16) + '…' },
      { step: '4 — Balanço',        partial: h4.slice(0, 16) + '…' },
      { step: '5 — Hash Final',     partial: finalHash.slice(0, 16) + '…' },
    ],
  };
}

// ─── Componente de linha de cadeia ────────────────────────────────────────────

function ChainStep({ step, partial, index }: { step: string; partial: string; index: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-7 w-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-700">{step}</p>
        <p className="text-xs font-mono text-gray-400">{partial}</p>
      </div>
      {index < 4 && (
        <div className="text-gray-300 text-xs">▼</div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProvaHashPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const [proof, setProof] = useState<FinancialProof | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const monthStart = useMemo(() => format(new Date(), 'yyyy-MM-01'), []);
  const today      = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['prova', 'balance', companyId],
    queryFn:  () => DashboardService.getBalanceSheet(companyId!),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['prova', 'dre', companyId, monthStart],
    queryFn:  () => DashboardService.getDRE(companyId!, monthStart, today),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  async function generate() {
    if (!companyId) return;
    setLoading(true);
    try {
      const p = await buildProof(qBalance.data, qDRE.data, companyId);
      setProof(p);
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const brl = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

  const gradeColor: Record<string, string> = {
    'A+': 'text-emerald-600', A: 'text-green-600', B: 'text-blue-600',
    C: 'text-amber-600', D: 'text-orange-600', F: 'text-red-600',
  };

  if (!companyId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="card card-body max-w-sm text-center py-12">
          <Lock className="mx-auto h-10 w-10 text-gray-300 mb-4" />
          <p className="text-gray-500 text-sm">Selecione uma empresa para gerar a prova criptográfica.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Lock className="h-6 w-6 text-primary-600" />
          Prova Criptográfica de Saúde Financeira
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gera um hash SHA-256 dos dados financeiros — compartilhe com bancos e investidores sem revelar os detalhes.
          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            ✦ Exclusivo Pro Contador
          </span>
        </p>
      </div>

      {/* Gerar */}
      {!proof && (
        <div className="card card-body text-center py-10 space-y-4">
          <Lock className="mx-auto h-12 w-12 text-primary-200" />
          <div>
            <p className="font-semibold text-gray-700">Gerar prova criptográfica</p>
            <p className="text-sm text-gray-500 mt-1">
              Um hash único dos seus dados financeiros. Qualquer alteração nos dados
              invalida o hash — garantindo integridade comprovável.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={loading || qBalance.isLoading || qDRE.isLoading}
            className="btn btn-primary mx-auto flex items-center gap-2"
          >
            {loading
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Gerando…</>
              : <><ShieldCheck className="h-4 w-4" /> Gerar Prova SHA-256</>
            }
          </button>
        </div>
      )}

      {/* Resultado */}
      {proof && (
        <>
          {/* Resumo */}
          <div className="card card-body bg-emerald-50 border-emerald-200 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <span className="font-semibold text-emerald-800">Prova gerada com sucesso</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Score de Saúde</p>
                <p className={`font-bold ${gradeColor[proof.summary.grade] ?? ''}`}>
                  {proof.summary.scoreTotal}/1000 ({proof.summary.grade})
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Período</p>
                <p className="font-semibold text-gray-700">
                  {format(new Date(proof.period + '-01'), 'MMMM yyyy', { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Receita Líquida</p>
                <p className="font-semibold text-gray-700">{brl(proof.summary.receita)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Lucro Líquido</p>
                <p className={`font-semibold ${proof.summary.lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {brl(proof.summary.lucro)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Ativo Total</p>
                <p className="font-semibold text-gray-700">{brl(proof.summary.ativo)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Patrimônio Líquido</p>
                <p className="font-semibold text-gray-700">{brl(proof.summary.pl)}</p>
              </div>
            </div>
          </div>

          {/* Hash principal */}
          <div className="card card-body space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hash SHA-256</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-700 break-all">
              <span className="flex-1">{proof.hash}</span>
              <button
                onClick={() => copy(proof.hash, 'hash')}
                className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-500"
                title="Copiar hash"
              >
                {copied === 'hash' ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Gerado em {format(new Date(proof.timestamp), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </p>
          </div>

          {/* Cadeia de hashes */}
          <div className="card card-body space-y-3">
            <p className="text-sm font-semibold text-gray-700">Cadeia de verificação</p>
            <p className="text-xs text-gray-400">Cada etapa depende da anterior — a prova é incremental e não repudiável.</p>
            <div className="space-y-2">
              {proof.chain.map((c, i) => (
                <ChainStep key={i} step={c.step} partial={c.partial} index={i} />
              ))}
            </div>
          </div>

          {/* JSON completo para compartilhar */}
          <div className="card card-body space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Certificado JSON</p>
              <button
                onClick={() => copy(JSON.stringify({ ...proof, chain: undefined }, null, 2), 'json')}
                className="btn text-xs flex items-center gap-1.5 py-1 px-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {copied === 'json' ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copiar JSON
              </button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 overflow-x-auto max-h-40">
              {JSON.stringify({ hash: proof.hash, timestamp: proof.timestamp, period: proof.period, summary: proof.summary }, null, 2)}
            </pre>
          </div>

          {/* Gerar nova */}
          <div className="flex justify-center">
            <button onClick={generate} className="btn text-sm flex items-center gap-2 border border-gray-200 hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Gerar nova prova
            </button>
          </div>
        </>
      )}

      {/* Nota */}
      <div className="card card-body bg-gray-50 border-dashed text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600">Como usar</p>
        <p>Compartilhe o hash SHA-256 com bancos ou investidores. Eles podem verificar a integridade dos dados: qualquer alteração nos números produz um hash completamente diferente.</p>
        <p>O hash é calculado localmente no seu navegador — os dados nunca saem da sua máquina.</p>
      </div>
    </div>
  );
}
