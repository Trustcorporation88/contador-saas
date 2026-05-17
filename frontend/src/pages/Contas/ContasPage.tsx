import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  List,
  Network,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import {
  AccountService,
  type APIAccount,
  type APIAccountHierarchy,
  type AccountType,
  type TaxCode,
} from '../../services/accountService';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTS = [
  { value: 'ASSET',     label: 'Ativo'                },
  { value: 'LIABILITY', label: 'Passivo'              },
  { value: 'EQUITY',    label: 'Patrimônio Líquido'   },
  { value: 'REVENUE',   label: 'Receita'              },
  { value: 'EXPENSE',   label: 'Despesa'              },
] as const;

const TYPE_BADGE: Record<AccountType, string> = {
  ASSET:     'badge badge-blue',
  LIABILITY: 'badge badge-red',
  EQUITY:    'badge badge-yellow',
  REVENUE:   'badge badge-green',
  EXPENSE:   'badge badge-gray',
};

const TYPE_LABEL: Record<AccountType, string> = {
  ASSET:     'Ativo',
  LIABILITY: 'Passivo',
  EQUITY:    'PL',
  REVENUE:   'Receita',
  EXPENSE:   'Despesa',
};

const TAX_CODE_OPTS: { value: TaxCode | ''; label: string }[] = [
  { value: '',       label: '—'      },
  { value: 'IRPJ',   label: 'IRPJ'   },
  { value: 'CSLL',   label: 'CSLL'   },
  { value: 'PIS',    label: 'PIS'    },
  { value: 'COFINS', label: 'COFINS' },
  { value: 'ICMS',   label: 'ICMS'   },
  { value: 'ISS',    label: 'ISS'    },
];

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  code:         z.string().min(1, 'Obrigatório').regex(/^\d+(\.\d+)*$/, 'Formato: 1.1.01'),
  name:         z.string().min(2, 'Mínimo 2 caracteres').max(255),
  type:         z.enum(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE']),
  parent_code:  z.string().optional(),
  tax_code:     z.string().optional(),
  is_analytical:z.boolean().optional(),
});

const editSchema = createSchema.omit({ code: true });

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

// ─── Account Form ─────────────────────────────────────────────────────────────

interface AccountFormProps {
  isEditing?: boolean;
  defaultValues?: Partial<CreateForm>;
  loading?: boolean;
  apiError?: string;
  onSubmit: (v: CreateForm | EditForm) => void;
  onCancel: () => void;
}

function AccountForm({ isEditing, defaultValues, loading, apiError, onSubmit, onCancel }: AccountFormProps) {
  const schema = isEditing ? editSchema : createSchema;
  const form = useForm<CreateForm>({
    resolver: zodResolver(schema as unknown as z.ZodType<CreateForm>),
    defaultValues: { type: 'ASSET', is_analytical: true, ...defaultValues },
  });
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {!isEditing && (
        <Input
          label="Código"
          placeholder="ex: 1.1.01"
          error={errors.code?.message}
          hint="Formato hierárquico: 1.1.01"
          {...register('code')}
        />
      )}

      <Input
        label="Nome da Conta"
        placeholder="ex: Caixa e Equivalentes"
        error={errors.name?.message}
        {...register('name')}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">Tipo</label>
          <select className={clsx('input-field', errors.type && 'border-red-400')} {...register('type')}>
            {TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {errors.type && <p className="input-error">{errors.type.message}</p>}
        </div>
        <div>
          <label className="input-label">Código Tributário</label>
          <select className="input-field" {...register('tax_code')}>
            {TAX_CODE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <Input
        label="Conta Pai (código)"
        placeholder="ex: 1.1"
        hint="Opcional — deixe em branco para conta raiz"
        {...register('parent_code')}
      />

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          {...register('is_analytical')}
        />
        <span className="text-sm text-gray-700">Conta analítica</span>
        <span className="text-xs text-gray-400">(recebe lançamentos diretos)</span>
      </label>

      {apiError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={loading}>
          {isEditing ? 'Salvar alterações' : 'Criar conta'}
        </Button>
      </div>
    </form>
  );
}

// ─── Hierarchy Tree Node ──────────────────────────────────────────────────────

interface TreeNodeProps {
  node: APIAccountHierarchy;
  depth?: number;
}

function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-default',
          depth === 0 && 'font-semibold'
        )}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            'flex-none w-4 h-4 rounded text-gray-400',
            !hasChildren && 'invisible'
          )}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
        </button>

        <span className="font-mono text-xs text-gray-500 w-24 flex-none">{node.code}</span>
        <span className="flex-1 text-sm text-gray-900 truncate">{node.name}</span>
        <span className={TYPE_BADGE[node.type]}>{TYPE_LABEL[node.type]}</span>
        {node.is_analytical && (
          <span className="badge badge-blue text-xs">Analítica</span>
        )}
        {node.balance !== undefined && (
          <span className={clsx(
            'text-xs tabular-nums w-32 text-right flex-none',
            node.balance >= 0 ? 'text-gray-700' : 'text-red-600'
          )}>
            {brl(node.balance)}
          </span>
        )}
      </div>
      {open && hasChildren && node.children!.map((child) => (
        <TreeNode key={child.code} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'hierarchy';
type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; account: APIAccount };

export default function ContasPage() {
  const qc = useQueryClient();
  const { currentCompanyId, user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [view,         setView]         = useState<ViewMode>('list');
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState<AccountType | ''>('');
  const [page,         setPage]         = useState(1);
  const [modalState,   setModalState]   = useState<ModalState>({ open: false });
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string>('');
  const [apiError,     setApiError]     = useState('');

  // ── Queries ─────────────────────────────────────────────────────────────
  const listQuery = useQuery({
    queryKey: ['accounts', currentCompanyId, page, search, typeFilter],
    queryFn:  () => AccountService.list(currentCompanyId!, {
      page, limit: 20, search: search || undefined, type: typeFilter || undefined,
    }),
    enabled: !!currentCompanyId && view === 'list',
    staleTime: 30_000,
  });

  const hierarchyQuery = useQuery({
    queryKey: ['accounts-hierarchy', currentCompanyId],
    queryFn:  () => AccountService.getHierarchy(currentCompanyId!),
    enabled: !!currentCompanyId && view === 'hierarchy',
    staleTime: 60_000,
  });

  const accounts   = listQuery.data?.data ?? [];
  const pagination = listQuery.data;

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['accounts'] });
    qc.invalidateQueries({ queryKey: ['accounts-hierarchy'] });
  }, [qc]);

  const createMut = useMutation({
    mutationFn: (v: CreateForm) => AccountService.create(currentCompanyId!, v),
    onSuccess:  () => { invalidate(); closeModal(); },
    onError:    (e: Error) => setApiError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, v }: { id: string; v: EditForm }) =>
      AccountService.update(currentCompanyId!, id, v),
    onSuccess:  () => { invalidate(); closeModal(); },
    onError:    (e: Error) => setApiError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => AccountService.remove(currentCompanyId!, id),
    onSuccess:  () => { invalidate(); setDeleteId(null); },
    onError:    (e: Error) => setApiError(e.message),
  });

  const importMut = useMutation({
    mutationFn: () => AccountService.importPlano(currentCompanyId!),
    onSuccess:  (r) => {
      invalidate();
      setImportResult(`Importado: ${r.imported} contas, ${r.skipped} ignoradas.`);
      setTimeout(() => setImportResult(''), 5000);
    },
    onError: (e: Error) => setApiError(e.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const closeModal = () => setModalState({ open: false });

  const onFormSubmit = (values: CreateForm | EditForm) => {
    setApiError('');
    if (modalState.open && modalState.mode === 'create') {
      createMut.mutate(values as CreateForm);
    } else if (modalState.open && modalState.mode === 'edit') {
      updateMut.mutate({ id: modalState.account.id, v: values as EditForm });
    }
  };

  // ── No company guard ──────────────────────────────────────────────────────
  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500">Selecione uma empresa em <a href="/empresas" className="text-primary-600 hover:underline">Empresas</a> para ver o Plano de Contas.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plano de Contas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Lei 6.404/76 — Estrutura de contas contábeis</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              loading={importMut.isPending}
              onClick={() => importMut.mutate()}
            >
              Importar Padrão
            </Button>
          )}
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => { setApiError(''); setModalState({ open: true, mode: 'create' }); }}
          >
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Import result feedback */}
      {importResult && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {importResult}
        </div>
      )}

      {/* View toggle + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
              view === 'list' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            onClick={() => setView('hierarchy')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-gray-200',
              view === 'hierarchy' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Network className="h-3.5 w-3.5" /> Hierarquia
          </button>
        </div>

        {view === 'list' && (
          <>
            {/* Search */}
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                className="input-field pl-9"
                placeholder="Código ou nome..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Type filter */}
            <select
              className="input-field w-auto"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as AccountType | ''); setPage(1); }}
            >
              <option value="">Todos os tipos</option>
              {TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="card overflow-hidden">
          {listQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Carregando...</div>
          ) : listQuery.isError ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" /> Erro ao carregar contas
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-3">
                {search || typeFilter ? 'Nenhuma conta encontrada' : 'Nenhuma conta cadastrada'}
              </p>
              {!search && !typeFilter && isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => importMut.mutate()}>
                  Importar Plano Padrão
                </Button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Tributário</th>
                    <th className="px-4 py-3 font-medium">Analítica</th>
                    <th className="px-4 py-3 font-medium text-right">Saldo</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{acc.code}</td>
                      <td className="px-4 py-2.5 text-gray-900 max-w-xs truncate">{acc.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={TYPE_BADGE[acc.type]}>{TYPE_LABEL[acc.type]}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{acc.tax_code ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={clsx('badge', acc.is_analytical ? 'badge-blue' : 'badge-gray')}>
                          {acc.is_analytical ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className={clsx(
                        'px-4 py-2.5 text-right tabular-nums text-xs',
                        acc.balance < 0 ? 'text-red-600' : 'text-gray-700'
                      )}>
                        {brl(acc.balance)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={clsx('badge', acc.is_active ? 'badge-green' : 'badge-gray')}>
                          {acc.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setApiError(''); setModalState({ open: true, mode: 'edit', account: acc }); }}
                            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {deleteId === acc.id ? (
                            <div className="flex items-center gap-1 ml-1">
                              <span className="text-xs text-red-600">Confirmar?</span>
                              <button
                                onClick={() => deleteMut.mutate(acc.id)}
                                disabled={deleteMut.isPending}
                                className="rounded px-2 py-0.5 text-xs bg-red-600 text-white hover:bg-red-700 transition-colors"
                              >
                                {deleteMut.isPending ? '...' : 'Sim'}
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="rounded px-2 py-0.5 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteId(acc.id)}
                              className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">{pagination.total} contas no total</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-gray-700">Página {page} de {pagination.total_pages}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === pagination.total_pages}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HIERARCHY VIEW ────────────────────────────────────────────────── */}
      {view === 'hierarchy' && (
        <div className="card overflow-hidden">
          {hierarchyQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Carregando hierarquia...</div>
          ) : hierarchyQuery.isError ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" /> Erro ao carregar hierarquia
            </div>
          ) : !hierarchyQuery.data?.length ? (
            <div className="py-16 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-3">Nenhuma conta cadastrada</p>
            </div>
          ) : (
            <div className="py-2">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide font-medium">
                <span className="w-4 flex-none" />
                <span className="w-24 flex-none">Código</span>
                <span className="flex-1">Nome</span>
                <span>Tipo</span>
                <span>Saldo</span>
              </div>
              {hierarchyQuery.data.map((root) => (
                <TreeNode key={root.code} node={root} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global error */}
      {apiError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalState.open}
        onClose={closeModal}
        title={modalState.open && modalState.mode === 'edit' ? 'Editar Conta' : 'Nova Conta'}
        size="md"
      >
        <AccountForm
          isEditing={modalState.open && modalState.mode === 'edit'}
          defaultValues={
            modalState.open && modalState.mode === 'edit'
              ? {
                  name:          modalState.account.name,
                  type:          modalState.account.type,
                  parent_code:   modalState.account.parent_code ?? '',
                  tax_code:      modalState.account.tax_code ?? '',
                  is_analytical: modalState.account.is_analytical,
                }
              : undefined
          }
          loading={createMut.isPending || updateMut.isPending}
          apiError={apiError}
          onSubmit={onFormSubmit}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}
