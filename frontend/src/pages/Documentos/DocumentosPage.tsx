import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Filter, Landmark, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import DocumentoForm from '../../components/Documentos/DocumentoForm';
import DocumentosList from '../../components/Documentos/DocumentosList';
import {
  DocumentoFiscalService,
  type DocumentoFiscal,
  type DocumentoFiscalPayload,
  type DocumentoFiscalListParams,
  type StatusDocumentoFiscal,
  type TipoDocumentoFiscal,
} from '../../services/documentoFiscalService';

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; documento: DocumentoFiscal };

export default function DocumentosPage() {
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const qc = useQueryClient();

  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [apiError, setApiError] = useState('');
  const [tipo, setTipo] = useState<TipoDocumentoFiscal | ''>('');
  const [status, setStatus] = useState<StatusDocumentoFiscal | ''>('');
  const [search, setSearch] = useState('');

  const params: DocumentoFiscalListParams = useMemo(() => ({
    page: 1,
    limit: 50,
    tipo: tipo || undefined,
    status: status || undefined,
    descricao: search || undefined,
    sort_by: 'created_at',
    sort_order: 'desc',
  }), [tipo, status, search]);

  const { data: listResponse, isLoading } = useQuery({
    queryKey: ['documentos', currentCompanyId, params],
    queryFn: () => DocumentoFiscalService.list(params),
    enabled: !!currentCompanyId,
  });

  const { data: stats } = useQuery({
    queryKey: ['documentos-stats', currentCompanyId],
    queryFn: () => DocumentoFiscalService.getEstatisticas(),
    enabled: !!currentCompanyId,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['documentos', currentCompanyId] });
    await qc.invalidateQueries({ queryKey: ['documentos-stats', currentCompanyId] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: DocumentoFiscalPayload) => DocumentoFiscalService.create(payload),
    onSuccess: async () => {
      setApiError('');
      setModalState({ open: false });
      await invalidate();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DocumentoFiscalPayload }) => DocumentoFiscalService.update(id, payload),
    onSuccess: async () => {
      setApiError('');
      setModalState({ open: false });
      await invalidate();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const registrarMutation = useMutation({
    mutationFn: (id: string) => DocumentoFiscalService.registrar(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: (id: string) => DocumentoFiscalService.cancelar(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const documentos = listResponse?.data || [];

  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <Landmark className="mx-auto mb-3 h-12 w-12 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-900">Selecione uma empresa</h1>
        <p className="mt-2 text-sm text-gray-500">Os documentos fiscais ficam vinculados à empresa ativa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="glass-strip flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <p className="shell-title">Operação fiscal</p>
          <h1 className="text-xl font-bold text-gray-900">Documentos Fiscais</h1>
          <p className="mt-1 text-sm text-gray-500">Cadastre, registre e acompanhe documentos de entrada e saída com contexto operacional.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => invalidate()}>
            Atualizar
          </Button>
          <Button type="button" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => { setApiError(''); setModalState({ open: true, mode: 'create' }); }}>
            Novo documento
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr_0.9fr]">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Valor total em documentos</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {(stats?.total_valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Total cadastrado</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{stats?.total_documentos || documentos.length}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Registrados</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{stats?.por_status?.registrado?.quantidade || 0}</p>
        </div>
      </div>

      <div className="glass-strip flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-56 flex-1">
          <label className="input-label">Busca rápida</label>
          <input className="input-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição, número ou contraparte" />
        </div>
        <div>
          <label className="input-label">Tipo</label>
          <select className="input-field min-w-40" value={tipo} onChange={(event) => setTipo(event.target.value as TipoDocumentoFiscal | '')}>
            <option value="">Todos</option>
            <option value="nfe">NF-e</option>
            <option value="boleto">Boleto</option>
            <option value="recibo">Recibo</option>
            <option value="cupom_fiscal">Cupom fiscal</option>
          </select>
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input-field min-w-40" value={status} onChange={(event) => setStatus(event.target.value as StatusDocumentoFiscal | '')}>
            <option value="">Todos</option>
            <option value="rascunho">Rascunho</option>
            <option value="registrado">Registrado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <Button type="button" variant="ghost" icon={<Filter className="h-4 w-4" />} onClick={() => { setSearch(''); setTipo(''); setStatus(''); }}>
          Limpar filtros
        </Button>
      </div>

      <DocumentosList
        documentos={documentos}
        loading={isLoading}
        onEdit={(documento) => { setApiError(''); setModalState({ open: true, mode: 'edit', documento }); }}
        onRegistrar={(documento) => registrarMutation.mutate(documento.id)}
        onCancelar={(documento) => cancelarMutation.mutate(documento.id)}
      />

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.open && modalState.mode === 'edit' ? 'Editar documento' : 'Novo documento fiscal'}
        size="lg"
      >
        <DocumentoForm
          initialData={modalState.open && modalState.mode === 'edit' ? modalState.documento : undefined}
          apiError={apiError}
          loading={createMutation.isPending || updateMutation.isPending}
          onCancel={() => setModalState({ open: false })}
          onSubmit={(payload) => {
            if (modalState.open && modalState.mode === 'edit') {
              updateMutation.mutate({ id: modalState.documento.id, payload });
              return;
            }
            createMutation.mutate(payload);
          }}
        />
      </Modal>
    </div>
  );
}