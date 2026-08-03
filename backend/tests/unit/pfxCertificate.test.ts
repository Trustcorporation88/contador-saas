/**
 * Testes de validação de certificado A1 (.pfx)
 */
import forge from 'node-forge';
import {
  assertPfxReadyToSave,
  extractCnpjFromText,
  parseAndValidatePfx,
  PfxValidationError,
} from '../../src/utils/pfxCertificate';

function makePfx(options: {
  cn: string;
  password: string;
  notBeforeDays?: number;
  notAfterDays?: number;
}): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  const now = new Date();
  const notBefore = new Date(now);
  notBefore.setDate(now.getDate() + (options.notBeforeDays ?? -1));
  const notAfter = new Date(now);
  notAfter.setDate(now.getDate() + (options.notAfterDays ?? 365));
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  const attrs = [{ name: 'commonName', value: options.cn }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [cert],
    options.password,
    { algorithm: '3des' },
  );
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
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
});
