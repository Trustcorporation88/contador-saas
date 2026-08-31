import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  AlertCircle,
  X,
  Info,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Disclosure } from '../../components/ui/Disclosure';
import {
  ProdutoService,
  type ProdutoInput,
  type ProdutoRecord,
} from '../../services/produtoService';

// ─── Form ─────────────────────────────────────────────────────────────────────

const digitos = (tamanho: number, msg: string) =>
  z.string().trim().refine((v) => v === '' || new RegExp(`^\\d{${tamanho}}$`).test(v), msg);

const percentual = z.coerce.number().min(0, 'Não pode ser negativo').max(100, 'Máximo 100%');

const schema = z.object({
  codigo:    z.string().trim().max(60, 'Máximo 60 caracteres'),
  // 120 é o limite do xProd na NF-e; o banco aceita mais, mas a nota não.
  descricao: z.string().trim().min(1, 'Informe a descrição').max(120, 'Máximo 120 caracteres (limite da NF-e)'),
  ncm:       digitos(8, 'NCM deve ter 8 dígitos'),
  cfop:      digitos(4, 'CFOP deve ter 4 dígitos'),
  unidade:   z.string().trim().max(6, 'Máximo 6 caracteres'),
  valor_unitario: z.coerce.number().min(0, 'Não pode ser negativo'),
  cst_icms:  z.string().trim().refine((v) => v === '' || /^\d{2,3}$/.test(v), 'CST tem 2 dígitos, CSOSN tem 3'),
  aliquota_icms:   percentual,
  aliquota_pis:    percentual,
  aliquota_cofins: percentual,
  cst_ipi:   digitos(2, 'CST do IPI tem 2 dígitos'),
  aliquota_ipi:    percentual,
});

type ProdutoForm = z.infer<typeof schema>;

const FORM_VAZIO: ProdutoForm = {
  codigo: '',
  descricao: '',
  ncm: '',
  cfop: '5102',
  unidade: 'UN',
  valor_unitario: 0,
  cst_icms: '',
  aliquota_icms: 0,
  aliquota_pis: 0,
  aliquota_cofins: 0,
  cst_ipi: '',
  aliquota_ipi: 0,
};

function formDoProduto(p: ProdutoRecord): ProdutoForm {
  return {
    codigo: p.codigo ?? '',
    descricao: p.descricao,
    ncm: p.ncm ?? '',
    cfop: p.cfop ?? '',
    unidade: p.unidade || 'UN',
    valor_unitario: Number(p.valor_unitario) || 0,
    cst_icms: p.cst_icms ?? '',
    aliquota_icms: Number(p.aliquota_icms) || 0,
    aliquota_pis: Number(p.aliquota_pis) || 0,
    aliquota_cofins: Number(p.aliquota_cofins) || 0,
    cst_ipi: p.cst_ipi ?? '',
    aliquota_ipi: Number(p.aliquota_ipi) || 0,
  };
}

function payloadDoForm(f: ProdutoForm): ProdutoInput {
  return {
    codigo: f.codigo || undefined,
    descricao: f.descricao,
    ncm: f.ncm || undefined,
    cfop: f.cfop || undefined,
    unidade: f.unidade || 'UN',
    valor_unitario: f.valor_unitario,
    cst_icms: f.cst_icms || undefined,
    aliquota_icms: f.aliquota_icms,
    aliquota_pis: f.aliquota_pis,
    aliquota_cofins: f.aliquota_cofins,
    cst_ipi: f.cst_ipi || undefined,
    aliquota_ipi: f.aliquota_ipi,
  };
}

interface ProdutoFormProps {
  defaultValues: ProdutoForm;
  isEditing: boolean;
  loading: boolean;
  apiError: string;
  onSubmit: (data: ProdutoForm) => void;
  onCancel: () => void;
}

function ProdutoFormFields({ defaultValues, isEditing, loading, apiError, onSubmit, onCancel }: ProdutoFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<ProdutoForm>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label="Código" placeholder="Opcional" error={errors.codigo?.message} {...register('codigo')} />
        <div className="sm:col-span-2">
          <Input label="Descrição *" placeholder="Como sai na nota" error={errors.descricao?.message} {...register('descricao')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input label="NCM" placeholder="84212300" maxLength={8} inputMode="numeric" error={errors.ncm?.message} {...register('ncm')} />
        <Input label="CFOP" placeholder="5102" maxLength={4} inputMode="numeric" error={errors.cfop?.message} {...register('cfop')} />
        <Input label="Unidade" placeholder="UN" maxLength={6} error={errors.unidade?.message} {...register('unidade')} />
        <Input label="Valor unitário" type="number" step="0.01" min={0} error={errors.valor_unitario?.message} {...register('valor_unitario')} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input
          label="CST ICMS"
          placeholder="00"
          maxLength={3}
          inputMode="numeric"
          hint="Regime normal. No Simples a nota sai com CSOSN 102."
          error={errors.cst_icms?.message}
          {...register('cst_icms')}
        />
        <Input label="Alíq. ICMS %" type="number" step="0.01" min={0} error={errors.aliquota_icms?.message} {...register('aliquota_icms')} />
        <Input label="Alíq. PIS %" type="number" step="0.01" min={0} error={errors.aliquota_pis?.message} {...register('aliquota_pis')} />
        <Input label="Alíq. COFINS %" type="number" step="0.01" min={0} error={errors.aliquota_cofins?.message} {...register('aliquota_cofins')} />
      </div>

      <Disclosure label="IPI (só contribuinte: indústria e importador)">
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Input label="CST IPI" placeholder="50" maxLength={2} inputMode="numeric" error={errors.cst_ipi?.message} {...register('cst_ipi')} />
          <Input label="Alíq. IPI %" type="number" step="0.01" min={0} error={errors.aliquota_ipi?.message} {...register('aliquota_ipi')} />
        </div>
      </Disclosure>

      {apiError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {isEditing ? 'Salvar alterações' : 'Cadastrar produto'}
        </Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; produto: ProdutoRecord };

const brl = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function mensagemDeErro(e: unknown): string {
  const erro = e as Error & { response?: { data?: { error?: string; message?: string } } };
  return erro.response?.data?.error || erro.response?.data?.message || erro.message || 'Erro inesperado';
}

export default function ProdutosPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId) || '';
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [apiError, setApiError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['produtos', companyId, page, debouncedSearch],
    queryFn: () => ProdutoService.listar(companyId, { page, limit: 20, q: debouncedSearch || undefined }),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
  });

  const produtos = data?.data ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  // A busca da emissão (ProdutoBusca) lê a mesma tabela: invalida as duas.
  const invalidar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['produtos', companyId] }),
      qc.invalidateQueries({ queryKey: ['produtos-busca', companyId] }),
    ]);

  const fecharModal = () => {
    setModal({ open: false });
    setApiError('');
  };

  const createMut = useMutation({
    mutationFn: (payload: ProdutoInput) => ProdutoService.criar(companyId, payload),
    onSuccess: async () => {
      await invalidar();
      fecharModal();
    },
    onError: (e) => setApiError(mensagemDeErro(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProdutoInput }) =>
      ProdutoService.atualizar(companyId, id, payload),
    onSuccess: async () => {
      await invalidar();
      fecharModal();
    },
    onError: (e) => setApiError(mensagemDeErro(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => ProdutoService.remover(companyId, id),
    onSuccess: async () => {
      setDeleteId(null);
      setDeleteError('');
      await invalidar();
    },
    onError: (e) => setDeleteError(mensagemDeErro(e)),
  });

  const onSubmit = (form: ProdutoForm) => {
    setApiError('');
    const payload = payloadDoForm(form);
    if (modal.open && modal.mode === 'edit') {
      updateMut.mutate({ id: modal.produto.id, payload });
    } else {
      createMut.mutate(payload);
    }
  };

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="card p-6 text-sm text-gray-600">
          Selecione uma empresa para ver o catálogo de produtos.
        </div>
      </div>
    );
  }

  const hasSearch = debouncedSearch.trim().length > 0;
  const mutLoading = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="glass-strip flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <p className="shell-title">Cadastro fiscal</p>
          <h1 className="text-xl font-bold text-gray-900">Produtos</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Catálogo usado pelo campo de busca de produto na emissão de NF-e
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-blue">{data?.total ?? 0} no catálogo</span>
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setApiError('');
              setModal({ open: true, mode: 'create' });
            }}
          >
            Novo produto
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Este catálogo se alimenta sozinho: todo item de uma NF-e criada entra ou é atualizado aqui, com os
          dados fiscais da nota mais recente. Cadastre à mão só o que ainda não foi emitido ou o que precisa de
          ajuste antes da próxima nota.
        </span>
      </div>

      {/* Search */}
      <div className="glass-strip flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            className="input-field pl-9"
            placeholder="Buscar por descrição, código ou NCM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Carregando...</div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 p-8 text-center text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            Erro ao carregar o catálogo de produtos
          </div>
        ) : produtos.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              {hasSearch
                ? 'Nenhum produto encontrado para a busca atual'
                : 'Nenhum produto no catálogo ainda. Emita uma NF-e ou cadastre o primeiro produto.'}
            </p>
            {!hasSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setModal({ open: true, mode: 'create' })}
              >
                Cadastrar primeiro produto
              </Button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">NCM</th>
                  <th className="px-4 py-3 font-medium">CFOP</th>
                  <th className="px-4 py-3 font-medium">CST</th>
                  <th className="px-4 py-3 font-medium">Un.</th>
                  <th className="px-4 py-3 text-right font-medium">Valor unit.</th>
                  <th className="px-4 py-3 font-medium">Emissões</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {produtos.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.codigo || <span className="text-gray-300">sem código</span>}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-gray-900" title={p.descricao}>{p.descricao}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.ncm || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.cfop || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {p.cst_icms ? `${p.cst_icms.length === 3 ? 'CSOSN ' : ''}${p.cst_icms}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.unidade}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{brl(p.valor_unitario)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.vezes_emitido > 0 ? (
                        <span title={p.ultima_emissao_em ? `Última: ${format(new Date(p.ultima_emissao_em), 'dd/MM/yyyy')}` : undefined}>
                          {p.vezes_emitido}
                          {p.ultima_emissao_em && (
                            <span className="ml-1 text-gray-400">
                              ({format(new Date(p.ultima_emissao_em), 'dd/MM/yy')})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className={clsx('badge', 'badge-gray')}>manual</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setApiError('');
                            setModal({ open: true, mode: 'edit', produto: p });
                          }}
                          title="Editar produto"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {deleteId === p.id ? (
                          <div className="ml-1 flex items-center gap-1">
                            <span className="text-xs text-red-600">{deleteError || 'Confirmar?'}</span>
                            <button
                              onClick={() => deleteMut.mutate(p.id)}
                              disabled={deleteMut.isPending}
                              className="rounded bg-red-600 px-2 py-0.5 text-xs text-white transition-colors hover:bg-red-700"
                            >
                              {deleteMut.isPending ? '...' : 'Sim'}
                            </button>
                            <button
                              onClick={() => {
                                setDeleteId(null);
                                setDeleteError('');
                              }}
                              className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 transition-colors hover:bg-gray-300"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setDeleteError('');
                              setDeleteId(p.id);
                            }}
                            title="Excluir do catálogo (não afeta notas já emitidas)"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
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

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span>{data.total} produto(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                Anterior
              </Button>
              <span className="text-xs">Página {page} de {totalPages}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modal.open}
        onClose={fecharModal}
        title={modal.open && modal.mode === 'edit' ? 'Editar produto' : 'Novo produto'}
        size="lg"
      >
        {modal.open && (
          <ProdutoFormFields
            key={modal.mode === 'edit' ? modal.produto.id : 'novo'}
            defaultValues={modal.mode === 'edit' ? formDoProduto(modal.produto) : FORM_VAZIO}
            isEditing={modal.mode === 'edit'}
            loading={mutLoading}
            apiError={apiError}
            onSubmit={onSubmit}
            onCancel={fecharModal}
          />
        )}
      </Modal>
    </div>
  );
}
