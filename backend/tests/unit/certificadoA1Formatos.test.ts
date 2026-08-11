/**
 * Certificado A1: os formatos de PKCS#12 que aparecem no mundo real.
 *
 * A validação do upload abre o .pfx com o binário `openssl`. O OpenSSL 3
 * removeu do provider padrão os algoritmos antigos (RC2-40, 3DES) — e é
 * justamente neles que a maior parte dos A1 emitidos pelas ACs brasileiras
 * está embalada. Por isso pfxCertificate tem um segundo passo com `-legacy`.
 *
 * Esse fallback só funciona se o provider legacy existir no runtime. Na imagem
 * de produção (node:18-alpine3.21) ele vem em /usr/lib/ossl-modules/legacy.so,
 * do pacote libcrypto3, que é dependência do openssl instalado no Dockerfile.
 * Se alguém trocar a base da imagem ou remover o openssl do apk add, o upload
 * passa a recusar certificado bom com "senha incorreta" — mensagem que manda o
 * usuário procurar o erro exatamente no lugar errado.
 *
 * Os certificados são GERADOS aqui, na hora, contra o openssl do ambiente:
 * fixture binário comitado provaria só que o arquivo continua o mesmo, não que
 * a máquina que roda o teste consegue abri-lo.
 *
 * Nenhum certificado real entra no repositório. Estes são autoassinados.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseAndValidatePfx, assertPfxReadyToSave, PfxValidationError,
  extractCnpjFromText, extractCnpjFromSanText,
} from '../../src/utils/pfxCertificate';

const SENHA = 'Senha@123';
const CNPJ = '12345678000199';
const CNPJ_OUTRO = '98765432000121';

let dir: string;

/** Há openssl no PATH? Sem ele o upload de certificado não funciona. */
function temOpenssl(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const disponivel = temOpenssl();
const describeSe = disponivel ? describe : describe.skip;

if (!disponivel) {
  // eslint-disable-next-line no-console
  console.warn('[certificadoA1Formatos] openssl não encontrado — pulado.');
}

/**
 * Gera um par chave/certificado autoassinado no molde de um e-CNPJ:
 * CNPJ no CN (como "RAZAO SOCIAL:CNPJ") e no subjectAltName pelo OID
 * ICP-Brasil 2.16.76.1.3.3.
 */
function gerarCertificado(nome: string, cnpj: string, dias: number, comCnpjNoCn = true): void {
  const cn = comCnpjNoCn ? `EMPRESA TESTE LTDA:${cnpj}` : 'EMPRESA TESTE LTDA';
  const cnf = path.join(dir, `${nome}.cnf`);
  fs.writeFileSync(cnf, [
    '[req]', 'distinguished_name = dn', 'x509_extensions = v3', 'prompt = no',
    '[dn]', `CN = ${cn}`, 'O = ICP-Brasil', 'C = BR',
    '[v3]', 'basicConstraints = CA:FALSE', 'keyUsage = digitalSignature, keyEncipherment',
    `subjectAltName = otherName:2.16.76.1.3.3;UTF8:${cnpj}`,
  ].join('\n'));

  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', path.join(dir, `${nome}.key`), '-out', path.join(dir, `${nome}.crt`),
    '-days', String(dias), '-nodes', '-config', cnf,
  ], { stdio: 'pipe' });
}

/** Empacota em .pfx. `algoritmo` decide se sai moderno ou no formato antigo. */
function gerarPfx(nome: string, algoritmo: 'aes' | '3des' | 'rc2'): Buffer {
  const saida = path.join(dir, `${nome}-${algoritmo}.pfx`);
  const base = [
    'pkcs12', '-export', '-out', saida,
    '-inkey', path.join(dir, `${nome}.key`), '-in', path.join(dir, `${nome}.crt`),
    '-passout', `pass:${SENHA}`,
  ];
  const antigos: Record<string, string[]> = {
    // pbeWithSHA1And3-KeyTripleDES-CBC
    '3des': ['-certpbe', 'PBE-SHA1-3DES', '-keypbe', 'PBE-SHA1-3DES', '-macalg', 'sha1', '-legacy'],
    // pbeWithSHA1And40BitRC2-CBC — o mais comum nos A1 antigos.
    'rc2':  ['-certpbe', 'PBE-SHA1-RC2-40', '-keypbe', 'PBE-SHA1-3DES', '-macalg', 'sha1', '-legacy'],
  };
  execFileSync('openssl', [...base, ...(antigos[algoritmo] ?? [])], { stdio: 'pipe' });
  return fs.readFileSync(saida);
}

describeSe('Certificado A1 — formatos de PKCS#12', () => {

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a1-teste-'));
    gerarCertificado('valido', CNPJ, 365);
  }, 120000);

  afterAll(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    ['AES-256 (formato atual)', 'aes'],
    ['3DES (formato antigo)', '3des'],
    ['RC2-40 (o mais comum nos A1 brasileiros)', 'rc2'],
  ] as const)('abre o .pfx em %s', (_titulo, algoritmo) => {
    const parsed = parseAndValidatePfx(gerarPfx('valido', algoritmo), SENHA);

    expect(parsed.subjectCnpj).toBe(CNPJ);
    expect(parsed.subjectCn).toContain('EMPRESA TESTE LTDA');
    expect(parsed.isExpired).toBe(false);
    expect(parsed.daysUntilExpiry).toBeGreaterThan(300);
  }, 120000);

  it('recusa senha errada em vez de gravar o certificado', () => {
    // Gravar com senha errada daria um certificado cadastrado que só falha na
    // hora de transmitir a nota — longe do momento em que dá para corrigir.
    expect(() => parseAndValidatePfx(gerarPfx('valido', 'rc2'), 'senha-errada'))
      .toThrow(PfxValidationError);
  }, 120000);

  it('recusa arquivo vazio e senha em branco', () => {
    expect(() => parseAndValidatePfx(Buffer.alloc(0), SENHA)).toThrow(/vazio/i);
    expect(() => parseAndValidatePfx(gerarPfx('valido', 'aes'), '')).toThrow(/senha/i);
  }, 120000);

  it('lê o CNPJ do subjectAltName quando ele não está no CN', () => {
    // Vários e-CNPJ não trazem o CNPJ no CN — só na extensão ICP-Brasil. O
    // X509Certificate do Node mostra "othername:<unsupported>" para ela, e é o
    // openssl quem decodifica.
    gerarCertificado('sem-cn', CNPJ, 365, false);
    const parsed = parseAndValidatePfx(gerarPfx('sem-cn', 'rc2'), SENHA);

    expect(parsed.subjectCn).toBe('EMPRESA TESTE LTDA');
    expect(parsed.subjectCn).not.toContain(CNPJ);
    expect(parsed.subjectCnpj).toBe(CNPJ);
  }, 120000);
});

describeSe('Certificado A1 — a quem o certificado pertence', () => {

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a1-dono-'));
    gerarCertificado('valido', CNPJ, 365);
  }, 120000);

  afterAll(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('aceita quando o certificado, o formulário e a empresa batem', () => {
    const parsed = assertPfxReadyToSave({
      pfxBuffer: gerarPfx('valido', 'rc2'),
      password: SENHA,
      informedCnpj: CNPJ,
      companyCnpj: CNPJ,
    });
    expect(parsed.subjectCnpj).toBe(CNPJ);
  }, 120000);

  it('recusa certificado de outra empresa', () => {
    // Sem esta checagem dava para cadastrar o certificado de uma empresa na
    // tenant de outra e emitir nota em nome dela.
    expect(() => assertPfxReadyToSave({
      pfxBuffer: gerarPfx('valido', 'rc2'),
      password: SENHA,
      informedCnpj: CNPJ,
      companyCnpj: CNPJ_OUTRO,
    })).toThrow(/pertence ao CNPJ/i);
  }, 120000);

  it('recusa quando o CNPJ do formulário não é o do certificado', () => {
    expect(() => assertPfxReadyToSave({
      pfxBuffer: gerarPfx('valido', 'rc2'),
      password: SENHA,
      informedCnpj: CNPJ_OUTRO,
      companyCnpj: CNPJ,
    })).toThrow(/não corresponde/i);
  }, 120000);

  it('recusa, com 422, quando a empresa está sem CNPJ cadastrado', () => {
    // Há 1 empresa em produção sem regime preenchido; cadastro incompleto
    // acontece. Sem CNPJ na empresa não há como cruzar, e pular a checagem
    // seria abrir a porta do parágrafo acima.
    try {
      assertPfxReadyToSave({
        pfxBuffer: gerarPfx('valido', 'rc2'),
        password: SENHA,
        informedCnpj: CNPJ,
        companyCnpj: null,
      });
      throw new Error('deveria ter recusado');
    } catch (erro) {
      expect(erro).toBeInstanceOf(PfxValidationError);
      expect((erro as PfxValidationError).status).toBe(422);
      expect((erro as Error).message).toMatch(/CNPJ da empresa/i);
    }
  }, 120000);
});

describe('Certificado A1 — extração de CNPJ (sem openssl)', () => {

  it('encontra o CNPJ nos formatos usuais de subject', () => {
    expect(extractCnpjFromText('CN=EMPRESA LTDA:12345678000199')).toBe('12345678000199');
    expect(extractCnpjFromText('CNPJ: 12.345.678/0001-99')).toBe('12345678000199');
    expect(extractCnpjFromText('serialNumber=12345678000199')).toBe('12345678000199');
  });

  it('devolve null quando não há CNPJ', () => {
    expect(extractCnpjFromText('CN=FULANO DE TAL')).toBeNull();
    expect(extractCnpjFromText('')).toBeNull();
  });

  it('lê o OID ICP-Brasil nos dois formatos que o openssl imprime', () => {
    expect(extractCnpjFromSanText('othername: 2.16.76.1.3.3::12345678000199'))
      .toBe('12345678000199');
    expect(extractCnpjFromSanText('othername: 2.16.76.1.3.3:UTF8:12345678000199'))
      .toBe('12345678000199');
  });

  it('não confunde outro OID com o do CNPJ', () => {
    // 2.16.76.1.3.1 carrega dados da pessoa física (CPF, PIS...). Ler o número
    // dali como CNPJ cadastraria o certificado no CNPJ errado.
    expect(extractCnpjFromSanText('othername: 2.16.76.1.3.1::00000000000123456789'))
      .toBeNull();
  });
});
