/**
 * OutrosPage — Balancete de Verificação + Livro Razão
 * Tabs: Balancete | Livro Razão
 * UX: QuickBooks Trial Balance + General Ledger
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, RefreshCw, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import {
  ReportService,
  downloadBlob,
  type TrialBalanceItem,
} from '../../services/reportService';
import { AccountService } from '../../services/accountService';

// ─── Utils ────────────────────────────────────────────────────────────────────

function brl(n: number) {
  return Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const TYPE_LABEL: Record<string, string> = {
  ASSET:     'Ativo',
  LIABILITY: 'Passivo',
  EQUITY:    'PL',
  REVENUE:   'Receita',
  EXPENSE:   'Despesa',
};

// ─── Balancete ────────────────────────────────────────────────────────────────

function BalanceteTab() {
  const { currentCompanyId } = useAuthStore();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [exportLoading, setExportLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey:  ['trial-balance', currentCompanyId, dateFrom, dateTo],
    queryFn:   () => ReportService.getTrialBalance(currentCompanyId!, dateFrom || undefined, dateTo || undefined),
    enabled:   !!currentCompanyId,
    staleTime: 30_000,
  });

  const handleExport = async (fmt: 'xlsx' | 'pdf') => {
    if (!currentCompanyId) return;
    setExportLoading(fmt);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const blob = await ReportService.exportReport('trial-balance', currentCompanyId, params, fmt);
      downloadBlob(blob, `balancete-verificacao-${format(new Date(), 'yyyy-MM-dd')}.${fmt}`);
    } finally {
      setExportLoading(null);
    }
  };

  const r = data;
  const items: TrialBalanceItem[] = r?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="input-label">Período inicial (opcional)</label>
          <input type="date" className="input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Período final (opcional)</label>
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

      {r && (
        <div className={clsx(
          'flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 border',
          r.is_balanced
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        )}>
          {r.is_balanced
            ? <><CheckCircle className="h-4 w-4" /> Balancete equilibrado — Débitos = Créditos</>
            : <><AlertTriangle className="h-4 w-4" /> Débitos ≠ Créditos — Diferença: R$ {brl(Math.abs(r.totals.debit - r.totals.credit))}</>
          }
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Calculando balancete...
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome da Conta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Débitos (R$)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Créditos (R$)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo (R$)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.account_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs font-mono text-gray-500">{item.code}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{TYPE_LABEL[item.type] ?? item.type}</td>
                  <td className="px-4 py-2 text-right text-sm font-mono text-gray-900">{brl(item.debit_total)}</td>
                  <td className="px-4 py-2 text-right text-sm font-mono text-gray-900">{brl(item.credit_total)}</td>
                  <td className={clsx(
                    'px-4 py-2 text-right text-sm font-mono font-medium',
                    item.balance >= 0 ? 'text-gray-900' : 'text-red-600'
                  )}>
                    {item.balance < 0 ? '(' : ''}{brl(item.balance)}{item.balance < 0 ? ')' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            {r && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-gray-800 uppercase">TOTAIS</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900 text-sm">{brl(r.totals.debit)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900 text-sm">{brl(r.totals.credit)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-sm">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {!isLoading && items.length === 0 && data && (
        <div className="py-16 text-center text-gray-400 text-sm">
          <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-2" />
          Nenhuma conta com movimentação no período
        </div>
      )}
    </div>
  );
}

// ─── Livro Razão ──────────────────────────────────────────────────────────────

function LivroRazaoTab() {
  const { currentCompanyId } = useAuthStore();
  const [dateFrom, setDateFrom]     = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo]         = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedAccountId, setAccountId] = useState('');

  // Load accounts for selector
  const { data: accountData } = useQuery({
    queryKey:  ['accounts-all', currentCompanyId],
    queryFn:   () => AccountService.list(currentCompanyId!, { limit: 500 }),
    enabled:   !!currentCompanyId,
    staleTime: 60_000,
  });
  const accounts = (accountData?.data ?? []).filter((a) => a.is_analytical);

  const { data: ledger, isLoading, refetch } = useQuery({
    queryKey:  ['ledger', currentCompanyId, selectedAccountId, dateFrom, dateTo],
    queryFn:   () => ReportService.getLedger(currentCompanyId!, selectedAccountId, dateFrom || undefined, dateTo || undefined),
    enabled:   !!currentCompanyId && !!selectedAccountId,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="input-label">Conta contábil</label>
          <select
            className="input-field"
            value={selectedAccountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Selecione uma conta analítica...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">De</label>
          <input type="date" className="input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Até</label>
          <input type="date" className="input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button
          onClick={() => refetch()}
          disabled={!selectedAccountId || isLoading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Gerar
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Carregando lançamentos...
        </div>
      )}

      {ledger && !isLoading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Saldo Inicial', value: ledger.opening_balance },
              { label: 'Total Débitos', value: ledger.total_debit },
              { label: 'Total Créditos', value: ledger.total_credit },
              { label: 'Saldo Final', value: ledger.closing_balance, bold: true },
            ].map(({ label, value, bold }) => (
              <div key={label} className={clsx('card p-3', bold && 'bg-primary-50 border-primary-200')}>
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className={clsx(
                  'font-mono text-sm font-bold',
                  value >= 0 ? 'text-gray-900' : 'text-red-600',
                  bold && 'text-primary-700'
                )}>
                  R$ {brl(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Histórico</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doc.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Débito</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Crédito</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Acum.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {ledger.entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                      Nenhum lançamento no período
                    </td>
                  </tr>
                )}
                {ledger.entries.map((entry, idx) => (
                  <tr key={`${entry.journal_entry_id}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono text-gray-600 whitespace-nowrap">
                      {format(new Date(entry.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-800 max-w-xs truncate">
                      {entry.description || '—'}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-400">
                      {entry.reference_number || '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-gray-900">
                      {entry.debit > 0 ? brl(entry.debit) : ''}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-gray-900">
                      {entry.credit > 0 ? brl(entry.credit) : ''}
                    </td>
                    <td className={clsx(
                      'px-4 py-2 text-right font-mono text-sm font-medium',
                      entry.running_balance >= 0 ? 'text-gray-900' : 'text-red-600'
                    )}>
                      {entry.running_balance < 0 ? '(' : ''}{brl(entry.running_balance)}{entry.running_balance < 0 ? ')' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedAccountId && !isLoading && (
        <div className="py-16 text-center text-gray-400 text-sm">
          <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-2" />
          Selecione uma conta analítica para ver o livro razão
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabKey = 'balancete' | 'razao';

export default function OutrosPage() {
  const { currentCompanyId } = useAuthStore();
  const [tab, setTab] = useState<TabKey>('balancete');

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500">Selecione uma empresa para acessar os relatórios.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Outros Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Balancete de verificação e livro razão</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {([
            { key: 'balancete', label: 'Balancete de Verificação' },
            { key: 'razao',     label: 'Livro Razão' },
          ] as { key: TabKey; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === key
                  ? 'border-primary-500 text-primary-700 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'balancete' ? <BalanceteTab /> : <LivroRazaoTab />}
    </div>
  );
}
