import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, HandCoins, RefreshCw, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import ContaReceberForm from '../../components/ContasReceber/ContaReceberForm';
import ContasReceberList from '../../components/ContasReceber/ContasReceberList';
import {
  ContaReceber,
  ContaReceberPayload,
  ContasReceberService,
  FormaRecebimento,
  RegistrarRecebimentoPayload,
  StatusContaReceber,
  CategoriaContaReceber,
} from '../../services/contasReceberService';

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; conta: ContaReceber };

type RecebimentoModalState =
  | { open: false }
  | { open: true; conta: ContaReceber };

interface RecebimentoForm {
  data_recebimento: string;
  valor_recebido: number;
  juros: number;
  multa: number;
  desconto: number;
  forma_recebimento: FormaRecebimento;
  observacoes: string;
}

export default function ContasReceberPage() {
  const qc = useQueryClient();
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [recebimentoState, setRecebimentoState] = useState<RecebimentoModalState>({ open: false });
  const [apiError, setApiError] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [status, setStatus] = useState<StatusContaReceber | ''>('');
  const [categoria, setCategoria] = useState<CategoriaContaReceber | ''>('');
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);

  const params = useMemo(() => ({
    page: 1,
    limit: 50,
    cliente_nome: clienteNome || undefined,
    status: status || undefined,
    categoria: categoria || undefined,
    somente_atrasadas: somenteAtrasadas || undefined,
    sort_by: 'data_vencimento' as const,
    sort_order: 'asc' as const,
  }), [clienteNome, status, categoria, somenteAtrasadas]);

  const { data: listResponse, isLoading } = useQuery({
    queryKey: ['contas-receber', params],
    queryFn: () => ContasReceberService.list(params),
  });

  const { data: stats } = useQuery({
    queryKey: ['contas-receber-stats'],
    queryFn: () => ContasReceberService.getEstatisticas(),
  });

  const recebimentoForm = useForm<RecebimentoForm>({
    defaultValues: {
      data_recebimento: new Date().toISOString().slice(0, 10),
      valor_recebido: 0,
      juros: 0,
      multa: 0,
      desconto: 0,
      forma_recebimento: 'pix',
      observacoes: '',
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['contas-receber'] });
    await qc.invalidateQueries({ queryKey: ['contas-receber-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: ContaReceberPayload) => ContasReceberService.create(payload),
    onSuccess: async () => {
      setApiError('');
      setModalState({ open: false });
      await invalidate();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ContaReceberPayload }) => ContasReceberService.update(id, payload),
    onSuccess: async () => {
      setApiError('');
      setModalState({ open: false });
      await invalidate();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => ContasReceberService.cancelar(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const recebimentoMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RegistrarRecebimentoPayload }) => ContasReceberService.registrarRecebimento(id, payload),
    onSuccess: async () => {
      setRecebimentoState({ open: false });
      recebimentoForm.reset({
        data_recebimento: new Date().toISOString().slice(0, 10),
        valor_recebido: 0,
        juros: 0,
        multa: 0,
        desconto: 0,
        forma_recebimento: 'pix',
        observacoes: '',
      });
      await invalidate();
    },
  });

  const contas = listResponse?.data || [];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="glass-strip flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <p className="shell-title">Operação financeira</p>
          <h1 className="text-xl font-bold text-gray-900">Contas a Receber</h1>
          <p className="mt-1 text-sm text-gray-500">Acompanhe vencimentos, atrasos, recebimentos parciais e liquidação dos títulos dos clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => invalidate()}>
            Atualizar
          </Button>
          <Button type="button" icon={<Wallet className="h-4 w-4" />} onClick={() => { setApiError(''); setModalState({ open: true, mode: 'create' }); }}>
            Novo título
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Em aberto</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{(stats?.total_aberto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Recebido</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{(stats?.total_recebido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Vencido</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{(stats?.total_vencido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Próximos 7 dias</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{(stats?.proximos_7_dias || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
      </div>

      <div className="glass-strip flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-56 flex-1">
          <label className="input-label">Cliente</label>
          <input className="input-field" value={clienteNome} onChange={(event) => setClienteNome(event.target.value)} placeholder="Buscar por cliente ou descrição" />
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input-field min-w-40" value={status} onChange={(event) => setStatus(event.target.value as StatusContaReceber | '')}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="parcial">Parcial</option>
            <option value="recebido">Recebido</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="input-label">Categoria</label>
          <select className="input-field min-w-40" value={categoria} onChange={(event) => setCategoria(event.target.value as CategoriaContaReceber | '')}>
            <option value="">Todas</option>
            <option value="boleto">Boleto</option>
            <option value="duplicata">Duplicata</option>
            <option value="promissoria">Promissória</option>
            <option value="pix">Pix</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" checked={somenteAtrasadas} onChange={(event) => setSomenteAtrasadas(event.target.checked)} />
          Somente atrasadas
        </label>
      </div>

      <ContasReceberList
        contas={contas}
        loading={isLoading}
        onEdit={(conta) => { setApiError(''); setModalState({ open: true, mode: 'edit', conta }); }}
        onReceber={(conta) => {
          recebimentoForm.reset({
            data_recebimento: new Date().toISOString().slice(0, 10),
            valor_recebido: Number(conta.saldo_aberto || 0),
            juros: 0,
            multa: 0,
            desconto: 0,
            forma_recebimento: 'pix',
            observacoes: '',
          });
          setRecebimentoState({ open: true, conta });
        }}
        onCancelar={(conta) => cancelMutation.mutate(conta.id)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Próximos 14 dias</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{(stats?.proximos_14_dias || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <HandCoins className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Próximos 30 dias</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{(stats?.proximos_30_dias || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Total de títulos</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{stats?.total_titulos || 0}</p>
        </div>
      </div>

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.open && modalState.mode === 'edit' ? 'Editar conta a receber' : 'Novo título a receber'}
        size="lg"
      >
        <ContaReceberForm
          initialData={modalState.open && modalState.mode === 'edit' ? modalState.conta : undefined}
          loading={createMutation.isPending || updateMutation.isPending}
          apiError={apiError}
          onCancel={() => setModalState({ open: false })}
          onSubmit={(payload) => {
            if (modalState.open && modalState.mode === 'edit') {
              updateMutation.mutate({ id: modalState.conta.id, payload });
              return;
            }
            createMutation.mutate(payload);
          }}
        />
      </Modal>

      <Modal
        open={recebimentoState.open}
        onClose={() => setRecebimentoState({ open: false })}
        title="Registrar recebimento"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={recebimentoForm.handleSubmit((values) => {
            if (!recebimentoState.open) return;
            recebimentoMutation.mutate({ id: recebimentoState.conta.id, payload: values });
          })}
        >
          {recebimentoState.open && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{recebimentoState.conta.cliente_nome}</p>
              <p>Saldo aberto: {(Number(recebimentoState.conta.saldo_aberto || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Data do recebimento" type="date" {...recebimentoForm.register('data_recebimento')} />
            <Input label="Valor recebido" type="number" step="0.01" {...recebimentoForm.register('valor_recebido', { valueAsNumber: true })} />
            <Input label="Juros" type="number" step="0.01" {...recebimentoForm.register('juros', { valueAsNumber: true })} />
            <Input label="Multa" type="number" step="0.01" {...recebimentoForm.register('multa', { valueAsNumber: true })} />
            <Input label="Desconto" type="number" step="0.01" {...recebimentoForm.register('desconto', { valueAsNumber: true })} />
            <div>
              <label className="input-label">Forma de recebimento</label>
              <select className="input-field" {...recebimentoForm.register('forma_recebimento')}>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Observações</label>
            <textarea className="input-field min-h-24" {...recebimentoForm.register('observacoes')} />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setRecebimentoState({ open: false })}>Cancelar</Button>
            <Button type="submit" loading={recebimentoMutation.isPending}>Confirmar recebimento</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}