/**
 * Grava .pfx em disco de forma resiliente.
 * No Railway, o volume /app/data pode vir com owner root — nesse caso
 * caímos para os.tmpdir() (o conteúdo também fica em fiscal_certificates.pfx_data).
 */
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { logger } from '../middleware/requestLogger';

function isPermissionError(error: unknown): boolean {
  const err = error as NodeJS.ErrnoException;
  const msg = String(err?.message || error || '');
  return (
    err?.code === 'EACCES' ||
    err?.code === 'EPERM' ||
    /permission denied/i.test(msg) ||
    /EACCES/i.test(msg)
  );
}

function tmpCertPath(companyId: string): string {
  return path.join(os.tmpdir(), 'fiscal-certs', `${companyId}.pfx`);
}

/**
 * Garante um arquivo .pfx legível no filesystem.
 * Preferência: preferredPath → tmp → paths existentes.
 */
export async function materializePfxResilient(opts: {
  companyId: string;
  preferredPath: string;
  pfxData?: string | null;
  pfxBuffer?: Buffer | null;
  existingPath?: string | null;
}): Promise<string> {
  const { companyId, preferredPath, pfxData, pfxBuffer, existingPath } = opts;
  const buffer =
    pfxBuffer && pfxBuffer.length > 0
      ? pfxBuffer
      : pfxData
        ? Buffer.from(pfxData, 'base64')
        : null;

  const candidates = [preferredPath, tmpCertPath(companyId)];

  if (buffer) {
    for (const target of candidates) {
      try {
        await fs.ensureDir(path.dirname(target));
        await fs.writeFile(target, buffer);
        if (target !== preferredPath) {
          logger.warn('Certificado A1 gravado em fallback (volume sem permissão)', {
            companyId,
            preferredPath,
            target,
          });
        }
        return target;
      } catch (error) {
        if (!isPermissionError(error)) throw error;
        logger.warn('Sem permissão para gravar certificado A1', {
          companyId,
          target,
          error: (error as Error).message,
        });
      }
    }
  }

  for (const candidate of [existingPath, preferredPath, tmpCertPath(companyId)]) {
    if (candidate && (await fs.pathExists(candidate))) return candidate;
  }

  throw Object.assign(
    new Error(
      'Certificado digital A1 não encontrado. Cadastre o .pfx da empresa em Captura Fiscal.',
    ),
    { status: 422 },
  );
}
