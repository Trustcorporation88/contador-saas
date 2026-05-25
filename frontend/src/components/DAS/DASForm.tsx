import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Loader2, AlertCircle, Check } from 'lucide-react';

interface DASFormProps {
  initialData?: any;
  onSubmit: (data: DASFormData) => void;
  isLoading: boolean;
  error?: string;
}

interface DASFormData {
  mes_competencia: number;
  ano_competencia: number;
  valor_original: number;
  regime_tributario: 'SIMPLES' | 'LUCRO_REAL' | 'LUCRO_PRESUMIDO';
  descricao?: string;
}

export default function DASForm({
  initialData,
  onSubmit,
  isLoading,
  error,
}: DASFormProps) {
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<DASFormData>({
    defaultValues: {
      mes_competencia: new Date().getMonth() + 1,
      ano_competencia: new Date().getFullYear(),
      regime_tributario: 'SIMPLES',
      descricao: '',
    },
  });

  const regimeOptions = [
    { value: 'SIMPLES', label: 'Simples Nacional' },
    { value: 'LUCRO_REAL', label: 'Lucro Real' },
    { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  ];

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const mesSelecionado = watch('mes_competencia');
  const anoSelecionado = watch('ano_competencia');

  useEffect(() => {
    if (initialData) {
      setValue('mes_competencia', initialData.mes_competencia);
      setValue('ano_competencia', initialData.ano_competencia);
      setValue('valor_original', initialData.valor_original);
      setValue('regime_tributario', initialData.regime_tributario);
      setValue('descricao', initialData.descricao);
    }
  }, [initialData, setValue]);

  const mesNome = new Date(anoSelecionado, mesSelecionado - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
  });
  
  const dataVencimento = new Date(anoSelecionado, mesSelecionado, 20);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="font-semibold text-red-800">Erro</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Mês */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mês de Competência *
            </label>
            <select
              {...register('mes_competencia', { required: 'Mês é obrigatório' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mes) => (
                <option key={mes} value={mes}>
                  {mes.toString().padStart(2, '0')} - {new Date(2024, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
            {errors.mes_competencia && (
              <p className="text-red-600 text-xs mt-1">{errors.mes_competencia.message}</p>
            )}
          </div>

          {/* Ano */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ano de Competência *
            </label>
            <select
              {...register('ano_competencia', { required: 'Ano é obrigatório' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[anoAtual - 1, anoAtual, anoAtual + 1].map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
            {errors.ano_competencia && (
              <p className="text-red-600 text-xs mt-1">{errors.ano_competencia.message}</p>
            )}
          </div>

          {/* Regime */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Regime Tributário *
            </label>
            <select
              {...register('regime_tributario', { required: 'Regime é obrigatório' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {regimeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.regime_tributario && (
              <p className="text-red-600 text-xs mt-1">{errors.regime_tributario.message}</p>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register('valor_original', {
                required: 'Valor é obrigatório',
                min: { value: 0.01, message: 'Valor deve ser maior que zero' },
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1.250,50"
            />
            {errors.valor_original && (
              <p className="text-red-600 text-xs mt-1">{errors.valor_original.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição (opcional)
            </label>
            <textarea
              {...register('descricao')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Observações sobre este DAS..."
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-900">
              📅 Vencimento: {format(dataVencimento, "dd 'de' MMMM 'de' yyyy", { locale: pt })}
            </p>
            <p className="text-blue-700 text-xs mt-1">
              Valor será integrado com a apuração de impostos de {mesNome}/{anoSelecionado}
            </p>
          </div>

      {/* Actions */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading && <Loader2 size={16} className="animate-spin" />}
        {isLoading ? 'Salvando...' : initialData ? 'Atualizar' : 'Criar'}
      </button>
    </form>
  );
}
