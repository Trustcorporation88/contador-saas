import { FileText, Pencil, ReceiptText, Trash2 } from 'lucide-react';
import type { DocumentoFiscal } from '../../services/documentoFiscalService';
import { Button } from '../ui/Button';

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
  } catch {
    return value;
  }
}

function formatCurrency(value?: number) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const statusBadge: Record<string, string> = {
  rascunho: 'badge badge-yellow',
  registrado: 'badge badge-green',
  cancelado: 'badge badge-gray',
};

interface DocumentosListProps {
  documentos: DocumentoFiscal[];
  loading?: boolean;
  onEdit: (documento: DocumentoFiscal) => void;
  onRegistrar: (documento: DocumentoFiscal) => void;
  onCancelar: (documento: DocumentoFiscal) => void;
}

export default function DocumentosList({ documentos, loading, onEdit, onRegistrar, onCancelar }: DocumentosListProps) {
  return (
    <div className="table-container">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Documento</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contraparte</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Emissão</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Valor</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {loading && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Carregando documentos...</td>
            </tr>
          )}

          {!loading && documentos.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-14 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-500">Nenhum documento fiscal encontrado.</p>
              </td>
            </tr>
          )}

          {documentos.map((documento) => (
            <tr key={documento.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-primary-50 p-2 text-primary-700">
                    <ReceiptText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{documento.numero} / {documento.serie}</p>
                    <p className="text-xs text-gray-500">{documento.tipo.toUpperCase()} · {documento.descricao}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900">{documento.contraparte_nome || 'Sem nome'}</p>
                <p className="text-xs text-gray-500">{documento.contraparte_cnpj || 'CNPJ não informado'}</p>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(documento.data_emissao)}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(Number(documento.valor_total || 0))}</td>
              <td className="px-4 py-3 text-center">
                <span className={statusBadge[documento.status] || 'badge badge-gray'}>{documento.status}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(documento)} disabled={documento.status !== 'rascunho'}>
                    Editar
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onRegistrar(documento)} disabled={documento.status !== 'rascunho'}>
                    Registrar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => onCancelar(documento)} disabled={documento.status === 'cancelado'}>
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