import crypto from 'crypto';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

let warnedAboutFallbackKey = false;

/**
 * Deriva a chave de criptografia de certificados/senhas fiscais.
 * Usa um segredo DEDICADO (FISCAL_CERT_ENCRYPTION_KEY) sempre que configurado,
 * evitando reutilizar o segredo do JWT — um vazamento do JWT secret não deve
 * também comprometer os certificados digitais A1 das empresas.
 * Fallback ao segredo do JWT apenas por compatibilidade com dados já
 * criptografados antes desta correção.
 */
function deriveKey(): Buffer {
  const dedicated = process.env.FISCAL_CERT_ENCRYPTION_KEY;
  if (dedicated) {
    return crypto.createHash('sha256').update(dedicated).digest();
  }
  if (!warnedAboutFallbackKey) {
    warnedAboutFallbackKey = true;
    logger.warn(
      'FISCAL_CERT_ENCRYPTION_KEY não configurada — usando fallback derivado do JWT secret. ' +
        'Configure uma chave dedicada em produção.',
    );
  }
  return crypto.createHash('sha256').update(envConfig.jwt.secret).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buffer.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Descriptografa dado que pode ter sido gravado ANTES desta correção de
 * segurança (ex.: pfx_data salvo em base64 puro, sem criptografia). Tenta
 * descriptografar; se falhar, assume que o valor já está em texto plano.
 */
export function decryptSecretWithLegacyFallback(payload: string): string {
  try {
    return decryptSecret(payload);
  } catch {
    logger.warn('Valor não estava criptografado (formato legado) — considere regravar o certificado.');
    return payload;
  }
}
