import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, 
  Download, 
  Plus, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import DASForm from '../../components/DAS/DASForm';
import DASList from '../../components/DAS/DASList';
import DASPaymentForm from '../../components/DAS/DASPaymentForm';
import { DASService, DASBoleto } from '../../services/dasService';

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; das: DASBoleto };

type PagamentoModalState =
  | { open: false }
  | {
      open: true;
      das: {
        id: string;
        numero_boleto?: string | null;
        mes_competencia: number;
        ano_competencia: number;
        valor_total: number;
        valor_pago: number;
        data_vencimento: string;
      };
    };

export default function DASPage() {
  const qc = useQueryClient();
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [pagamentoState, setPagamentoState] = useState<PagamentoModalState>({ open: false });
  const [apiError, setApiError] = useState('');
  const [regimeFilter, setRegimeFilter] = useState<'SIMPLES' | 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | ''>('SIMPLES');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);
  const [somenteNaoPagos, setSomenteNaoPagos] = useState(false);

  const params = useMemo(() => ({
    page: 1,
    limit: 50,
    regime_tributario: regimeFilter || undefined,
    status: statusFilter || undefined,
    somente_atrasadas: somenteAtrasadas || undefined,
    somente_nao_pagos: somenteNaoPagos || undefined,
    sort_by: 'data_vencimento' as const,
    sort_order: 'asc' as const,
  }), [regimeFilter, statusFilter, somenteAtrasadas, somenteNaoPagos]);

  const { data: listResponse, isLoading } = useQuery({
    queryKey: ['das', params],
    queryFn: () => DASService.list(params),
  });

  const { data: stats } = useQuery({
    queryKey: ['das-stats'],
    queryFn: () => DASService.getEstatisticas(),
  });

  // Criar DAS
  const createMutation = useMutation({
    mutationFn: (data: any) => DASService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['das'] });
      qc.invalidateQueries({ queryKey: ['das-stats'] });
      setModalState({ open: false });
      setApiError('');
    },
    onError: (err: any) => {
      setApiError(err.message || 'Erro ao criar DAS');
    },
  });

  // Registrar pagamento
  const paymentMutation = useMutation({
    mutationFn: (data: { dasId: string; payload: any }) =>
      DASService.registrarPagamento(data.dasId, data.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['das'] });
      qc.invalidateQueries({ queryKey: ['das-stats'] });
      setPagamentoState({ open: false });
      setApiError('');
    },
    onError: (err: any) => {
      setApiError(err.message || 'Erro ao registrar pagamento');
    },
  });

  // Cancelar DAS
  const cancelMutation = useMutation({
    mutationFn: (dasId: string) => DASService.cancelar(dasId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['das'] });
      qc.invalidateQueries({ queryKey: ['das-stats'] });
    },
    onError: (err: any) => {
      setApiError(err.message || 'Erro ao cancelar DAS');
    },
  });

  const handleDownloadBoleto = (das: DASBoleto) => {
    // TODO: Implementar download do PDF do boleto
    console.log('Download boleto:', das.numero_boleto);
  };

  const totalApagar = listResponse?.data.reduce((sum: number, das: DASBoleto) => 
    das.status !== 'PAGO' ? sum + (das.valor_total - das.valor_pago) : sum, 0
  ) || 0;

  const atrasados = listResponse?.data.filter((das: DASBoleto) => 
    das.status === 'VENCIDO'
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">DAS - Documento de Arrecadação do Simples</h1>
            </div>
            <Button
              onClick={() => setModalState({ open: true, mode: 'create' })}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Gerar DAS
            </Button>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total a Pagar</p>
                  <p className="text-2xl font-bold text-gray-900">R$ {totalApagar.toFixed(2)}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Atrasados</p>
                  <p className="text-2xl font-bold text-red-600">{atrasados.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Pagos este mês</p>
                  <p className="text-2xl font-bold text-green-600">
                    {listResponse?.data.filter((d: DASBoleto) => d.status === 'PAGO').length || 0}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total registrado</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {listResponse?.data.length || 0}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>

            <select
              value={regimeFilter}
              onChange={(e) => setRegimeFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Todos os regimes</option>
              <option value="SIMPLES">Simples Nacional</option>
              <option value="LUCRO_REAL">Lucro Real</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Todos os status</option>
              <option value="EMITIDO">Emitido</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PAGO">Pago</option>
              <option value="VENCIDO">Vencido</option>
              <option value="CANCELADO">Cancelado</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={somenteAtrasadas}
                onChange={(e) => setSomenteAtrasadas(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Apenas atrasados</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={somenteNaoPagos}
                onChange={(e) => setSomenteNaoPagos(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Apenas não pagos</span>
            </label>
          </div>
        </div>

        {/* Lista de DAS */}
        <div className="bg-white rounded-lg shadow">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
              <p className="text-gray-600 mt-2">Carregando...</p>
            </div>
          ) : listResponse?.data.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Nenhum DAS encontrado</p>
              <Button
                onClick={() => setModalState({ open: true, mode: 'create' })}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar primeiro DAS
              </Button>
            </div>
          ) : (
            <DASList
              dados={listResponse?.data.map((d: DASBoleto) => ({
                id: d.id,
                numero_boleto: d.numero_boleto,
                mes_competencia: d.mes_competencia,
                ano_competencia: d.ano_competencia,
                valor_original: d.valor_original,
                valor_total: d.valor_total,
                valor_pago: d.valor_pago,
                status: d.status,
                data_vencimento: d.data_vencimento,
                regime_tributario: d.codigo_receita === '0201' ? 'SIMPLES' : 'LUCRO_REAL',
                data_pagamento: d.data_pagamento,
                juros: d.juros,
                multa: d.multa,
              })) || []}
              onEdit={(das) => setModalState({ open: true, mode: 'edit', das: das as any })}
              onPay={(das) => {
                setPagamentoState({
                  open: true,
                  das: {
                    id: das.id,
                    numero_boleto: das.numero_boleto,
                    mes_competencia: das.mes_competencia,
                    ano_competencia: das.ano_competencia,
                    valor_total: das.valor_total,
                    valor_pago: das.valor_pago,
                    data_vencimento: das.data_vencimento,
                  },
                });
              }}
              onCancel={(das) => cancelMutation.mutate(das.id)}
              onDownload={(das) => handleDownloadBoleto(das as any)}
              isLoading={cancelMutation.isPending}
            />
          )}
        </div>

        {apiError && (
          <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {apiError}
          </div>
        )}

        {/* Modal: Criar/Editar DAS */}
        <Modal
          open={modalState.open}
          onClose={() => setModalState({ open: false })}
          title={modalState.open && modalState.mode === 'create' ? 'Criar DAS' : 'Editar DAS'}
        >
          {modalState.open && (
            <DASForm
              initialData={modalState.mode === 'edit' ? modalState.das : undefined}
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
              error={apiError}
            />
          )}
        </Modal>

        {/* Modal: Registrar Pagamento */}
        <Modal
          open={pagamentoState.open}
          onClose={() => setPagamentoState({ open: false })}
          title="Registrar Pagamento"
        >
          {pagamentoState.open && (
            <DASPaymentForm
              das={pagamentoState.das}
              onSubmit={(data) =>
                paymentMutation.mutate({
                  dasId: pagamentoState.das.id,
                  payload: data,
                })
              }
              isLoading={paymentMutation.isPending}
              error={apiError}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}
