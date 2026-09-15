/**
 * DocumentDropZone — Arrastar/soltar PDF ou imagem de documento fiscal
 * Extrai dados via OCR e devolve o resultado para pré-preencher o lançamento.
 */
import { useCallback, useRef, useState } from 'react';
import { FileUp, Loader2, CheckCircle2, AlertCircle, X, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { NfeOcrService, type NfeJournalEntryPreview, type NfeUploadResponse } from '../../services/nfeOcrService';

const ACCEPTED = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
] as const;

const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/jpeg,image/png,image/tiff';
const MAX_BYTES = 50 * 1024 * 1024;

export interface DocumentExtractResult {
  upload: NfeUploadResponse;
  preview: NfeJournalEntryPreview | null;
}

interface DocumentDropZoneProps {
  companyId: string;
  onExtracted: (result: DocumentExtractResult) => void;
  disabled?: boolean;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentDropZone({ companyId, onExtracted, disabled }: DocumentDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const dragDepth = useRef(0);

  const resetFeedback = () => {
    setError('');
    setSuccessMsg('');
  };

  const processFile = useCallback(async (file: File) => {
    if (disabled || loading) return;

    resetFeedback();

    if (!ACCEPTED.includes(file.type as (typeof ACCEPTED)[number])) {
      setError('Formato inválido. Use PDF, JPEG, PNG ou TIFF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Arquivo muito grande. Máximo: 50 MB.');
      return;
    }

    setFileName(file.name);
    setLoading(true);

    try {
      const upload = await NfeOcrService.upload(companyId, file);

      let preview: NfeJournalEntryPreview | null = null;
      if (upload.status === 'extracted' && upload.extraction_confidence > 0.6) {
        try {
          preview = await NfeOcrService.getPreview(companyId, upload.id);
        } catch {
          // Preview opcional — ainda aplicamos o que veio no OCR
        }
      }

      const hasUsefulData = Boolean(
        upload.ocr_data?.nf_number ||
        upload.ocr_data?.total_value ||
        upload.ocr_data?.issuer_name ||
        upload.ocr_data?.emission_date ||
        preview,
      );

      if (!hasUsefulData) {
        setError(
          upload.error ||
          'Não foi possível extrair dados deste documento. Preencha o lançamento manualmente.',
        );
        return;
      }

      onExtracted({ upload, preview });

      const conf = Math.round((upload.extraction_confidence || 0) * 100);
      if (upload.status === 'error' || conf <= 60) {
        setSuccessMsg(
          `Dados parciais extraídos de ${file.name} (confiança ${conf}%). Revise antes de salvar.`,
        );
      } else {
        setSuccessMsg(
          `Documento lido: ${file.name} · confiança ${conf}%. Campos preenchidos automaticamente.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao processar o documento.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [companyId, disabled, loading, onExtracted]);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || loading) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled || loading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const clear = () => {
    setFileName('');
    resetFeedback();
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Documento fiscal</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Arraste a NF-e (PDF ou imagem) para extrair data, valor, tipo e emissor.
          </p>
        </div>
        {fileName && !loading && (
          <button
            type="button"
            onClick={clear}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Limpar documento"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        data-testid="document-drop-zone"
        aria-label="Área para arrastar documento fiscal"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={clsx(
          'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all cursor-pointer',
          dragging && 'border-primary-500 bg-primary-50 scale-[1.01]',
          !dragging && !loading && !error && !successMsg && 'border-gray-300 bg-gray-50/80 hover:border-primary-400 hover:bg-primary-50/40',
          loading && 'border-primary-300 bg-primary-50/50 cursor-wait',
          successMsg && !error && 'border-green-300 bg-green-50/60',
          error && 'border-red-300 bg-red-50/50',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          data-testid="document-drop-input"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processFile(file);
          }}
        />

        {loading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <p className="text-sm font-medium text-primary-800">Extraindo dados do documento…</p>
            <p className="text-xs text-primary-600/80">{fileName}</p>
          </>
        ) : (
          <>
            <div className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-full',
              dragging ? 'bg-primary-100 text-primary-700' : 'bg-white text-gray-500 shadow-sm',
            )}>
              {dragging ? <FileUp className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
            <p className="text-sm font-medium text-gray-800">
              {dragging ? 'Solte o documento aqui' : 'Arraste o documento ou clique para selecionar'}
            </p>
            <p className="text-xs text-gray-500">
              PDF, JPEG, PNG ou TIFF · até {formatBytes(MAX_BYTES)}
            </p>
          </>
        )}
      </div>

      {successMsg && (
        <div
          data-testid="document-extract-success"
          className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="document-extract-error"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
