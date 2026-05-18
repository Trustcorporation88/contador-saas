import { HandCoins, Pencil, Wallet } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ContaReceber } from '../../services/contasReceberService';

function formatCurrency(value?: number) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
  } catch {
    return value;
  }
}

const statusClass: Record<string, string> = {
  pendente: 'badge badge-yellow',
  parcial: 'badge badge-blue',
  recebido: 'badge badge-green',
  vencido: 'badge badge-red',
  cancelado: 'badge badge-gray',
};

interface ContasReceberListProps {
  contas: ContaReceber[];
  loading?: boolean;
  onEdit: (conta: ContaReceber) => void;
  onReceber: (conta: ContaReceber) => void;
  onCancelar: (conta: ContaReceber) => void;
}

export default function ContasReceberList({ contas, loading, onEdit, onReceber, onCancelar }: ContasReceberListProps) {
  return (
    <div className="table-container">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Título</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Vencimento</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Original</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Saldo</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {loading && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Carregando contas a receber...</td>
            </tr>
          )}

          {!loading && contas.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center">
                <Wallet className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-500">Nenhum título a receber encontrado.</p>
              </td>
            </tr>
          )}

          {contas.map((conta) => (
            <tr key={conta.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{conta.numero_titulo}</p>
                <p className="text-xs text-gray-500">{conta.categoria.toUpperCase()} · {conta.descricao}</p>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900">{conta.cliente_nome}</p>
                <p className="text-xs text-gray-500">{conta.cliente_cnpj || 'CNPJ não informado'}</p>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                <p>{formatDate(conta.data_vencimento)}</p>
                <p className="text-xs text-gray-500">{conta.dias_atraso ? `${conta.dias_atraso} dia(s) de atraso` : 'No prazo'}</p>
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(Number(conta.valor_original))}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(Number(conta.saldo_aberto || 0))}</td>
              <td className="px-4 py-3 text-center">
                <span className={statusClass[conta.status] || 'badge badge-gray'}>{conta.status}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(conta)} disabled={conta.status === 'recebido' || conta.status === 'cancelado'}>
                    Editar
                  </Button>
                  <Button type="button" variant="secondary" size="sm" icon={<HandCoins className="h-4 w-4" />} onClick={() => onReceber(conta)} disabled={conta.status === 'recebido' || conta.status === 'cancelado'}>
                    Receber
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onCancelar(conta)} disabled={conta.status === 'cancelado'}>
                    Cancelar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}