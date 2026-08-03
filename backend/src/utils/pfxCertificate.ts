/**
 * Validação de certificado digital A1 (.pfx / PKCS#12)
 * — senha correta, validade e CNPJ (ICP-Brasil)
 */
import forge from 'node-forge';

export class PfxValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PfxValidationError';
    this.status = status;
  }
}

export interface ParsedPfxCertificate {
  subjectCn: string | null;
  subjectCnpj: string | null;
  notBefore: Date;
  notAfter: Date;
  isExpired: boolean;
  daysUntilExpiry: number;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Extrai CNPJ (14 dígitos) de campos típicos de certificados ICP-Brasil.
 * Formatos comuns: "RAZAO SOCIAL:12345678000195", serialNumber, OU, etc.
 */
export function extractCnpjFromText(text: string): string | null {
  if (!text) return null;

  // Prefixo explícito CNPJ
  const labeled = text.match(/CNPJ[:\s]*([\d./-]{14,18})/i);
  if (labeled) {
    const digits = onlyDigits(labeled[1]);
    if (digits.length === 14) return digits;
  }

  // Padrão ICP-Brasil: "Nome:CNPJ" no CN
  const colon = text.match(/:(\d{14})\b/);
  if (colon) return colon[1];

  // Qualquer sequência de 14 dígitos (com ou sem máscara)
  const masked = text.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  if (masked) {
    const digits = onlyDigits(masked[1]);
    if (digits.length === 14) return digits;
  }

  const raw = text.match(/\b(\d{14})\b/);
  return raw ? raw[1] : null;
}

function collectSubjectText(cert: forge.pki.Certificate): string {
  const parts: string[] = [];
  for (const attr of cert.subject.attributes || []) {
    if (attr.value) parts.push(String(attr.value));
  }
  return parts.join(' | ');
}

function extractCnpjFromCertificate(cert: forge.pki.Certificate): string | null {
  const subjectText = collectSubjectText(cert);
  const fromSubject = extractCnpjFromText(subjectText);
  if (fromSubject) return fromSubject;

  // Extensions (SAN / otherName ICP-Brasil OID 2.16.76.1.3.3)
  try {
    const ext = cert.getExtension('subjectAltName') as
      | { altNames?: Array<{ type?: number; value?: string }> }
      | false
      | undefined;
    if (ext && typeof ext === 'object' && Array.isArray(ext.altNames)) {
      for (const alt of ext.altNames) {
        if (alt?.value) {
          const found = extractCnpjFromText(String(alt.value));
          if (found) return found;
        }
      }
    }
  } catch {
    // extensão ausente ou não parseável
  }

  return null;
}

/**
 * Abre o .pfx com a senha informada e devolve metadados.
 * Senha errada → PfxValidationError (não salva).
 */
export function parseAndValidatePfx(
  pfxBuffer: Buffer,
  password: string,
): ParsedPfxCertificate {
  if (!pfxBuffer?.length) {
    throw new PfxValidationError('Arquivo do certificado A1 está vazio.');
  }
  if (!password) {
    throw new PfxValidationError('Informe a senha do certificado A1.');
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const binary = pfxBuffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(binary);
    // false = modo não-estrito (alguns A1 brasileiros usam BER)
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  } catch (err) {
    const msg = (err as Error).message || '';
    if (/MAC|password|Invalid|decrypt|PKCS#12/i.test(msg)) {
      throw new PfxValidationError(
        'Senha do certificado incorreta. Confira a senha do arquivo .pfx e tente novamente.',
      );
    }
    throw new PfxValidationError(
      'Não foi possível ler o certificado A1. Verifique se o arquivo .pfx é válido.',
    );
  }

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ||
    [];

  if (certBags.length === 0) {
    throw new PfxValidationError(
      'O arquivo .pfx não contém um certificado digital utilizável.',
    );
  }

  // Preferir o certificado "folha" (não CA) — em geral o primeiro com CNPJ no subject
  let cert: forge.pki.Certificate | null = null;
  for (const bag of certBags) {
    if (!bag.cert) continue;
    const cnpj = extractCnpjFromCertificate(bag.cert);
    if (cnpj) {
      cert = bag.cert;
      break;
    }
  }
  cert = cert || certBags[0].cert || null;

  if (!cert) {
    throw new PfxValidationError(
      'Não foi possível extrair o certificado do arquivo .pfx.',
    );
  }

  const nb = cert.validity.notBefore instanceof Date
    ? cert.validity.notBefore
    : new Date(String(cert.validity.notBefore));
  const na = cert.validity.notAfter instanceof Date
    ? cert.validity.notAfter
    : new Date(String(cert.validity.notAfter));

  const now = new Date();
  const isExpired = na.getTime() < now.getTime();
  const daysUntilExpiry = Math.floor((na.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (nb.getTime() > now.getTime()) {
    throw new PfxValidationError(
      'Este certificado A1 ainda não é válido (data de início no futuro).',
    );
  }

  if (isExpired) {
    throw new PfxValidationError(
      `Certificado A1 expirado em ${na.toLocaleDateString('pt-BR')}. Renove o certificado antes de cadastrar.`,
    );
  }

  const cnField = cert.subject.getField('CN');
  const subjectCn = cnField?.value ? String(cnField.value) : null;
  const subjectCnpj = extractCnpjFromCertificate(cert);

  return {
    subjectCn,
    subjectCnpj,
    notBefore: nb,
    notAfter: na,
    isExpired,
    daysUntilExpiry,
  };
}

/**
 * Valida senha/validade/CNPJ e compara com o CNPJ informado e o da empresa.
 * Só deve ser chamada antes de persistir o certificado.
 */
export function assertPfxReadyToSave(params: {
  pfxBuffer: Buffer;
  password: string;
  informedCnpj: string;
  companyCnpj?: string | null;
}): ParsedPfxCertificate {
  const parsed = parseAndValidatePfx(params.pfxBuffer, params.password);
  const informed = onlyDigits(params.informedCnpj);
  const company = onlyDigits(params.companyCnpj || '');

  if (!parsed.subjectCnpj) {
    throw new PfxValidationError(
      'Não foi possível identificar o CNPJ no certificado A1. Use o certificado ICP-Brasil da empresa.',
    );
  }

  if (informed && informed !== parsed.subjectCnpj) {
    throw new PfxValidationError(
      `CNPJ informado (${informed}) não corresponde ao CNPJ do certificado (${parsed.subjectCnpj}).`,
    );
  }

  if (company && company !== parsed.subjectCnpj) {
    throw new PfxValidationError(
      `O certificado pertence ao CNPJ ${parsed.subjectCnpj}, mas a empresa cadastrada é ${company}. ` +
        'Use o certificado A1 da própria empresa.',
    );
  }

  return parsed;
}
