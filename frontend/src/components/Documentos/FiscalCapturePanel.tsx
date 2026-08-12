/**
 * FiscalCapturePanel — Captura automática NF-e/NFS-e com certificado A1
 * Valida senha, CNPJ e validade no backend antes de salvar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudDownload, Download, FileCheck, FileUp, KeyRound, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { CompanyService } from '../../services/companyService';
import {
  FiscalCaptureService,
  type FiscalDocType,
} from '../../services/fiscalCaptureService';

const UFS = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg',
  'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to',
];

const PFX_ACCEPT = '.pfx,.p12,application/x-pkcs12,application/pkcs12';

export default function FiscalCapturePanel() {
  const qc = useQueryClient();
  const currentCompanyId = useAuthStore((state) => state.currentCompanyId);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const [cnpj, setCnpj] = useState('');
  const [uf, setUf] = useState('sp');
  const [password, setPassword] = useState('');
  const [serproMotor, setSerproMotor] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [syncTipo, setSyncTipo] = useState<FiscalDocType>('all');
  // Competência do ZIP. Padrão no mês corrente, que é o caso de uso comum.
  const agora = new Date();
  const [zipAno, setZipAno] = useState(agora.getFullYear());
  const [zipMes, setZipMes] = useState(agora.getMonth() + 1);
  const [formError, setFormError] = useState('');
  const [syncInfo, setSyncInfo] = useState('');
  const [showCertForm, setShowCertForm] = useState(false);

  const formatCnpj = (value?: string | null): string => {
    const digits = (value || '').replace(/\D/g, '');
    if (digits.length !== 14) return value || '—';
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const docLabel = (docType: string): string => {
    const map: Record<string, string> = {
      nfe: 'NF-e',
      nfe_resumo: 'NF-e (resumo)',
      nfe_evento: 'NF-e (evento)',
      nfse: 'NFS-e',
    };
    return map[docType] || docType.toUpperCase();
  };

  const pickPfx = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    const name = next.name.toLowerCase();
    const okExt = name.endsWith('.pfx') || name.endsWith('.p12');
    const okMime = [
      'application/x-pkcs12',
      'application/pkcs12',
      'application/octet-stream',
    ].includes(next.type) || !next.type;
    if (!okExt && !okMime) {
      setFormError('Envie um certificado A1 (.pfx ou .p12).');
      setFile(null);
      return;
    }
    setFormError('');
    setFile(next);
  }, []);

  const { data: status, isLoading } = useQuery({
    queryKey: ['fiscal-capture-status', currentCompanyId],
    queryFn: () => FiscalCaptureService.getStatus(),
    enabled: !!currentCompanyId,
  });

  const { data: company } = useQuery({
    queryKey: ['company', currentCompanyId],
    queryFn: () => CompanyService.getById(currentCompanyId!),
    enabled: !!currentCompanyId,
  });

  useEffect(() => {
    if (!company || cnpj) return;
    if (company.cnpj) {
      setCnpj(company.cnpj.replace(/\D/g, ''));
    }
  }, [company, cnpj]);

  // listCaptures lê a empresa do store para montar a URL, então o dado vem certo
  // — mas sem currentCompanyId na chave o cache exibe as capturas da empresa
  // anterior por até 5 minutos (staleTime) depois da troca. As duas queries
  // acima já seguem esse padrão; esta ficou de fora.
  const { data: captures } = useQuery({
    queryKey: ['fiscal-capture-list', currentCompanyId],
    queryFn: () => FiscalCaptureService.listCaptures(1, 8),
    enabled: !!currentCompanyId,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['fiscal-capture-status'] });
    await qc.invalidateQueries({ queryKey: ['fiscal-capture-list'] });
  };

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Arraste ou selecione o arquivo .pfx');
      if (!password.trim()) throw new Error('Informe a senha do certificado');
      const cnpjDigits = cnpj.replace(/\D/g, '');
      if (cnpjDigits.length !== 14) {
        throw new Error('Informe o CNPJ da empresa com 14 dígitos (não use o e-mail de login)');
      }
      return FiscalCaptureService.uploadCertificate({
        cnpj: cnpjDigits,
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
      setShowCertForm(false);
      if (inputRef.current) inputRef.current.value = '';
      await invalidate();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: () => FiscalCaptureService.sync(syncTipo),
    onSuccess: async (data) => {
      setFormError('');
      setSyncInfo(data.message || 'Captura concluída.');
      await invalidate();
    },
    onError: (error: Error) => {
      setSyncInfo('');
      setFormError(error.message);
    },
  });

  /**
   * Ciência de UMA nota.
   *
   * O lote não serve para todo caso: nota que o contador não reconhece não deve
   * receber ciência às cegas — o evento é registrado na SEFAZ e não se desfaz.
   * Aqui ele escolhe linha por linha. Sugestão do Fabricio, 12/08/2026.
   */
  /**
   * Entrega um Blob ao navegador como download.
   *
   * A rota exige token no cabeçalho, então não dá para usar <a href> — teria de
   * abrir sem Authorization e receberia 401. Revoga a URL depois de clicar,
   * porque aqui o arquivo já foi salvo (diferente do PDF, que precisa da URL
   * viva enquanto a aba estiver aberta).
   */
  const entregarArquivo = (blob: Blob, nome: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixarXmlMutation = useMutation({
    mutationFn: async (item: { id: string; chave: string }) => {
      const blob = await FiscalCaptureService.baixarXml(item.id);
      entregarArquivo(blob, `${item.chave || item.id}.xml`);
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const baixarZipMutation = useMutation({
    mutationFn: async () => {
      const blob = await FiscalCaptureService.baixarZip(zipAno, zipMes);
      entregarArquivo(blob, `xmls-${zipAno}-${String(zipMes).padStart(2, '0')}.zip`);
    },
    onSuccess: () => {
      setFormError('');
      setSyncInfo('ZIP dos XMLs baixado.');
    },
    onError: (error: Error) => {
      setSyncInfo('');
      setFormError(error.message);
    },
  });

  const manifestarUmaMutation = useMutation({
    mutationFn: (chave: string) => FiscalCaptureService.manifestar(chave),
    onSuccess: async (data) => {
      setFormError('');
      setSyncInfo(
        data.ja_manifestado
          ? 'Esta nota já estava manifestada na SEFAZ (duplicidade) — nada a fazer.'
          : 'Ciência da Operação registrada. Clique em "Capturar XML agora" para baixar o XML completo.',
      );
      await invalidate();
    },
    onError: (error: Error) => {
      setSyncInfo('');
      setFormError(error.message);
    },
  });

  const manifestarMutation = useMutation({
    mutationFn: () => FiscalCaptureService.manifestarResumos(20),
    onSuccess: async (data) => {
      setFormError('');
      setSyncInfo(
        data.total === 0
          ? 'Nenhum resumo pendente de manifestação.'
          : `Ciência da Operação enviada: ${data.manifestados} de ${data.total}`
            + `${data.falhas ? `, ${data.falhas} com falha` : ''}. `
            + 'Clique em "Capturar XML agora" para baixar os XMLs completos.',
      );
      await invalidate();
    },
    onError: (error: Error) => {
      setSyncInfo('');
      setFormError(error.message);
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => FiscalCaptureService.reprocess(),
    onSuccess: async () => {
      setFormError('');
      await invalidate();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const cert = status?.certificate;
  const nfeSync = (status?.sync ?? []).find((item) => item.doc_type === 'nfe');
  const nfseSync = (status?.sync ?? []).find((item) => item.doc_type === 'nfse');

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
        <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {syncInfo && !formError && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {syncInfo}
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
              <p>CNPJ: {formatCnpj(cert.cnpj)}</p>
              <p>UF: {cert.uf.toUpperCase()}</p>
              <p>Senha: {cert.has_password ? '•••••• (salva com segurança)' : 'não informada'}</p>
              <p>Motor Serpro: {cert.serpro_motor_enabled ? 'Sim' : 'Não'}</p>
              {cert.cert_valid_until && (
                <p>Validade: {new Date(cert.cert_valid_until).toLocaleDateString('pt-BR')}</p>
              )}
              <button
                type="button"
                onClick={() => setShowCertForm((prev) => !prev)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {showCertForm ? 'Cancelar' : 'Substituir certificado / senha'}
              </button>
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
            <p>NFS-e NSU: {nfseSync?.cursor_value || '0'}</p>
            <p>XMLs capturados: {status?.captures_total ?? 0}</p>
            {nfeSync?.last_status && (
              <p className={nfeSync.last_status === 'error' ? 'text-red-700' : 'text-emerald-700'}>
                Última NF-e: {nfeSync.last_status}
                {nfeSync.last_sync_at
                  ? ` · ${new Date(nfeSync.last_sync_at).toLocaleString('pt-BR')}`
                  : ''}
              </p>
            )}
            {nfeSync?.last_status === 'error' && nfeSync.last_error && (
              <p className="text-xs text-red-700">{nfeSync.last_error}</p>
            )}
            {nfseSync?.last_status === 'error' && nfseSync.last_error && (
              <p className="text-xs text-red-700">NFS-e: {nfseSync.last_error}</p>
            )}
            <p className={status?.python_available ? 'text-emerald-700' : 'text-amber-700'}>
              Captura automática: {status?.python_available ? 'ativa no servidor' : 'aguardando deploy'}
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
          <p className="mt-2 text-xs text-amber-700">
            NFC-e (modelo 65) não é distribuída pela Distribuição DFe da SEFAZ — importe por upload ou relatório do PDV.
          </p>
        </div>
      </div>

      {(!cert || showCertForm) && (
        <form
          className="mt-5 grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-white/80 p-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError('');
            uploadMutation.mutate();
          }}
        >
          <p className="md:col-span-2 text-xs text-gray-500">
            Antes de salvar, o sistema valida senha do .pfx, CNPJ do certificado (deve ser o da empresa) e data de validade.
          </p>
          <div>
            <label className="input-label" htmlFor="fiscal-cert-cnpj">CNPJ</label>
            <input
              id="fiscal-cert-cnpj"
              className="input-field"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="00000000000000"
              inputMode="numeric"
              required
            />
          </div>
          <div>
            <label className="input-label" htmlFor="fiscal-cert-uf">UF</label>
            <select
              id="fiscal-cert-uf"
              className="input-field"
              value={uf}
              onChange={(e) => setUf(e.target.value)}
            >
              {UFS.map((item) => (
                <option key={item} value={item}>{item.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label" htmlFor="fiscal-cert-password">Senha do certificado</label>
            <input
              id="fiscal-cert-password"
              className="input-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">Arquivo .pfx</label>
            <div
              role="button"
              tabIndex={0}
              data-testid="pfx-drop-zone"
              aria-label="Área para arrastar certificado A1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth.current += 1;
                setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setDragging(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth.current = 0;
                setDragging(false);
                pickPfx(e.dataTransfer.files?.[0] || null);
              }}
              className={clsx(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-all',
                dragging && 'border-emerald-500 bg-emerald-50',
                !dragging && !file && 'border-gray-300 bg-gray-50/80 hover:border-emerald-400 hover:bg-emerald-50/40',
                file && 'border-emerald-300 bg-emerald-50/50',
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept={PFX_ACCEPT}
                className="hidden"
                data-testid="pfx-drop-input"
                onChange={(e) => pickPfx(e.target.files?.[0] || null)}
              />
              <FileUp className={clsx('h-6 w-6', dragging ? 'text-emerald-700' : 'text-gray-500')} />
              {file ? (
                <div className="flex items-center gap-2 text-sm text-emerald-900">
                  <span className="font-medium">{file.name}</span>
                  <button
                    type="button"
                    aria-label="Remover arquivo"
                    className="rounded p-0.5 hover:bg-emerald-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      pickPfx(null);
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-800">
                    {dragging ? 'Solte o .pfx aqui' : 'Arraste o certificado A1 ou clique para selecionar'}
                  </p>
                  <p className="text-xs text-gray-500">Arquivos .pfx / .p12</p>
                </>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
            <input type="checkbox" checked={serproMotor} onChange={(e) => setSerproMotor(e.target.checked)} />
            Empresa Simples Nacional — considerar Motor Serpro na apuração
          </label>
          <div className="md:col-span-2">
            <Button type="submit" loading={uploadMutation.isPending} disabled={!file || !password}>
              {cert ? 'Validar e substituir certificado A1' : 'Validar e cadastrar certificado A1'}
            </Button>
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
          {/*
            Manifestação. Fica ao lado da captura porque é o passo que falta para
            o XML completo chegar: a SEFAZ entrega só o RESUMO das notas de
            entrada até o destinatário dar ciência. Sem este botão, o painel
            enche de "NF-e (resumo)" e não há como escriturar nada.
          */}
          <Button
            type="button"
            variant="secondary"
            icon={<FileCheck className="h-4 w-4" />}
            loading={manifestarMutation.isPending}
            onClick={() => {
              const confirmado = window.confirm(
                'Enviar Ciência da Operação à SEFAZ para as notas de entrada ainda não '
                + 'manifestadas?\n\n'
                + 'A Ciência apenas declara que a empresa tomou conhecimento da nota, e é '
                + 'o que libera o download do XML completo. Ela NÃO confirma a operação '
                + 'nem impede o emitente de cancelar a nota.\n\n'
                + 'O evento é registrado na SEFAZ e não se desfaz.',
              );
              if (confirmado) manifestarMutation.mutate();
            }}
            title="Ciência da Operação (210210) em TODAS as notas de entrada ainda não manifestadas — para escolher uma, use o botão da linha"
          >
            Dar ciência em todas
          </Button>
          {/*
            ZIP da competência. O que um escritório usa no fechamento não é
            arquivo por arquivo: é a pasta do mês. O filtro é pela data de
            EMISSÃO da nota, não pela data de captura — nota de julho capturada
            em agosto pertence a julho.
          */}
          <div className="flex items-end gap-2">
            <div>
              <label className="input-label">XMLs do mês</label>
              <div className="flex gap-1">
                <select
                  className="input-field w-20"
                  value={zipMes}
                  onChange={(e) => setZipMes(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  className="input-field w-24"
                  value={zipAno}
                  onChange={(e) => setZipAno(Number(e.target.value))}
                >
                  {Array.from({ length: 6 }, (_, i) => agora.getFullYear() - i).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              loading={baixarZipMutation.isPending}
              onClick={() => baixarZipMutation.mutate()}
              title="Baixa num ZIP todos os XMLs com data de emissão na competência escolhida"
            >
              Baixar ZIP
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            loading={reprocessMutation.isPending}
            onClick={() => reprocessMutation.mutate()}
            title="Recalcula valor, emitente e direção dos XMLs já capturados"
          >
            Reprocessar notas
          </Button>
        </div>
      )}

      {reprocessMutation.isSuccess && (
        <p className="mt-3 text-sm text-emerald-700">
          Notas reprocessadas — valores e emitentes atualizados.
        </p>
      )}

      {captures && captures.data.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/80 bg-white/90">
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-50/80 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Direção</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Emitente</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Capturado em</th>
                <th className="px-4 py-3">Ciência</th>
                <th className="px-4 py-3">XML</th>
              </tr>
            </thead>
            <tbody>
              {captures.data.map((item) => (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{docLabel(item.doc_type)}</td>
                  <td className="px-4 py-3">{item.direcao || '—'}</td>
                  <td className="px-4 py-3">{item.numero || item.chave.slice(0, 12)}</td>
                  <td className="px-4 py-3">{formatCnpj(item.emitente_cnpj)}</td>
                  <td className="px-4 py-3">
                    {item.valor_total
                      ? Number(item.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">{new Date(item.captured_at).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    {/*
                      Três estados, e cada um diz uma coisa diferente:
                      já manifestada, pendente (mostra o botão), ou não se aplica
                      — o XML completo já está aqui, ou é documento de saída, e
                      nesses casos não há o que manifestar.
                    */}
                    {item.manifestado ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <FileCheck className="h-3.5 w-3.5" />
                        Ciência dada
                      </span>
                    ) : item.doc_type === 'nfe_resumo' ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        disabled={manifestarUmaMutation.isPending}
                        title="Ciência da Operação (210210) só desta nota — libera o XML completo dela"
                        onClick={() => {
                          const confirmado = window.confirm(
                            `Dar Ciência da Operação na nota ${item.numero || item.chave.slice(0, 12)}`
                            + `${item.emitente_cnpj ? ` de ${formatCnpj(item.emitente_cnpj)}` : ''}?\n\n`
                            + 'A Ciência declara apenas que a empresa tomou conhecimento da nota, e é '
                            + 'o que libera o download do XML completo. NÃO confirma a operação.\n\n'
                            + 'O evento é registrado na SEFAZ e não se desfaz.',
                          );
                          if (confirmado) manifestarUmaMutation.mutate(item.chave);
                        }}
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                        Dar ciência
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      disabled={baixarXmlMutation.isPending}
                      title="Baixar o XML deste documento"
                      onClick={() => baixarXmlMutation.mutate({ id: item.id, chave: item.chave })}
                    >
                      <Download className="h-3.5 w-3.5" />
                      XML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
