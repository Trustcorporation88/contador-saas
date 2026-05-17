/**
 * AuditoriaPage — Logs de auditoria e rastreabilidade
 * Task 3.12 — melhor que QuickBooks Activity Log, Omie Auditoria
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShieldCheck, Activity, Lock, AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import {
  AuditService,
  type AuditLogEntry,
  type AccessAuditEntry,
} from '../../services/auditService';

// ─── Utils ────────────────────────────────────────────────────────────────────

function ts(dateStr: string) {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

type Tab = 'logs' | 'access';

const ACTION_COLORS: Record<string, string> = {
  CREATE:  'badge badge-green',
  UPDATE:  'badge badge-blue',
  DELETE:  'badge badge-red',
  POST:    'badge badge-green',
  REVERSE: 'badge badge-yellow',
  LOGIN:   'badge badge-blue',
  LOGOUT:  'badge badge-gray',
};

function actionBadge(action: string) {
  const cls = ACTION_COLORS[action.toUpperCase()] ?? 'badge badge-gray';
  return <span className={cls}>{action}</span>;
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ companyId }: { companyId: string | null }) {
  const { data } = useQuery({
    queryKey:  ['audit-stats', companyId],
    queryFn:   () => AuditService.getStats(companyId ?? undefined),
    staleTime: 30_000,
    enabled:   true,
  });

  const items = [
    { label: 'Total de Logs',    value: data?.total_logs   ?? '—', icon: <Activity className="h-4 w-4 text-primary-500" /> },
    { label: 'Hoje',             value: data?.today_logs   ?? '—', icon: <ShieldCheck className="h-4 w-4 text-green-500" /> },
    { label: 'Ações com Falha',  value: data?.failed_actions ?? '—', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, icon }) => (
        <div key={label} className="card p-3 flex items-center gap-3">
          {icon}
          <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Expandable row to show old/new values ────────────────────────────────────

function LogRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasValues = entry.old_value || entry.new_value;

  return (
    <>
      <tr
        className={clsx('hover:bg-gray-50', hasValues && 'cursor-pointer')}
        onClick={() => hasValues && setExpanded((v) => !v)}
      >
        <td className="px-4 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap">
          {ts(entry.timestamp)}
        </td>
        <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">
          {actionBadge(entry.action)}
        </td>
        <td className="px-4 py-2.5 text-sm text-gray-600">
          {entry.entity_type && (
            <span className="font-mono text-xs text-gray-500 mr-1">[{entry.entity_type}]</span>
          )}
          {entry.entity_id && (
            <span className="font-mono text-xs text-gray-400 truncate max-w-xs block">
              {entry.entity_id}
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">
          {entry.user_id?.slice(0, 8) ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-400">
          {entry.ip_address ?? '—'}
        </td>
        <td className="px-4 py-2.5 text-center">
          <span className={clsx(
            entry.status === 'SUCCESS' ? 'badge badge-green' : 'badge badge-red',
          )}>
            {entry.status}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right text-gray-400 w-6">
          {hasValues && (expanded
            ? <ChevronDown className="h-3.5 w-3.5 inline" />
            : <ChevronRight className="h-3.5 w-3.5 inline" />
          )}
        </td>
      </tr>
      {expanded && hasValues && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-6 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {entry.old_value && (
                <div>
                  <p className="font-semibold text-red-600 mb-1">Antes</p>
                  <pre className="bg-red-50 rounded p-2 overflow-x-auto text-red-700 max-h-40">
                    {JSON.stringify(entry.old_value, null, 2)}
                  </pre>
                </div>
              )}
              {entry.new_value && (
                <div>
                  <p className="font-semibold text-green-600 mb-1">Depois</p>
                  <pre className="bg-green-50 rounded p-2 overflow-x-auto text-green-700 max-h-40">
                    {JSON.stringify(entry.new_value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Access audit tab ─────────────────────────────────────────────────────────

function AccessAuditTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey:  ['audit-access', page],
    queryFn:   () => AuditService.listAccessAudit({ page, limit: 50 }),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Data/Hora', 'Usuário', 'Empresa', 'Ação', 'Descrição', 'IP', 'Resultado'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {(data?.data ?? []).map((entry: AccessAuditEntry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap">
                    {ts(entry.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                    {entry.user_id?.slice(0, 8) ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                    {entry.company_id?.slice(0, 8) ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">{actionBadge(entry.action)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 max-w-xs truncate">
                    {entry.description ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{entry.ip_address ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={entry.success ? 'badge badge-green' : 'badge badge-red'}>
                      {entry.success ? 'OK' : 'FALHOU'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{data.total} registros</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <span className="px-3 py-1 text-xs">
              {page}/{data.totalPages}
            </span>
            <button className="btn btn-secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Audit logs tab ───────────────────────────────────────────────────────────

function AuditLogsTab() {
  const [page, setPage]         = useState(1);
  const [action, setAction]     = useState('');
  const [status, setStatus]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey:  ['audit-logs', page, action, status, dateFrom, dateTo],
    queryFn:   () => AuditService.listLogs({
      page, limit: 50,
      action:    action   || undefined,
      status:    status   || undefined,
      date_from: dateFrom || undefined,
      date_to:   dateTo   || undefined,
    }),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="input-label">Ação</label>
          <select className="input-field w-36" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">Todas</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="POST">POST</option>
            <option value="REVERSE">REVERSE</option>
            <option value="LOGIN">LOGIN</option>
          </select>
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input-field w-36" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
        <div>
          <label className="input-label">De</label>
          <input type="date" className="input-field" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="input-label">Até</label>
          <input type="date" className="input-field" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Data/Hora', 'Ação', 'Entidade', 'Usuário', 'IP', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {(data?.data ?? []).map((entry: AuditLogEntry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{data.total} registros</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <span className="px-3 py-1 text-xs">
              {page}/{data.totalPages}
            </span>
            <button className="btn btn-secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  const { currentCompanyId } = useAuthStore();
  const [tab, setTab] = useState<Tab>('logs');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-600" />
          Auditoria & Rastreabilidade
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Trilha de auditoria completa — SHA-256 hash, imutabilidade Lei 6.404/76
        </p>
      </div>

      {/* Stats */}
      <StatsBar companyId={currentCompanyId} />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          {([
            { key: 'logs',   label: 'Logs de Sistema',  icon: <Activity className="h-4 w-4" /> },
            { key: 'access', label: 'Controle de Acesso', icon: <Lock className="h-4 w-4" /> },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-1 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {icon} {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'logs'   && <AuditLogsTab />}
      {tab === 'access' && <AccessAuditTab />}
    </div>
  );
}
