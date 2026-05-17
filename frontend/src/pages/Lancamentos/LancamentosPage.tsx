/**
 * LancamentosPage — Listagem de lançamentos contábeis com filtros
 * Features: busca, filtros de data, status, paginação, postar, estornar, excluir
 * Nível: QuickBooks Advanced Journal Listing
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, BookOpen, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../../store/authStore';
import {
  JournalService,
  type JournalEntry,
  type JournalListParams,
} from '../../services/journalService';

// ─── Utils ────────────────────────────────────────────────────────────────────

function brl(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso;
  }
}

function truncate(s: string | undefined, n = 60) {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const STATUS_BADGE: Record<string, string> = {
  posted: 'badge badge-green',
  draft:  'badge badge-yellow',
};

// ─── Confirm dialog (inline) ──────────────────────────────────────────────────

interface ConfirmBarProps {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

function ConfirmBar({ label, onConfirm, onCancel, danger }: ConfirmBarProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
      <span className="text-xs text-amber-800 font-medium">{label}</span>
      <button
        onClick={onConfirm}
        className={clsx(
          'text-xs font-semibold px-2 py-0.5 rounded',
          danger
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
        )}
      >
        Confirmar
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancelar
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LancamentosPage() {
  const { currentCompanyId } = useAuthStore();
  const qc = useQueryClient();

  // Filters
  const [search, setSearch]       = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [statusFilter, setStatus] = useState<'all' | 'draft' | 'posted'>('all');
  const [page, setPage]           = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Confirm states
  const [confirmPost,    setConfirmPost]    = useState<string | null>(null);
  const [confirmReverse, setConfirmReverse] = useState<string | null>(null);
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);

  // Query params
  const params: JournalListParams = {
    page,
    limit: 20,
    search: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    is_posted:
      statusFilter === 'posted' ? true :
      statusFilter === 'draft'  ? false : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['journals', currentCompanyId, params],
    queryFn:  () => JournalService.list(currentCompanyId!, params),
    enabled:  !!currentCompanyId,
  });

  const entries     = data?.data ?? [];
  const total       = data?.total ?? 0;
  const totalPages  = data?.totalPages ?? 1;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['journals', currentCompanyId] });

  // Mutations
  const postMut = useMutation({
    mutationFn: (id: string) => JournalService.post(currentCompanyId!, id),
    onSuccess:  () => { setConfirmPost(null); invalidate(); },
  });

  const reverseMut = useMutation({
    mutationFn: (id: string) => JournalService.reverse(currentCompanyId!, id),
    onSuccess:  () => { setConfirmReverse(null); invalidate(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => JournalService.remove(currentCompanyId!, id),
    onSuccess:  () => { setConfirmDelete(null); invalidate(); },
  });

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500">Selecione uma empresa para ver os lançamentos.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lançamentos Contábeis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} lançamento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/lancamentos/novo"
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Link>
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="Buscar por histórico, documento..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['all', 'draft', 'posted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={clsx(
                'px-3 py-2 text-sm font-medium transition-colors',
                statusFilter === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {s === 'all' ? 'Todos' : s === 'draft' ? 'Rascunho' : 'Postados'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={clsx(
            'btn btn-secondary flex items-center gap-2',
            showFilters && 'bg-primary-50 border-primary-200 text-primary-700'
          )}
        >
          <Filter className="h-4 w-4" />
          Período
        </button>
      </div>

      {/* Date range */}
      {showFilters && (
        <div className="flex gap-4 items-end flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className="input-label">Data inicial</label>
            <input type="date" className="input-field" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="input-label">Data final</label>
            <input type="date" className="input-field" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <button
            className="btn btn-ghost text-sm"
            onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
          >
            Limpar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Histórico</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doc.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Débito</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Crédito</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
                    Carregando...
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-2" />
                  <p className="text-gray-400 text-sm">Nenhum lançamento encontrado</p>
                  <Link to="/lancamentos/novo" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
                    Criar primeiro lançamento
                  </Link>
                </td>
              </tr>
            )}

            {entries.map((e: JournalEntry) => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap font-mono">
                  {fmtDate(e.entry_date)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                  {truncate(e.description)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {e.reference_type ? (
                    <span className="badge badge-gray">{e.reference_type}</span>
                  ) : '—'}
                  {e.reference_number && (
                    <span className="ml-1 font-mono text-xs text-gray-400">#{e.reference_number}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-medium text-gray-900 whitespace-nowrap">
                  R$ {brl(e.total_debit)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-medium text-gray-900 whitespace-nowrap">
                  R$ {brl(e.total_credit)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={STATUS_BADGE[e.is_posted ? 'posted' : 'draft']}>
                    {e.is_posted ? 'Postado' : 'Rascunho'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {/* Confirm overlays */}
                  {confirmPost === e.id && (
                    <ConfirmBar
                      label="Postar lançamento? Não poderá ser editado."
                      onConfirm={() => postMut.mutate(e.id)}
                      onCancel={() => setConfirmPost(null)}
                    />
                  )}
                  {confirmReverse === e.id && (
                    <ConfirmBar
                      label="Criar lançamento de estorno?"
                      onConfirm={() => reverseMut.mutate(e.id)}
                      onCancel={() => setConfirmReverse(null)}
                    />
                  )}
                  {confirmDelete === e.id && (
                    <ConfirmBar
                      label="Excluir rascunho permanentemente?"
                      onConfirm={() => deleteMut.mutate(e.id)}
                      onCancel={() => setConfirmDelete(null)}
                      danger
                    />
                  )}

                  {/* Default actions */}
                  {confirmPost !== e.id && confirmReverse !== e.id && confirmDelete !== e.id && (
                    <div className="flex items-center justify-end gap-1">
                      {!e.is_posted && (
                        <>
                          <button
                            onClick={() => setConfirmPost(e.id)}
                            title="Postar lançamento"
                            className="rounded p-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Postar
                          </button>
                          <Link
                            to={`/lancamentos/${e.id}/editar`}
                            className="rounded p-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => setConfirmDelete(e.id)}
                            className="rounded p-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                      {e.is_posted && (
                        <button
                          onClick={() => setConfirmReverse(e.id)}
                          title="Estornar lançamento"
                          className="rounded p-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Estornar
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn btn-secondary text-sm disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-secondary text-sm disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
