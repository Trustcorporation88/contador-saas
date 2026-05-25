import React, { useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronDown, Edit2, Trash2, CheckCircle, AlertCircle, Clock, Download } from 'lucide-react';

interface DASItem {
  id: string;
  numero_boleto?: string | null;
  mes_competencia: number;
  ano_competencia: number;
  valor_original: number;
  valor_total: number;
  valor_pago: number;
  status: 'EMITIDO' | 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  data_vencimento: string;
  regime_tributario: string;
  data_pagamento?: string | null;
  juros?: number;
  multa?: number;
}

interface DASListProps {
  dados: DASItem[];
  isLoading: boolean;
  onEdit: (das: DASItem) => void;
  onCancel: (das: DASItem) => void;
  onPay: (das: DASItem) => void;
  onDownload: (das: DASItem) => void;
}

export default function DASList({
  dados,
  isLoading,
  onEdit,
  onCancel,
  onPay,
  onDownload,
}: DASListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      EMITIDO: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: <Clock size={14} />,
      },
      PENDENTE: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: <AlertCircle size={14} />,
      },
      PAGO: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: <CheckCircle size={14} />,
      },
      VENCIDO: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: <AlertCircle size={14} />,
      },
      CANCELADO: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: <Clock size={14} />,
      },
    };

    const badge = badges[status] || badges.EMITIDO;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.icon}
        {status}
      </span>
    );
  };

  const getRegimeLabel = (regime: string) => {
    const regimes: Record<string, string> = {
      SIMPLES: 'Simples Nacional',
      LUCRO_REAL: 'Lucro Real',
      LUCRO_PRESUMIDO: 'Lucro Presumido',
    };
    return regimes[regime] || regime;
  };

  const isOverdue = (vencimento: string, status: string) => {
    if (status === 'PAGO' || status === 'CANCELADO') return false;
    return new Date(vencimento) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm">Carregando boletos...</p>
        </div>
      </div>
    );
  }

  if (dados.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <p className="text-gray-600 font-medium">Nenhum boleto DAS encontrado</p>
        <p className="text-gray-500 text-sm mt-1">Crie um novo DAS para começar</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {dados.map((das) => {
        const isExpanded = expandedId === das.id;
        const overdue = isOverdue(das.data_vencimento, das.status);

        return (
          <div
            key={das.id}
            className={`transition-all ${overdue ? 'bg-red-50' : 'hover:bg-gray-50'}`}
          >
            {/* Main Row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : das.id)}
              className="px-4 py-4 flex items-center gap-4 cursor-pointer"
            >
              <button className="text-gray-400 hover:text-gray-600 transition">
                <ChevronDown
                  size={20}
                  className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900">
                    DAS {das.mes_competencia.toString().padStart(2, '0')}/{das.ano_competencia}
                  </p>
                  {getStatusBadge(das.status)}
                </div>
                <p className="text-sm text-gray-500">
                  Boleto: {das.numero_boleto || 'Em processamento'}
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-gray-900">
                  R$ {das.valor_total.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  Venc: {format(new Date(das.data_vencimento), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 space-y-4">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 text-xs uppercase tracking-wide">Regime</p>
                    <p className="font-medium text-gray-900 mt-1">
                      {getRegimeLabel(das.regime_tributario)}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs uppercase tracking-wide">Valor Original</p>
                    <p className="font-medium text-gray-900 mt-1">
                      R$ {das.valor_original.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>

                  {das.juros !== undefined && das.juros > 0 && (
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Juros</p>
                      <p className="font-medium text-orange-600 mt-1">
                        + R$ {das.juros.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}

                  {das.multa !== undefined && das.multa > 0 && (
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Multa</p>
                      <p className="font-medium text-red-600 mt-1">
                        + R$ {das.multa.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}

                  {das.data_pagamento && (
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Data Pagamento</p>
                      <p className="font-medium text-green-600 mt-1">
                        {format(new Date(das.data_pagamento), 'dd/MM/yyyy', { locale: pt })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Code */}
                {das.numero_boleto && (
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                      Código de Barras
                    </p>
                    <p className="font-mono text-xs text-gray-900 break-all">
                      {das.numero_boleto}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 flex-wrap">
                  {das.status !== 'PAGO' && das.status !== 'CANCELADO' && (
                    <button
                      onClick={() => onPay(das)}
                      className="flex-1 min-w-[120px] px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition"
                    >
                      ✓ Pagar
                    </button>
                  )}

                  {das.status !== 'CANCELADO' && (
                    <>
                      <button
                        onClick={() => onEdit(das)}
                        className="px-3 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition flex items-center gap-2"
                      >
                        <Edit2 size={14} />
                        Editar
                      </button>

                      <button
                        onClick={() => onDownload(das)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition flex items-center gap-2"
                      >
                        <Download size={14} />
                        PDF
                      </button>

                      <button
                        onClick={() => onCancel(das)}
                        className="px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded hover:bg-red-200 transition flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
