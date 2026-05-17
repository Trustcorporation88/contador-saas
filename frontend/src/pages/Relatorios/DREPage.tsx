/**
 * DREPage — Demonstração do Resultado do Exercício
 * Receitas - Despesas = Lucro/Prejuízo (Lei 6.404/76)
 * UX: QuickBooks P&L + Xero Income Statement
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import {
  ReportService,
  downloadBlob,
  type AccountBalance,
} from '../../services/reportService';

// ─── Utils ────────────────────────────────────────────────────────────────────

function brl(n: number) {
  return Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// ─── DRE row ─────────────────────────────────────────────────────────────────

function DreRow({ acc, depth = 0, positive = true }: { acc: AccountBalance; depth?: number; positive?: boolean }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td
        className="py-1.5 text-sm text-gray-800"
        style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
      >
        <span className="font-mono text-xs text-gray-400 mr-2">{acc.code}</span>
        {acc.name}
      </td>
      <td className={clsx(
        'py-1.5 px-4 text-right text-sm font-mono whitespace-nowrap',
        positive ? 'text-green-700' : 'text-red-600'
      )}>
        {acc.children?.length ? '' : `R$ ${brl(acc.balance)}`}
      </td>
    </tr>
  );
}

function DreGroup({ title, items, total, positive }: { title: string; items: AccountBalance[]; total: number; positive: boolean }) {
  if (items.length === 0) return null;
  return (
    <>
      <tr className={clsx(
        'border-b',
        positive ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
      )}>
        <td className="py-2 px-4 text-xs font-bold uppercase tracking-wide">{title}</td>
        <td className={clsx(
          'py-2 px-4 text-right text-sm font-bold font-mono whitespace-nowrap',
          positive ? 'text-green-800' : 'text-red-700'
        )}>
          R$ {brl(total)}
        </td>
      </tr>
      {items.map((acc) => <DreRow key={acc.account_id} acc={acc} positive={positive} />)}
    </>
  );
}

interface SubtotalRowProps {
  label: string;
  value: number;
  accent?: string;
  bold?: boolean;
}

function SubtotalRow({ label, value, bold, accent }: SubtotalRowProps) {
  const positive = value >= 0;
  return (
    <tr className={clsx('border-b-2', accent ?? (positive ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'))}>
      <td className={clsx('py-2.5 px-4 text-sm', bold ? 'font-bold' : 'font-semibold')}>{label}</td>
      <td className={clsx(
        'py-2.5 px-4 text-right font-mono text-sm whitespace-nowrap',
        bold ? 'font-bold text-base' : 'font-semibold',
        positive ? 'text-green-800' : 'text-red-700'
      )}>
        {!positive && '('}R$ {brl(value)}{!positive && ')'}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DREPage() {
  const { currentCompanyId } = useAuthStore();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exportLoading, setExportLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey:  ['income-statement', currentCompanyId, dateFrom, dateTo],
    queryFn:   () => ReportService.getIncomeStatement(currentCompanyId!, dateFrom, dateTo),
    enabled:   !!currentCompanyId && !!dateFrom && !!dateTo,
    staleTime: 30_000,
  });

  const handleExport = async (fmt: 'xlsx' | 'pdf') => {
    if (!currentCompanyId) return;
    setExportLoading(fmt);
    try {
      const blob = await ReportService.exportReport(
        'income-statement', currentCompanyId,
        { date_from: dateFrom, date_to: dateTo }, fmt
      );
      downloadBlob(blob, `dre-${dateFrom}_${dateTo}.${fmt}`);
    } finally {
      setExportLoading(null);
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <TrendingUp className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500">Selecione uma empresa para gerar a DRE.</p>
      </div>
    );
  }

  const r = data;
  const isProfit = (r?.net_income ?? 0) >= 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {isProfit
              ? <TrendingUp className="h-5 w-5 text-green-600" />
              : <TrendingDown className="h-5 w-5 text-red-600" />}
            DRE — Demonstração do Resultado
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Receitas − Despesas = Lucro/Prejuízo</p>
        </div>
      </div>

      {/* Date range + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="input-label">Período inicial</label>
          <input type="date" className="input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Período final</label>
          <input type="date" className="input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary flex items-center gap-2" disabled={isLoading}>
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Gerar
        </button>
        <button onClick={() => handleExport('xlsx')} disabled={!!exportLoading || isLoading} className="btn btn-secondary flex items-center gap-2 text-sm">
          <Download className="h-4 w-4" />
          {exportLoading === 'xlsx' ? 'Gerando...' : 'XLSX'}
        </button>
        <button onClick={() => handleExport('pdf')} disabled={!!exportLoading || isLoading} className="btn btn-secondary flex items-center gap-2 text-sm">
          <Download className="h-4 w-4" />
          {exportLoading === 'pdf' ? 'Gerando...' : 'PDF'}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Calculando resultados...
        </div>
      )}

      {r && !isLoading && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-gray-800 text-white">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm uppercase tracking-wide">DRE</span>
              <span className="text-xs text-gray-300">
                {format(new Date(r.date_from + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                {format(new Date(r.date_to + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          </div>

          <table className="w-full">
            <tbody>
              <DreGroup title="Receitas" items={r.revenues} total={r.gross_revenue} positive={true} />
              <SubtotalRow label="Receita Bruta" value={r.gross_revenue} accent="border-green-400 bg-green-100" />
              <DreGroup title="Despesas" items={r.expenses} total={r.total_expenses} positive={false} />
              <SubtotalRow label="Total de Despesas" value={r.total_expenses} accent="border-red-400 bg-red-100" />
            </tbody>
            <tfoot>
              <SubtotalRow
                label={isProfit ? '✓ LUCRO LÍQUIDO DO PERÍODO' : '✗ PREJUÍZO DO PERÍODO'}
                value={r.net_income}
                bold
                accent={isProfit ? 'border-green-500 bg-green-200' : 'border-red-500 bg-red-200'}
              />
            </tfoot>
          </table>
        </div>
      )}

      {r && !isLoading && (
        <p className="text-xs text-gray-400 text-right">
          Gerado em {format(new Date(r.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}
