import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CreditCard, RefreshCw, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import ContaPagarForm from '../../components/ContasPagar/ContaPagarForm';
import ContasPagarList from '../../components/ContasPagar/ContasPagarList';
import {
  CategoriaContaPagar,
  ContaPagar,
  ContaPagarPayload,
  ContasPagarService,
  FormaPagamentoContaPagar,
  RegistrarPagamentoPayload,
  StatusContaPagar,
} from '../../services/contasPagarService';

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; conta: ContaPagar };

type PagamentoModalState =
  | { open: false }
  | { open: true; conta: ContaPagar };

interface PagamentoForm {
  data_pagamento: string;
  valor_pago: number;
  juros: number;
  multa: number;
  desconto: number;
  forma_pagamento: FormaPagamentoContaPagar;
  observacoes: string;
}

export default function ContasPagarPage() {
  const qc = useQueryClient();
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [pagamentoState, setPagamentoState] = useState<PagamentoModalState>({ open: false });
  const [apiError, setApiError] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [status, setStatus] = useState<StatusContaPagar | ''>('');
  const [categoria, setCategoria] = useState<CategoriaContaPagar | ''>('');
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);

  const params = useMemo(() => ({
    page: 1,
    limit: 50,
    fornecedor_nome: fornecedorNome || undefined,
    status: status || undefined,
    categoria: categoria || undefined,
    somente_atrasadas: somenteAtrasadas || undefined,
    sort_by: 'data_vencimento' as const,
    sort_order: 'asc' as const,
  }), [fornecedorNome, status, categoria, somenteAtrasadas]);

  const { data: listResponse, isLoading } = useQuery({
    queryKey: ['contas-pagar', params],
    queryFn: () => ContasPagarService.list(params),
  });

  const { data: stats } = useQuery({
    queryKey: ['contas-pagar-stats'],
    queryFn: () => ContasPagarService.getEstatisticas(),
  });

  const pagamentoForm = useForm<PagamentoForm>({
    defaultValues: {
      data_pagamento: new Date().toISOString().slice(0, 10),
      valor_pago: 0,
      juros: 0,
      multa: 0,
      desconto: 0,
      forma_pagamento: 'pix',
      observacoes: '',
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['contas-pagar'] });
    await qc.invalidateQueries({ queryKey: ['contas-pagar-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: ContaPagarPayload) => ContasPagarService.create(payload),
    onSuccess: async () => {
      setApiError('');
      setModalState({ open: false });
      await invalidate();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ContaPagarPayload }) => ContasPagarService.update(id, payload),
    onSuccess: async () => {
      setApiError('');
      setModalState({ open: false });
      await invalidate();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => ContasPagarService.cancelar(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const pagamentoMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RegistrarPagamentoPayload }) => ContasPagarService.registrarPagamento(id, payload),
    onSuccess: async () => {
      setPagamentoState({ open: false });
      pagamentoForm.reset({
        data_pagamento: new Date().toISOString().slice(0, 10),
        valor_pago: 0,
        juros: 0,
        multa: 0,
        desconto: 0,
        forma_pagamento: 'pix',
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
          <h1 className="text-xl font-bold text-gray-900">Contas a Pagar</h1>
          <p className="mt-1 text-sm text-gray-500">Controle saídas, vencimentos, pagamentos parciais e obrigações vencidas com fornecedores e despesas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => invalidate()}>
            Atualizar
          </Button>
          <Button type="button" icon={<Wallet className="h-4 w-4" />} onClick={() => { setApiError(''); setModalState({ open: true, mode: 'create' }); }}>
            Nova obrigação
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Em aberto</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{(stats?.total_aberto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Pago</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{(stats?.total_pago || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
          <label className="input-label">Fornecedor</label>
          <input className="input-field" value={fornecedorNome} onChange={(event) => setFornecedorNome(event.target.value)} placeholder="Buscar por fornecedor ou descrição" />
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input-field min-w-40" value={status} onChange={(event) => setStatus(event.target.value as StatusContaPagar | '')}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="parcial">Parcial</option>
            <option value="pago">Pago</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="input-label">Categoria</label>
          <select className="input-field min-w-40" value={categoria} onChange={(event) => setCategoria(event.target.value as CategoriaContaPagar | '')}>
            <option value="">Todas</option>
            <option value="boleto">Boleto</option>
            <option value="fornecedor">Fornecedor</option>
            <option value="imposto">Imposto</option>
            <option value="salario">Salário</option>
            <option value="aluguel">Aluguel</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" checked={somenteAtrasadas} onChange={(event) => setSomenteAtrasadas(event.target.checked)} />
          Somente vencidas
        </label>
      </div>

      <ContasPagarList
        contas={contas}
        loading={isLoading}
        onEdit={(conta) => { setApiError(''); setModalState({ open: true, mode: 'edit', conta }); }}
        onPagar={(conta) => {
          pagamentoForm.reset({
            data_pagamento: new Date().toISOString().slice(0, 10),
            valor_pago: Number(conta.saldo_aberto || 0),
            juros: 0,
            multa: 0,
            desconto: 0,
            forma_pagamento: 'pix',
            observacoes: '',
          });
          setPagamentoState({ open: true, conta });
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
            <CreditCard className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Próximos 30 dias</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{(stats?.proximos_30_dias || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Total de obrigações</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.total_titulos || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.open && modalState.mode === 'edit' ? 'Editar conta a pagar' : 'Nova conta a pagar'}
        size="lg"
      >
        <ContaPagarForm
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
        open={pagamentoState.open}
        onClose={() => setPagamentoState({ open: false })}
        title="Registrar pagamento"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={pagamentoForm.handleSubmit((values) => {
            if (!pagamentoState.open) return;
            pagamentoMutation.mutate({ id: pagamentoState.conta.id, payload: values });
          })}
        >
          {pagamentoState.open && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{pagamentoState.conta.fornecedor_nome}</p>
              <p>Saldo aberto: {(Number(pagamentoState.conta.saldo_aberto || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Data do pagamento" type="date" {...pagamentoForm.register('data_pagamento')} />
            <Input label="Valor pago" type="number" step="0.01" {...pagamentoForm.register('valor_pago', { valueAsNumber: true })} />
            <Input label="Juros" type="number" step="0.01" {...pagamentoForm.register('juros', { valueAsNumber: true })} />
            <Input label="Multa" type="number" step="0.01" {...pagamentoForm.register('multa', { valueAsNumber: true })} />
            <Input label="Desconto" type="number" step="0.01" {...pagamentoForm.register('desconto', { valueAsNumber: true })} />
            <div>
              <label className="input-label">Forma de pagamento</label>
              <select className="input-field" {...pagamentoForm.register('forma_pagamento')}>
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
            <textarea className="input-field min-h-24" {...pagamentoForm.register('observacoes')} />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setPagamentoState({ open: false })}>Cancelar</Button>
            <Button type="submit" loading={pagamentoMutation.isPending}>Confirmar pagamento</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}