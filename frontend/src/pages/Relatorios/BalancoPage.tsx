/**
 * BalancoPage — Balanço Patrimonial
 * Ativo = Passivo + Patrimônio Líquido (Lei 6.404/76)
 * UX: QuickBooks Balance Sheet + Xero Balance Sheet
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, RefreshCw, Scale, CheckCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import {
  ReportService,
  downloadBlob,
  type AccountBalance,
} from '../../services/reportService';

// ─── Utils ────────────────────────────────────────────────────────────────────

function brl(n: number, showSign = false) {
  const abs = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  if (showSign && n < 0) return `(${abs})`;
  return abs;
}

// ─── Account row ─────────────────────────────────────────────────────────────

function AccountRow({ acc, depth = 0 }: { acc: AccountBalance; depth?: number }) {
  const hasChildren = acc.children && acc.children.length > 0;
  return (
    <>
      <tr className={clsx(
        'border-b border-gray-100',
        hasChildren ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'
      )}>
        <td
          className="py-1.5 text-sm text-gray-800"
          style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
        >
          <span className="font-mono text-xs text-gray-400 mr-2">{acc.code}</span>
          {acc.name}
        </td>
        <td className="py-1.5 px-4 text-right text-sm font-mono text-gray-900 whitespace-nowrap">
          {hasChildren ? '' : `R$ ${brl(acc.balance)}`}
        </td>
      </tr>
      {acc.children?.map((child) => (
        <AccountRow key={child.account_id} acc={child} depth={depth + 1} />
      ))}
    </>
  );
}

function GroupSection({
  title, items, total, accent = 'gray',
}: {
  title: string;
  items: AccountBalance[];
  total: number;
  accent?: 'blue' | 'red' | 'green' | 'gray';
}) {
  const accents: Record<string, string> = {
    blue:  'bg-blue-50 text-blue-800 border-blue-200',
    red:   'bg-red-50 text-red-800 border-red-200',
    green: 'bg-green-50 text-green-800 border-green-200',
    gray:  'bg-gray-100 text-gray-800 border-gray-200',
  };
  if (items.length === 0) return null;
  return (
    <>
      <tr className={clsx('border-b', accents[accent])}>
        <td className="py-2 px-4 text-xs font-bold uppercase tracking-wide">{title}</td>
        <td className="py-2 px-4 text-right text-sm font-bold font-mono whitespace-nowrap">
          R$ {brl(total)}
        </td>
      </tr>
      {items.map((acc) => <AccountRow key={acc.account_id} acc={acc} depth={0} />)}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BalancoPage() {
  const { currentCompanyId } = useAuthStore();
  const [dateTo, setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exportLoading, setExportLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey:  ['balance-sheet', currentCompanyId, dateTo],
    queryFn:   () => ReportService.getBalanceSheet(currentCompanyId!, dateTo),
    enabled:   !!currentCompanyId,
    staleTime: 30_000,
  });

  const handleExport = async (fmt: 'xlsx' | 'pdf') => {
    if (!currentCompanyId) return;
    setExportLoading(fmt);
    try {
      const blob = await ReportService.exportReport('balance-sheet', currentCompanyId, { date_to: dateTo }, fmt);
      const label = format(new Date(dateTo + 'T00:00:00'), 'yyyy-MM-dd');
      downloadBlob(blob, `balanco-patrimonial-${label}.${fmt}`);
    } finally {
      setExportLoading(null);
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <Scale className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500">Selecione uma empresa para gerar o Balanço Patrimonial.</p>
        <p className="mt-2 text-xs text-gray-400">Sem empresa ativa, o relatório não pode ser consolidado.</p>
      </div>
    );
  }

  const r = data;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="glass-strip flex items-start justify-between flex-wrap gap-3 px-5 py-5 sm:px-6">
        <div>
          <p className="shell-title">Relatório patrimonial</p>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary-600" />
            Balanço Patrimonial
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Ativo = Passivo + Patrimônio Líquido (Lei 6.404/76)</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="input-label">Data de referência</label>
            <input type="date" className="input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button
            onClick={() => refetch()}
            className="btn btn-secondary flex items-center gap-2 mt-4"
            disabled={isLoading}
          >
            <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Export buttons */}
      <div className="glass-strip flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <button
          onClick={() => handleExport('xlsx')}
          disabled={!!exportLoading || isLoading}
          className="btn btn-secondary flex items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" />
          {exportLoading === 'xlsx' ? 'Gerando...' : 'Exportar XLSX'}
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={!!exportLoading || isLoading}
          className="btn btn-secondary flex items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" />
          {exportLoading === 'pdf' ? 'Gerando...' : 'Exportar PDF'}
        </button>

        <button
          type="button"
          onClick={() => setDateTo(format(new Date(), 'yyyy-MM-dd'))}
          className="btn btn-ghost text-xs"
        >
          Voltar para hoje
        </button>
      </div>

      {/* Balance indicator */}
      {r && (
        <div className={clsx(
          'flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 border',
          r.is_balanced
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        )}>
          {r.is_balanced
            ? <><CheckCircle className="h-4 w-4" /> Balanço equilibrado — Total Ativo = Total Passivo + PL</>
            : <><AlertTriangle className="h-4 w-4" /> Diferença: R$ {brl(Math.abs(r.total_assets - r.total_liabilities_and_equity))}</>
          }
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Calculando saldos...
        </div>
      )}

      {/* Report */}
      {r && !isLoading && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* ATIVO */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-blue-600 text-white">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm uppercase tracking-wide">Ativo</span>
                <span className="font-mono font-bold text-sm">R$ {brl(r.total_assets)}</span>
              </div>
            </div>
            <table className="w-full">
              <tbody>
                <GroupSection title="Ativo Circulante" items={r.assets.current} total={r.assets.current.reduce((s, a) => s + a.balance, 0)} accent="blue" />
                <GroupSection title="Ativo Não Circulante" items={r.assets.non_current} total={r.assets.non_current.reduce((s, a) => s + a.balance, 0)} accent="blue" />
                {r.assets.current.length === 0 && r.assets.non_current.length === 0 && (
                  <tr><td colSpan={2} className="py-8 text-center text-gray-400 text-sm">Nenhuma conta ativa com saldo</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-blue-300 bg-blue-50">
                  <td className="py-2 px-4 text-sm font-bold text-blue-800">TOTAL ATIVO</td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-blue-900 text-sm">R$ {brl(r.total_assets)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* PASSIVO + PL */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-red-600 text-white">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm uppercase tracking-wide">Passivo + PL</span>
                <span className="font-mono font-bold text-sm">R$ {brl(r.total_liabilities_and_equity)}</span>
              </div>
            </div>
            <table className="w-full">
              <tbody>
                <GroupSection title="Passivo Circulante" items={r.liabilities.current} total={r.liabilities.current.reduce((s, a) => s + a.balance, 0)} accent="red" />
                <GroupSection title="Passivo Não Circulante" items={r.liabilities.non_current} total={r.liabilities.non_current.reduce((s, a) => s + a.balance, 0)} accent="red" />
                <GroupSection title="Patrimônio Líquido" items={r.equity.items} total={r.equity.total} accent="green" />
                {r.liabilities.current.length === 0 && r.liabilities.non_current.length === 0 && r.equity.items.length === 0 && (
                  <tr><td colSpan={2} className="py-8 text-center text-gray-400 text-sm">Nenhuma conta com saldo</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-red-300 bg-red-50">
                  <td className="py-2 px-4 text-sm font-bold text-red-800">TOTAL PASSIVO + PL</td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-red-900 text-sm">R$ {brl(r.total_liabilities_and_equity)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      )}

      {r && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <p>
            Gerado em {format(new Date(r.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          <p>
            Data base: {format(new Date(dateTo + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      )}
    </div>
  );
}
