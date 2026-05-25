import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { DASService, DASBoleto } from '../../services/dasService';
import { DASForm, DASList, DASPaymentForm } from '../../components/DAS';
import { Plus, BarChart3, Settings, AlertCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface DASFormData {
  mes_competencia: number;
  ano_competencia: number;
  valor_original: number;
  regime_tributario: 'SIMPLES' | 'LUCRO_REAL' | 'LUCRO_PRESUMIDO';
  descricao?: string;
}

interface PaymentFormData {
  data_pagamento: string;
  valor_pago: number;
  comprovante?: string;
  juros?: number;
  multa?: number;
  observacoes?: string;
}

export default function DASPage() {
  const { currentCompanyId } = useAuthStore();
  const queryClient = useQueryClient();

  // States
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDAS, setSelectedDAS] = useState<DASBoleto | null>(null);
  const [createError, setCreateError] = useState<string>();
  const [paymentError, setPaymentError] = useState<string>();

  const companyId = currentCompanyId || '';

  // Fetch DAS list
  const { data: dasListData, isLoading: isLoadingList, error: listError } = useQuery({
    queryKey: ['das-list', companyId, currentPage, statusFilter],
    queryFn: () => {
      if (!companyId) throw new Error('Company ID not found');
      return DASService.list(companyId, {
        page: currentPage,
        limit: 10,
        status: statusFilter || undefined,
        sort_by: 'data_vencimento',
        sort_order: 'asc',
      });
    },
    enabled: !!companyId,
  });

  // Fetch statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['das-stats', companyId],
    queryFn: () => {
      if (!companyId) throw new Error('Company ID not found');
      return DASService.getEstatisticas(companyId);
    },
    enabled: !!companyId,
  });

  // Create DAS mutation
  const createMutation = useMutation({
    mutationFn: (data: DASFormData) => {
      if (!companyId) throw new Error('Company ID not found');
      return DASService.create(companyId, {
        mes_competencia: data.mes_competencia,
        ano_competencia: data.ano_competencia,
        valor_original: data.valor_original,
        regime_tributario: data.regime_tributario,
        observacoes: data.descricao,
      });
    },
    onSuccess: () => {
      setShowCreateModal(false);
      setCreateError(undefined);
      queryClient.invalidateQueries({ queryKey: ['das-list'] });
      queryClient.invalidateQueries({ queryKey: ['das-stats'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Erro ao criar DAS';
      setCreateError(message);
    },
  });

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) => {
      if (!companyId || !selectedDAS) throw new Error('Missing data');
      return DASService.registrarPagamento(companyId, selectedDAS.id, {
        data_pagamento: data.data_pagamento,
        valor_pago: data.valor_pago,
        juros_pago: data.juros,
        multa_paga: data.multa,
        numero_comprovante: data.comprovante,
      });
    },
    onSuccess: () => {
      setShowPaymentModal(false);
      setSelectedDAS(null);
      setPaymentError(undefined);
      queryClient.invalidateQueries({ queryKey: ['das-list'] });
      queryClient.invalidateQueries({ queryKey: ['das-stats'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Erro ao registrar pagamento';
      setPaymentError(message);
    },
  });

  // Cancel DAS mutation
  const cancelMutation = useMutation({
    mutationFn: (dasId: string) => {
      if (!companyId) throw new Error('Company ID not found');
      return DASService.cancelar(companyId, dasId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['das-list'] });
      queryClient.invalidateQueries({ queryKey: ['das-stats'] });
    },
  });

  // Computed values
  const dasList = dasListData?.data || [];
  const pagination = dasListData?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const nextVencimento = useMemo(() => {
    const hoje = new Date();
    const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
    return dasList.filter(d => {
      const venc = new Date(d.data_vencimento);
      return venc > hoje && venc <= em30dias && d.status !== 'PAGO' && d.status !== 'CANCELADO';
    }).length;
  }, [dasList]);

  // Handlers
  const handleCreateSubmit = (data: DASFormData) => {
    createMutation.mutate(data);
  };

  const handlePaymentSubmit = (data: PaymentFormData) => {
    paymentMutation.mutate(data);
  };

  const handleEdit = (das: DASBoleto) => {
    // Edit functionality would be implemented if needed
    console.log('Edit DAS:', das);
  };

  const handlePay = (das: DASBoleto) => {
    setSelectedDAS(das);
    setShowPaymentModal(true);
    setPaymentError(undefined);
  };

  const handleCancel = async (das: DASBoleto) => {
    if (window.confirm(`Deseja cancelar o DAS ${das.mes_competencia}/${das.ano_competencia}?`)) {
      cancelMutation.mutate(das.id);
    }
  };

  const handleDownload = (das: DASBoleto) => {
    // Download PDF functionality would be implemented if needed
    console.log('Download DAS PDF:', das);
  };

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-3" />
          <p className="text-gray-700 font-medium">Empresa não selecionada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DAS</h1>
          <p className="text-gray-600 text-sm mt-1">
            Declaração de Impostos Simplificada
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateError(undefined);
            }}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Plus size={18} />
            Criar DAS
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <BarChart3 size={18} />
            Relatório
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <Settings size={18} />
            Config
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total DAS */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 uppercase tracking-wide">Total DAS</p>
              {isLoadingStats ? (
                <div className="h-8 bg-gray-200 rounded animate-pulse mt-2 w-24"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats?.totalRegistrado || 0}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                A pagar: R$ {(stats?.totalApagar || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 uppercase tracking-wide">Vencidos</p>
              {isLoadingStats ? (
                <div className="h-8 bg-gray-200 rounded animate-pulse mt-2 w-24"></div>
              ) : (
                <p className="text-2xl font-bold text-red-600 mt-2">
                  {stats?.atrasados || 0}
                </p>
              )}
              <p className="text-xs text-red-500 mt-2">Atenção necessária</p>
            </div>
            <AlertCircle className="text-red-500" size={24} />
          </div>
        </div>

        {/* Next 30 Days */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 uppercase tracking-wide">Próx. 30 dias</p>
              {isLoadingList ? (
                <div className="h-8 bg-gray-200 rounded animate-pulse mt-2 w-24"></div>
              ) : (
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {nextVencimento}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">A vencer</p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Filters */}
        <div className="border-b border-gray-200 p-4 flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setStatusFilter('');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              statusFilter === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {['PENDENTE', 'VENCIDO', 'PAGO', 'CANCELADO'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* List */}
        <div>
          {listError ? (
            <div className="p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-3" />
              <p className="text-red-700 font-medium">
                {listError instanceof Error ? listError.message : 'Erro ao carregar DAS'}
              </p>
            </div>
          ) : (
            <DASList
              dados={dasList as any}
              isLoading={isLoadingList}
              onEdit={(das) => handleEdit(das as DASBoleto)}
              onCancel={(das) => handleCancel(das as DASBoleto)}
              onPay={(das) => handlePay(das as DASBoleto)}
              onDownload={(das) => handleDownload(das as DASBoleto)}
            />
          )}
        </div>

        {/* Pagination */}
        {!isLoadingList && dasList.length > 0 && (
          <div className="border-t border-gray-200 p-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create DAS Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Criar novo DAS</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(undefined);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <DASForm
                onSubmit={handleCreateSubmit}
                isLoading={createMutation.isPending}
                error={createError}
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedDAS && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Registrar pagamento</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedDAS(null);
                  setPaymentError(undefined);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <DASPaymentForm
                das={selectedDAS}
                onSubmit={handlePaymentSubmit}
                isLoading={paymentMutation.isPending}
                error={paymentError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
