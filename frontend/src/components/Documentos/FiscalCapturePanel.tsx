import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudDownload, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  FiscalCaptureService,
  type FiscalDocType,
} from '../../services/fiscalCaptureService';

const UFS = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg',
  'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to',
];

export default function FiscalCapturePanel() {
  const qc = useQueryClient();
  const [cnpj, setCnpj] = useState('');
  const [uf, setUf] = useState('sp');
  const [password, setPassword] = useState('');
  const [serproMotor, setSerproMotor] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [syncTipo, setSyncTipo] = useState<FiscalDocType>('all');
  const [formError, setFormError] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['fiscal-capture-status'],
    queryFn: () => FiscalCaptureService.getStatus(),
  });

  const { data: captures } = useQuery({
    queryKey: ['fiscal-capture-list'],
    queryFn: () => FiscalCaptureService.listCaptures(1, 8),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['fiscal-capture-status'] });
    await qc.invalidateQueries({ queryKey: ['fiscal-capture-list'] });
  };

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Selecione o arquivo .pfx');
      return FiscalCaptureService.uploadCertificate({
        cnpj,
        uf,
        password,
        serproMotor,
        file,
      });
    },
    onSuccess: async () => {
      setFormError('');
      setPassword('');
      setFile(null);
      await invalidate();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: () => FiscalCaptureService.sync(syncTipo),
    onSuccess: async () => {
      setFormError('');
      await invalidate();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const cert = status?.certificate;
  const nfeSync = status?.sync.find((item) => item.doc_type === 'nfe');
  const nfseSync = status?.sync.find((item) => item.doc_type === 'nfse');

  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Captura automática</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">XML NF-e e NFS-e (certificado A1)</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Sincroniza compras e vendas via Distribuição DFe (SEFAZ) e Portal Nacional da NFS-e.
            Empresas no Simples podem exigir o Motor Serpro para apuração (custo adicional).
          </p>
        </div>
        <Button type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => invalidate()}>
          Atualizar status
        </Button>
      </div>

      {formError && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <KeyRound className="h-4 w-4 text-emerald-600" />
            Certificado A1
          </div>
          {isLoading ? (
            <p className="mt-3 text-sm text-gray-500">Carregando...</p>
          ) : cert ? (
            <div className="mt-3 space-y-1 text-sm text-gray-700">
              <p>CNPJ: {cert.cnpj}</p>
              <p>UF: {cert.uf.toUpperCase()}</p>
              <p>Motor Serpro: {cert.serpro_motor_enabled ? 'Sim' : 'Não'}</p>
              {cert.cert_valid_until && (
                <p>Validade: {new Date(cert.cert_valid_until).toLocaleDateString('pt-BR')}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">Nenhum certificado cadastrado.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <CloudDownload className="h-4 w-4 text-emerald-600" />
            Sincronização
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>NF-e NSU: {nfeSync?.cursor_value || '0'}</p>
            <p>NFS-e chave: {nfseSync?.cursor_value || '0'}</p>
            <p>XMLs capturados: {status?.captures_total ?? 0}</p>
            <p className={status?.python_available ? 'text-emerald-700' : 'text-amber-700'}>
              Python no servidor: {status?.python_available ? 'disponível' : 'indisponível — use scheduler local'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <ShieldAlert className="h-4 w-4 text-emerald-600" />
            Guarda legal
          </div>
          <p className="mt-3 text-sm text-gray-600">
            XMLs organizados por CNPJ/ano/mês. Mantenha backup por no mínimo 5 anos conforme legislação fiscal.
          </p>
        </div>
      </div>

      {!cert && (
        <form
          className="mt-5 grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-white/80 p-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            uploadMutation.mutate();
          }}
        >
          <div>
            <label className="input-label">CNPJ</label>
            <input className="input-field" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" required />
          </div>
          <div>
            <label className="input-label">UF</label>
            <select className="input-field" value={uf} onChange={(e) => setUf(e.target.value)}>
              {UFS.map((item) => (
                <option key={item} value={item}>{item.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Senha do certificado</label>
            <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="input-label">Arquivo .pfx</label>
            <input className="input-field" type="file" accept=".pfx" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
            <input type="checkbox" checked={serproMotor} onChange={(e) => setSerproMotor(e.target.checked)} />
            Empresa Simples Nacional — considerar Motor Serpro na apuração
          </label>
          <div className="md:col-span-2">
            <Button type="submit" loading={uploadMutation.isPending}>Cadastrar certificado A1</Button>
          </div>
        </form>
      )}

      {cert && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="input-label">Tipo de captura</label>
            <select className="input-field min-w-40" value={syncTipo} onChange={(e) => setSyncTipo(e.target.value as FiscalDocType)}>
              <option value="all">NF-e + NFS-e</option>
              <option value="nfe">Somente NF-e</option>
              <option value="nfse">Somente NFS-e</option>
            </select>
          </div>
          <Button type="button" icon={<CloudDownload className="h-4 w-4" />} loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
            Capturar XML agora
          </Button>
        </div>
      )}

      {captures && captures.data.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/80 bg-white/90">
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Direção</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Capturado em</th>
              </tr>
            </thead>
            <tbody>
              {captures.data.map((item) => (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 uppercase">{item.doc_type}</td>
                  <td className="px-4 py-3">{item.direcao || '—'}</td>
                  <td className="px-4 py-3">{item.numero || item.chave.slice(0, 12)}</td>
                  <td className="px-4 py-3">
                    {item.valor_total
                      ? Number(item.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">{new Date(item.captured_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
