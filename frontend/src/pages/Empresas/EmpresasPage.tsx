import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { CompanyService, type APICompany, type TaxRegime } from '../../services/companyService';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ─── Constants ────────────────────────────────────────────────────────────────

const REGIME_OPTIONS = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido',  label: 'Lucro Presumido'  },
  { value: 'lucro_real',       label: 'Lucro Real'       },
] as const;

const REGIME_BADGE: Record<TaxRegime, string> = {
  simples_nacional: 'badge badge-green',
  lucro_presumido:  'badge badge-blue',
  lucro_real:       'badge badge-yellow',
};

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── CNPJ helpers ─────────────────────────────────────────────────────────────

function maskCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2)  return d;
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function formatCNPJ(cnpj: string): string {
  return maskCNPJ(cnpj);
}

function validateCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const s1 = w1.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0);
  const r1 = s1 % 11;
  if (parseInt(d[12]) !== (r1 < 2 ? 0 : 11 - r1)) return false;
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const s2 = w2.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0);
  const r2 = s2 % 11;
  return parseInt(d[13]) === (r2 < 2 ? 0 : 11 - r2);
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  name:               z.string().min(3, 'Mínimo 3 caracteres').max(200),
  tax_regime:         z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real']),
  email:              z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:              z.string().optional(),
  fiscal_year_start:  z.number().int().min(1).max(12).optional(),
});

const createSchema = baseSchema.extend({
  cnpj: z
    .string()
    .min(1, 'CNPJ obrigatório')
    .refine((v) => validateCNPJ(v), 'CNPJ inválido'),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof baseSchema>;

// ─── Company form (shared create / edit) ─────────────────────────────────────

interface CompanyFormProps {
  defaultValues?: Partial<CreateForm>;
  isEditing?: boolean;
  loading?: boolean;
  apiError?: string;
  onSubmit: (values: CreateForm | EditForm) => void;
  onCancel: () => void;
}

function CompanyForm({
  defaultValues,
  isEditing,
  loading,
  apiError,
  onSubmit,
  onCancel,
}: CompanyFormProps) {
  const schema = isEditing ? baseSchema : createSchema;

  const form = useForm<CreateForm>({
    resolver: zodResolver(schema as unknown as z.ZodType<CreateForm>),
    defaultValues: {
      name:              '',
      tax_regime:        'simples_nacional',
      email:             '',
      phone:             '',
      fiscal_year_start: 1,
      ...defaultValues,
    },
  });

  const { register, control, handleSubmit, formState: { errors } } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

      {/* CNPJ — only on create */}
      {!isEditing && (
        <Controller
          name="cnpj"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              error={fieldState.error?.message}
              value={field.value ?? ''}
              name={field.name}
              ref={field.ref}
              onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
            />
          )}
        />
      )}

      {/* Razão Social */}
      <Input
        label="Razão Social"
        placeholder="Nome completo da empresa"
        error={errors.name?.message}
        {...register('name')}
      />

      {/* Regime Tributário */}
      <div>
        <label className="input-label">Regime Tributário</label>
        <select
          className={clsx('input-field', errors.tax_regime && 'border-red-400')}
          {...register('tax_regime')}
        >
          {REGIME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {errors.tax_regime && (
          <p className="input-error">{errors.tax_regime.message}</p>
        )}
      </div>

      {/* E-mail + Telefone */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="E-mail"
          type="email"
          placeholder="contato@empresa.com.br"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Telefone"
          placeholder="(11) 99999-9999"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      {/* Exercício Fiscal */}
      <div>
        <label className="input-label">Início do Exercício Fiscal</label>
        <select
          className="input-field"
          {...register('fiscal_year_start', { valueAsNumber: true })}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      {apiError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {isEditing ? 'Salvar alterações' : 'Criar empresa'}
        </Button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ModalMode = { open: false } | { open: true; mode: 'create' } | { open: true; mode: 'edit'; company: APICompany };

export default function EmpresasPage() {
  const qc = useQueryClient();
  const { setCurrentCompany, currentCompanyId } = useAuthStore();

  const [search,         setSearch]         = useState('');
  const [debouncedSearch,setDebouncedSearch] = useState('');
  const [page,           setPage]           = useState(1);
  const [modalState,     setModalState]     = useState<ModalMode>({ open: false });
  const [deleteId,       setDeleteId]       = useState<string | null>(null);
  const [apiError,       setApiError]       = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['companies', page, debouncedSearch],
    queryFn:  () => CompanyService.list({ page, limit: 10, search: debouncedSearch || undefined }),
    staleTime: 30_000,
  });

  const companies  = data?.data        ?? [];
  const pagination = data?.pagination;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ['companies'] });

  const createMut = useMutation({
    mutationFn: (v: CreateForm) => CompanyService.create({ ...v, email: v.email || undefined }),
    onSuccess:  () => { invalidate(); closeModal(); },
    onError:    (e: Error) => setApiError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, v }: { id: string; v: EditForm }) =>
      CompanyService.update(id, { ...v, email: v.email || undefined }),
    onSuccess:  () => { invalidate(); closeModal(); },
    onError:    (e: Error) => setApiError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => CompanyService.remove(id),
    onSuccess:  () => { invalidate(); setDeleteId(null); },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openCreate = () => { setApiError(''); setModalState({ open: true, mode: 'create' }); };
  const openEdit   = (c: APICompany) => {
    setApiError('');
    setModalState({ open: true, mode: 'edit', company: c });
  };
  const closeModal = () => setModalState({ open: false });

  const onFormSubmit = (values: CreateForm | EditForm) => {
    setApiError('');
    if (modalState.open && modalState.mode === 'create') {
      createMut.mutate(values as CreateForm);
    } else if (modalState.open && modalState.mode === 'edit') {
      updateMut.mutate({ id: modalState.company.id, v: values as EditForm });
    }
  };

  const mutLoading = createMut.isPending || updateMut.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gerencie as empresas do sistema
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nova Empresa
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          className="input-field pl-9"
          placeholder="Buscar por nome ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Carregando...</div>
        ) : isError ? (
          <div className="p-8 text-center flex items-center justify-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            Erro ao carregar empresas
          </div>
        ) : companies.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              {debouncedSearch ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
            </p>
            {!debouncedSearch && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={openCreate}>
                Cadastrar primeira empresa
              </Button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="px-4 py-3 font-medium">CNPJ</th>
                  <th className="px-4 py-3 font-medium">Razão Social</th>
                  <th className="px-4 py-3 font-medium">Regime</th>
                  <th className="px-4 py-3 font-medium">Exercício</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Criado em</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    className={clsx(
                      'hover:bg-gray-50 transition-colors',
                      currentCompanyId === c.id && 'bg-primary-50'
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {formatCNPJ(c.cnpj)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                      {c.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={REGIME_BADGE[c.tax_regime]}>
                        {REGIME_OPTIONS.find((r) => r.value === c.tax_regime)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.fiscal_year_start ? MONTHS[c.fiscal_year_start - 1] : 'Janeiro'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('badge', c.is_active ? 'badge-green' : 'badge-gray')}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs tabular-nums">
                      {format(new Date(c.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Selecionar */}
                        <button
                          onClick={() => setCurrentCompany(c.id)}
                          title={currentCompanyId === c.id ? 'Empresa selecionada' : 'Selecionar empresa'}
                          className={clsx(
                            'rounded-lg p-1.5 transition-colors',
                            currentCompanyId === c.id
                              ? 'text-primary-600 bg-primary-100'
                              : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        {/* Editar */}
                        <button
                          onClick={() => openEdit(c)}
                          title="Editar empresa"
                          className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {/* Deletar */}
                        {deleteId === c.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <span className="text-xs text-red-600">Confirmar?</span>
                            <button
                              onClick={() => deleteMut.mutate(c.id)}
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
                            onClick={() => setDeleteId(c.id)}
                            title="Excluir empresa"
                            className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {pagination.total} {pagination.total === 1 ? 'empresa' : 'empresas'} no total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-700">
                Página {page} de {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === pagination.totalPages}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalState.open}
        onClose={closeModal}
        title={modalState.open && modalState.mode === 'edit' ? 'Editar Empresa' : 'Nova Empresa'}
        size="md"
      >
        <CompanyForm
          isEditing={modalState.open && modalState.mode === 'edit'}
          defaultValues={
            modalState.open && modalState.mode === 'edit'
              ? {
                  name:              modalState.company.name,
                  tax_regime:        modalState.company.tax_regime,
                  email:             modalState.company.email ?? '',
                  phone:             modalState.company.phone ?? '',
                  fiscal_year_start: modalState.company.fiscal_year_start ?? 1,
                }
              : undefined
          }
          loading={mutLoading}
          apiError={apiError}
          onSubmit={onFormSubmit}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}
