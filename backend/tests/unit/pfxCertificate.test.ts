/**
 * Testes de validação de certificado A1 (.pfx)
 * Gera PFX de teste com OpenSSL (sem node-forge).
 */
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  assertPfxReadyToSave,
  extractCnpjFromSanText,
  extractCnpjFromText,
  parseAndValidatePfx,
  PfxValidationError,
} from '../../src/utils/pfxCertificate';

/**
 * PFX com o CNPJ apenas no subjectAltName (OID ICP-Brasil 2.16.76.1.3.3),
 * como vários e-CNPJ reais — o CN não tem o número.
 */
function makePfxComCnpjNoSan(options: { cn: string; cnpj: string; password: string }): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'pfx-san-test-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  const pfxPath = join(dir, 'cert.pfx');
  const confPath = join(dir, 'openssl.cnf');

  writeFileSync(
    confPath,
    `[req]
distinguished_name=dn
req_extensions=ext
prompt=no
[dn]
CN=${options.cn}
O=ICP-Brasil
C=BR
[ext]
subjectAltName=@san
[san]
otherName.1=2.16.76.1.3.3;UTF8:${options.cnpj}
`,
  );

  try {
    const req = spawnSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048',
        '-keyout', keyPath,
        '-out', certPath,
        '-nodes', '-days', '365',
        '-config', confPath,
        '-extensions', 'ext',
      ],
      { encoding: 'utf8' },
    );
    if (req.status !== 0 || !existsSync(certPath)) {
      throw new Error(`openssl req (SAN) failed: ${req.stderr}`);
    }

    const p12 = spawnSync(
      'openssl',
      [
        'pkcs12', '-export',
        '-inkey', keyPath,
        '-in', certPath,
        '-out', pfxPath,
        '-password', `pass:${options.password}`,
      ],
      { encoding: 'utf8' },
    );
    if (p12.status !== 0) {
      throw new Error(`openssl pkcs12 export (SAN) failed: ${p12.stderr}`);
    }
    return readFileSync(pfxPath);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

function makePfx(options: {
  cn: string;
  password: string;
  notBeforeDays?: number;
  notAfterDays?: number;
}): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'pfx-test-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  const pfxPath = join(dir, 'cert.pfx');
  const confPath = join(dir, 'openssl.cnf');

  const notBeforeDays = options.notBeforeDays ?? -1;
  const notAfterDays = options.notAfterDays ?? 365;
  // OpenSSL -startdate/-enddate format: YYYYMMDDHHMMSSZ
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + notBeforeDays);
  const end = new Date(now);
  end.setDate(now.getDate() + notAfterDays);

  writeFileSync(
    confPath,
    `[req]
distinguished_name=req_distinguished_name
prompt=no
[req_distinguished_name]
CN=${options.cn}
`,
  );

  try {
    const req = spawnSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048',
        '-keyout', keyPath,
        '-out', certPath,
        '-nodes',
        '-config', confPath,
        '-not_before', fmt(start),
        '-not_after', fmt(end),
      ],
      { encoding: 'utf8' },
    );

    // OpenSSL < 3.2 may not support -not_before/-not_after on req; fallback to -days
    if (req.status !== 0 || !existsSync(certPath)) {
      const days = Math.max(1, notAfterDays);
      const fallback = spawnSync(
        'openssl',
        [
          'req', '-x509', '-newkey', 'rsa:2048',
          '-keyout', keyPath,
          '-out', certPath,
          '-nodes',
          '-days', String(days),
          '-config', confPath,
        ],
        { encoding: 'utf8' },
      );
      if (fallback.status !== 0) {
        throw new Error(`openssl req failed: ${fallback.stderr || req.stderr}`);
      }

      // For expired certs, use cryptography via python if days would be positive
      if (notAfterDays < 0) {
        const py = spawnSync(
          'python3',
          ['-c', `
from datetime import datetime, timedelta, timezone
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, ${JSON.stringify(options.cn)})])
now = datetime.now(timezone.utc)
cert = (x509.CertificateBuilder()
    .subject_name(subject).issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now + timedelta(days=${notBeforeDays}))
    .not_valid_after(now + timedelta(days=${notAfterDays}))
    .sign(key, hashes.SHA256()))
pfx = pkcs12.serialize_key_and_certificates(
    b"t", key, cert, None,
    serialization.BestAvailableEncryption(${JSON.stringify(options.password)}.encode()))
open(${JSON.stringify(pfxPath)}, "wb").write(pfx)
`],
          { encoding: 'utf8' },
        );
        if (py.status !== 0) {
          throw new Error(`python pfx failed: ${py.stderr}`);
        }
        return readFileSync(pfxPath);
      }
    }

    const p12 = spawnSync(
      'openssl',
      [
        'pkcs12', '-export',
        '-inkey', keyPath,
        '-in', certPath,
        '-out', pfxPath,
        '-password', `pass:${options.password}`,
        '-name', 'teste',
      ],
      { encoding: 'utf8' },
    );
    if (p12.status !== 0) {
      throw new Error(`openssl pkcs12 export failed: ${p12.stderr}`);
    }
    return readFileSync(pfxPath);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

describe('pfxCertificate', () => {
  const CNPJ = '11222333000181';
  const OTHER = '99888777000166';
  const PASSWORD = 'senha-correta';

  it('extrai CNPJ de textos ICP-Brasil', () => {
    expect(extractCnpjFromText(`EMPRESA TESTE LTDA:${CNPJ}`)).toBe(CNPJ);
    expect(extractCnpjFromText(`CNPJ: 11.222.333/0001-81`)).toBe(CNPJ);
    expect(extractCnpjFromText('sem documento')).toBeNull();
  });

  it('aceita senha correta e lê CNPJ/validade', () => {
    const pfx = makePfx({ cn: `EMPRESA TESTE LTDA:${CNPJ}`, password: PASSWORD });
    const parsed = parseAndValidatePfx(pfx, PASSWORD);
    expect(parsed.subjectCnpj).toBe(CNPJ);
    expect(parsed.isExpired).toBe(false);
    expect(parsed.notAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejeita senha incorreta e NÃO deixa seguir', () => {
    const pfx = makePfx({ cn: `EMPRESA TESTE LTDA:${CNPJ}`, password: PASSWORD });
    expect(() => parseAndValidatePfx(pfx, 'senha-errada')).toThrow(PfxValidationError);
    expect(() => parseAndValidatePfx(pfx, 'senha-errada')).toThrow(/Senha do certificado incorreta/i);
  });

  it('rejeita certificado expirado', () => {
    const pfx = makePfx({
      cn: `EMPRESA VENCIDA:${CNPJ}`,
      password: PASSWORD,
      notBeforeDays: -40,
      notAfterDays: -10,
    });
    expect(() => parseAndValidatePfx(pfx, PASSWORD)).toThrow(/expirado/i);
  });

  it('rejeita CNPJ informado diferente do certificado', () => {
    const pfx = makePfx({ cn: `EMPRESA TESTE LTDA:${CNPJ}`, password: PASSWORD });
    expect(() =>
      assertPfxReadyToSave({
        pfxBuffer: pfx,
        password: PASSWORD,
        informedCnpj: OTHER,
        companyCnpj: CNPJ,
      }),
    ).toThrow(/não corresponde/i);
  });

  it('rejeita certificado de outra empresa (CNPJ da company)', () => {
    const pfx = makePfx({ cn: `OUTRA EMPRESA:${OTHER}`, password: PASSWORD });
    expect(() =>
      assertPfxReadyToSave({
        pfxBuffer: pfx,
        password: PASSWORD,
        informedCnpj: OTHER,
        companyCnpj: CNPJ,
      }),
    ).toThrow(/pertence ao CNPJ/i);
  });

  it('aceita quando CNPJ informado, empresa e certificado batem', () => {
    const pfx = makePfx({ cn: `EMPRESA TESTE LTDA:${CNPJ}`, password: PASSWORD });
    const parsed = assertPfxReadyToSave({
      pfxBuffer: pfx,
      password: PASSWORD,
      informedCnpj: CNPJ,
      companyCnpj: CNPJ,
    });
    expect(parsed.subjectCnpj).toBe(CNPJ);
  });

  it('recusa upload quando a empresa está sem CNPJ (não há como cruzar)', () => {
    const pfx = makePfx({ cn: `EMPRESA TESTE LTDA:${CNPJ}`, password: PASSWORD });
    expect(() =>
      assertPfxReadyToSave({
        pfxBuffer: pfx,
        password: PASSWORD,
        informedCnpj: CNPJ,
        companyCnpj: null,
      }),
    ).toThrow(/sem CNPJ cadastrado/i);
  });

  describe('CNPJ no subjectAltName (OID ICP-Brasil 2.16.76.1.3.3)', () => {
    it('extrai do dump textual do OpenSSL', () => {
      expect(
        extractCnpjFromSanText(
          `            X509v3 Subject Alternative Name:\n                othername: 2.16.76.1.3.3::${CNPJ}, email:x@y.com\n`,
        ),
      ).toBe(CNPJ);
      expect(
        extractCnpjFromSanText(`othername: 2.16.76.1.3.3:UTF8:${CNPJ}`),
      ).toBe(CNPJ);
    });

    it('ignora outros OIDs ICP-Brasil (CPF do responsável, por exemplo)', () => {
      // 2.16.76.1.3.1 traz data de nascimento + CPF do responsável: não é o
      // CNPJ do titular e não pode ser confundido com ele.
      expect(extractCnpjFromSanText('othername: 2.16.76.1.3.1::2505198012345678901')).toBeNull();
      expect(extractCnpjFromSanText('othername:<unsupported>, email:x@y.com')).toBeNull();
      expect(extractCnpjFromSanText('')).toBeNull();
    });

    it('aceita certificado cujo CNPJ só existe no SAN', () => {
      const pfx = makePfxComCnpjNoSan({
        cn: 'EMPRESA SEM CNPJ NO CN LTDA',
        cnpj: CNPJ,
        password: PASSWORD,
      });
      const parsed = assertPfxReadyToSave({
        pfxBuffer: pfx,
        password: PASSWORD,
        informedCnpj: CNPJ,
        companyCnpj: CNPJ,
      });
      expect(parsed.subjectCnpj).toBe(CNPJ);
    });

    it('continua barrando empresa errada quando o CNPJ vem do SAN', () => {
      const pfx = makePfxComCnpjNoSan({
        cn: 'EMPRESA SEM CNPJ NO CN LTDA',
        cnpj: CNPJ,
        password: PASSWORD,
      });
      expect(() =>
        assertPfxReadyToSave({
          pfxBuffer: pfx,
          password: PASSWORD,
          informedCnpj: CNPJ,
          companyCnpj: OTHER,
        }),
      ).toThrow(/pertence ao CNPJ/i);
    });
  });
});
