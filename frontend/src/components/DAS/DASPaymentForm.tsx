import React from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Loader2, AlertCircle } from 'lucide-react';

interface DASPaymentFormProps {
  das: {
    id: string;
    numero_boleto?: string | null;
    mes_competencia: number;
    ano_competencia: number;
    valor_total: number;
    valor_pago: number;
    data_vencimento: string;
  };
  onSubmit: (data: PaymentFormData) => void;
  isLoading: boolean;
  error?: string;
}

interface PaymentFormData {
  data_pagamento: string;
  valor_pago: number;
  comprovante?: string;
  juros?: number;
  multa?: number;
  observacoes?: string;
}

export default function DASPaymentForm({
  das,
  onSubmit,
  isLoading,
  error,
}: DASPaymentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PaymentFormData>({
    defaultValues: {
      data_pagamento: format(new Date(), 'yyyy-MM-dd'),
      valor_pago: das.valor_total,
      juros: 0,
      multa: 0,
    },
  });

  const juros = watch('juros') || 0;
  const multa = watch('multa') || 0;
  const baseSemAcrescimo = das.valor_total;
  const totalComAcrescimo = baseSemAcrescimo + juros + multa;
  const dataPagamento = watch('data_pagamento');
  const isAfterDueDate = new Date(dataPagamento) > new Date(das.data_vencimento);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-red-800">Erro</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              DAS {das.mes_competencia.toString().padStart(2, '0')}/{das.ano_competencia}
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {das.numero_boleto ? das.numero_boleto : '(Em processamento)'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Vencimento</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {format(new Date(das.data_vencimento), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 flex justify-between">
          <span className="text-sm text-gray-600">Valor Original:</span>
          <span className="font-semibold text-gray-900">
            R$ {das.valor_total.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data de Pagamento *</label>
        <input
          type="date"
          {...register('data_pagamento', { required: 'Data é obrigatória' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {errors.data_pagamento && (
          <p className="text-red-600 text-xs mt-1">{errors.data_pagamento.message}</p>
        )}
        {isAfterDueDate && (
          <p className="text-orange-600 text-xs mt-1">⚠️ Pagamento após vencimento</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Valor Pago (R$) *</label>
        <input
          type="number"
          step="0.01"
          {...register('valor_pago', { required: 'Valor é obrigatório', min: 0.01 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Juros (R$)</label>
        <input
          type="number"
          step="0.01"
          {...register('juros')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Multa (R$)</label>
        <input
          type="number"
          step="0.01"
          {...register('multa')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      {(juros > 0 || multa > 0) && (
        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm">
          <div className="flex justify-between mb-1">
            <span>Base:</span>
            <span>R$ {baseSemAcrescimo.toFixed(2)}</span>
          </div>
          {juros > 0 && (
            <div className="flex justify-between text-orange-600 mb-1">
              <span>+ Juros:</span>
              <span>R$ {juros.toFixed(2)}</span>
            </div>
          )}
          {multa > 0 && (
            <div className="flex justify-between text-red-600 mb-1">
              <span>+ Multa:</span>
              <span>R$ {multa.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-1 flex justify-between font-bold">
            <span>Total:</span>
            <span>R$ {totalComAcrescimo.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Comprovante</label>
        <input type="text" {...register('comprovante')} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea {...register('observacoes')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading && <Loader2 size={16} className="animate-spin" />}
        {isLoading ? 'Registrando...' : 'Registrar Pagamento'}
      </button>
    </form>
  );
}
