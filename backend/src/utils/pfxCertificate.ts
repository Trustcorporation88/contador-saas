/**
 * Validação de certificado digital A1 (.pfx / PKCS#12)
 * — senha correta, validade e CNPJ (ICP-Brasil)
 *
 * Usa OpenSSL (já presente no runtime) + crypto.X509Certificate do Node,
 * sem dependência npm extra (evita disparar Security Audit no package-lock).
 */
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { X509Certificate } from 'crypto';

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
 * Formatos comuns: "RAZAO SOCIAL:12345678000195", serialNumber, etc.
 */
export function extractCnpjFromText(text: string): string | null {
  if (!text) return null;

  const labeled = text.match(/CNPJ[:\s]*([\d./-]{14,18})/i);
  if (labeled) {
    const digits = onlyDigits(labeled[1]);
    if (digits.length === 14) return digits;
  }

  const colon = text.match(/:(\d{14})\b/);
  if (colon) return colon[1];

  const masked = text.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  if (masked) {
    const digits = onlyDigits(masked[1]);
    if (digits.length === 14) return digits;
  }

  const raw = text.match(/\b(\d{14})\b/);
  return raw ? raw[1] : null;
}

function extractLeafPem(opensslStdout: string): string | null {
  const matches = opensslStdout.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  return matches && matches.length > 0 ? matches[0] : null;
}

/** OID ICP-Brasil do CNPJ do titular, dentro do subjectAltName. */
const OID_CNPJ_ICP_BRASIL = '2.16.76.1.3.3';

/**
 * Extrai o CNPJ do subjectAltName (OID ICP-Brasil 2.16.76.1.3.3).
 *
 * Nem todo certificado A1 traz o CNPJ no CN: em vários e-CNPJ ele existe
 * apenas nesta extensão. `crypto.X509Certificate.subjectAltName` mostra só
 * "othername:<unsupported>" — o OpenSSL é quem sabe decodificar o conteúdo.
 */
export function extractCnpjFromSanText(opensslTextOutput: string): string | null {
  if (!opensslTextOutput) return null;

  const oidEscapado = OID_CNPJ_ICP_BRASIL.replace(/\./g, '\\.');
  // Formatos vistos no OpenSSL: "othername: 2.16.76.1.3.3::12345678000199"
  // e "othername: 2.16.76.1.3.3:UTF8:12345678000199".
  const ancorado = opensslTextOutput.match(
    new RegExp(`${oidEscapado}\\s*:[^,\\n]*?(\\d{14})`),
  );
  if (ancorado) return ancorado[1];

  return null;
}

/** Dump textual do certificado, para ler extensões que o Node não decodifica. */
function opensslCertText(pem: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pfx-text-'));
  const pemPath = join(dir, 'cert.pem');
  try {
    writeFileSync(pemPath, pem, { mode: 0o600 });
    const result = spawnSync('openssl', ['x509', '-in', pemPath, '-noout', '-text'], {
      encoding: 'utf8',
    });
    return `${result.stdout || ''}`;
  } catch {
    return '';
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Extrai o certificado folha do .pfx via OpenSSL.
 * Senha errada → PfxValidationError.
 */
function extractCertificatePem(pfxBuffer: Buffer, password: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pfx-validate-'));
  const pfxPath = join(dir, 'cert.pfx');
  const outPath = join(dir, 'out.pem');

  try {
    writeFileSync(pfxPath, pfxBuffer);

    const result = spawnSync(
      'openssl',
      [
        'pkcs12',
        '-in', pfxPath,
        '-passin', 'env:PFX_PASS',
        '-nokeys',
        '-clcerts',
        '-out', outPath,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, PFX_PASS: password },
      },
    );

    let stderr = `${result.stderr || ''}${result.stdout || ''}`;
    let outExists = false;
    try {
      outExists = readFileSync(outPath).length > 0;
    } catch {
      outExists = false;
    }

    if (result.status !== 0 || !outExists) {
      const legacy = spawnSync(
        'openssl',
        [
          'pkcs12',
          '-in', pfxPath,
          '-passin', 'env:PFX_PASS',
          '-nokeys',
          '-clcerts',
          '-legacy',
          '-out', outPath,
        ],
        { encoding: 'utf8', env: { ...process.env, PFX_PASS: password } },
      );
      stderr = `${legacy.stderr || ''}${legacy.stdout || ''}`;
      try {
        outExists = readFileSync(outPath).length > 0;
      } catch {
        outExists = false;
      }
      if (legacy.status !== 0 || !outExists) {
        if (/invalid password|mac verify|password|bad decrypt|pkcs12 cipher/i.test(stderr)) {
          throw new PfxValidationError(
            'Senha do certificado incorreta. Confira a senha do arquivo .pfx e tente novamente.',
          );
        }
        throw new PfxValidationError(
          'Não foi possível ler o certificado A1. Verifique se o arquivo .pfx é válido.',
        );
      }
    }

    const pem = readFileSync(outPath, 'utf8');
    const leaf = extractLeafPem(pem);
    if (!leaf) {
      throw new PfxValidationError(
        'O arquivo .pfx não contém um certificado digital utilizável.',
      );
    }
    return leaf;
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
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

  const pem = extractCertificatePem(pfxBuffer, password);
  let x509: X509Certificate;
  try {
    x509 = new X509Certificate(pem);
  } catch {
    throw new PfxValidationError(
      'Não foi possível extrair o certificado do arquivo .pfx.',
    );
  }

  const nb = new Date(x509.validFrom);
  const na = new Date(x509.validTo);
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

  const subject = x509.subject || '';
  // Subject primeiro (é onde a maioria dos A1 de NF-e traz "RAZAO SOCIAL:CNPJ");
  // se não estiver lá, cai na extensão ICP-Brasil.
  const subjectCnpj =
    extractCnpjFromText(subject) || extractCnpjFromSanText(opensslCertText(pem));
  const cnMatch = subject.match(/CN\s*=\s*([^,\n]+)/i);
  const subjectCn = cnMatch ? cnMatch[1].trim() : null;

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

  // Sem o CNPJ da empresa não há como cruzar, e a checagem era simplesmente
  // pulada: dava para cadastrar o certificado de uma empresa na tenant de
  // outra, bastando informar no formulário o CNPJ do próprio certificado.
  if (!company) {
    throw new PfxValidationError(
      'A empresa está sem CNPJ cadastrado, então não é possível conferir se o certificado é dela. '
        + 'Preencha o CNPJ da empresa antes de enviar o certificado A1.',
      422,
    );
  }

  if (company !== parsed.subjectCnpj) {
    throw new PfxValidationError(
      `O certificado pertence ao CNPJ ${parsed.subjectCnpj}, mas a empresa cadastrada é ${company}. ` +
        'Use o certificado A1 da própria empresa.',
    );
  }

  return parsed;
}
