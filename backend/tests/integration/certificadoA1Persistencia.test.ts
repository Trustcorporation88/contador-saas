/**
 * Certificado A1: do upload até a mão do Python que assina a nota.
 *
 * Em produção há 19 empresas e ZERO certificados — este caminho nunca rodou com
 * dado real. E ele tem várias juntas onde um erro só apareceria na hora de
 * transmitir uma nota:
 *
 *   upload → valida (openssl) → grava .pfx em disco → cifra em AES-256-GCM →
 *   guarda no banco → [restart do processo] → lê → decifra → materializa o
 *   arquivo → entrega o caminho para a pynfe assinar.
 *
 * O disco do Railway é efêmero fora do volume, então o .pfx gravado some no
 * deploy seguinte — igual ao que acontecia com o XML capturado. O que precisa
 * sobreviver é a cópia cifrada no banco, e é isso que o teste central prova:
 * apaga o diretório de certificados, recarrega os módulos (equivalente a um
 * restart) e reconstrói o arquivo a partir do banco.
 *
 * O teste final entrega o arquivo materializado ao Python com a mesma chamada
 * que a pynfe faz. Conferir só os bytes provaria integridade, não usabilidade:
 * um .pfx íntegro que o Python não abre continua impedindo a emissão.
 *
 * Precisa de banco real: BACKUP_TEST_DATABASE_URL. Nenhum certificado real
 * entra no repositório — os daqui são autoassinados, gerados na hora.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import knex, { Knex } from 'knex';
import { randomUUID } from 'crypto';

const TEST_URL = process.env.BACKUP_TEST_DATABASE_URL;

function temOpenssl(): boolean {
  try { execFileSync('openssl', ['version'], { stdio: 'pipe' }); return true; } catch { return false; }
}

const ativo = Boolean(TEST_URL) && temOpenssl();
const describeLive = ativo ? describe : describe.skip;

if (!ativo) {
  // eslint-disable-next-line no-console
  console.warn('[certificadoA1Persistencia] sem BACKUP_TEST_DATABASE_URL ou sem openssl — pulado.');
}

const SENHA_PFX  = 'Senha@123';
const CNPJ       = '12345678000199';
const COMPANY_ID = '66666666-6666-4666-8666-666666666666';
const CHAVE_CIFRA = 'chave-dedicada-de-teste-do-certificado';

let db: Knex;
let dirTrabalho: string;
let dirCerts: string;
let pfxOriginal: Buffer;

/** Carrega os serviços com o banco e o diretório de certificados do teste. */
function carregarServicos() {
  jest.resetModules();
  process.env.FISCAL_CERTS_DIR = dirCerts;
  process.env.FISCAL_CERT_ENCRYPTION_KEY = CHAVE_CIFRA;
  jest.doMock('../../src/config/database', () => ({ getDatabase: async () => db }));
  jest.doMock('../../src/middleware/requestLogger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));
  /* eslint-disable @typescript-eslint/no-var-requires */
  return {
    captura: require('../../src/services/fiscalCaptureService').FiscalCaptureService,
    cripto:  require('../../src/utils/certEncryption'),
  };
  /* eslint-enable @typescript-eslint/no-var-requires */
}

/** Reconstrói o .pfx a partir do banco, como o nfeEmitter faz antes de assinar. */
async function materializarComoOEmitterFaz(): Promise<string> {
  const { cripto } = carregarServicos();
  const cert = await db('fiscal_certificates')
    .where({ company_id: COMPANY_ID, active: true }).first();
  if (!cert) throw new Error('certificado não encontrado');

  const pfxBase64 = cripto.decryptSecretWithLegacyFallback(String(cert.pfx_data));
  const destino = path.join(dirCerts, `${COMPANY_ID}.pfx`);
  await fs.promises.mkdir(path.dirname(destino), { recursive: true, mode: 0o700 });
  await fs.promises.writeFile(destino, Buffer.from(pfxBase64, 'base64'), { mode: 0o600 });
  return destino;
}

/** Abre o .pfx com a mesma biblioteca que a pynfe usa para assinar. */
function pythonConsegueAbrir(caminho: string, senha: string): { ok: boolean; detalhe: string } {
  const script = [
    'import sys',
    'from cryptography.hazmat.primitives.serialization import pkcs12',
    'with open(sys.argv[1], "rb") as f: dados = f.read()',
    'chave, cert, _ = pkcs12.load_key_and_certificates(dados, sys.argv[2].encode())',
    'assert chave is not None, "sem chave privada"',
    'print(cert.subject.rfc4514_string())',
  ].join('\n');
  try {
    const saida = execFileSync('python3', ['-c', script, caminho, senha], {
      encoding: 'utf8', stdio: 'pipe',
    });
    return { ok: true, detalhe: saida.trim() };
  } catch (erro) {
    const e = erro as { stderr?: Buffer | string; message: string };
    return { ok: false, detalhe: String(e.stderr ?? e.message).slice(-300) };
  }
}

describeLive('Certificado A1 — do upload até a assinatura', () => {

  beforeAll(async () => {
    db = knex({ client: 'pg', connection: TEST_URL as string });

    dirTrabalho = fs.mkdtempSync(path.join(os.tmpdir(), 'a1-persist-'));
    dirCerts = path.join(dirTrabalho, 'certs');
    process.env.FISCAL_CERTS_DIR = dirCerts;
    process.env.FISCAL_CERT_ENCRYPTION_KEY = CHAVE_CIFRA;

    // Certificado no molde de um e-CNPJ, embalado em RC2-40 — o formato antigo
    // em que a maioria dos A1 brasileiros vem.
    const cnf = path.join(dirTrabalho, 'req.cnf');
    fs.writeFileSync(cnf, [
      '[req]', 'distinguished_name = dn', 'x509_extensions = v3', 'prompt = no',
      '[dn]', `CN = EMPRESA TESTE LTDA:${CNPJ}`, 'O = ICP-Brasil', 'C = BR',
      '[v3]', 'basicConstraints = CA:FALSE',
      `subjectAltName = otherName:2.16.76.1.3.3;UTF8:${CNPJ}`,
    ].join('\n'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', path.join(dirTrabalho, 'k.pem'), '-out', path.join(dirTrabalho, 'c.pem'),
      '-days', '365', '-nodes', '-config', cnf], { stdio: 'pipe' });
    const pfx = path.join(dirTrabalho, 'a1.pfx');
    execFileSync('openssl', ['pkcs12', '-export', '-out', pfx,
      '-inkey', path.join(dirTrabalho, 'k.pem'), '-in', path.join(dirTrabalho, 'c.pem'),
      '-passout', `pass:${SENHA_PFX}`,
      '-certpbe', 'PBE-SHA1-RC2-40', '-keypbe', 'PBE-SHA1-3DES',
      '-macalg', 'sha1', '-legacy'], { stdio: 'pipe' });
    pfxOriginal = fs.readFileSync(pfx);

    // Schema de produção, pelo runner de migrações — e não um CREATE TABLE
    // escrito à mão aqui. As colunas reais são `legal_name` (não `name`) e
    // `company_id varchar(64)`; um schema inventado no teste passaria verde
    // enquanto a produção quebra.
    const { runMigrationsIfNeeded } = await import('../../src/utils/migrationRunner');
    await db.raw('CREATE TABLE IF NOT EXISTS migrations_executed (id serial PRIMARY KEY, migration_name text UNIQUE, executed_at timestamptz DEFAULT now())');
    await runMigrationsIfNeeded(db);

    await db('fiscal_certificates').where('company_id', COMPANY_ID).del();
    await db('companies').where('id', COMPANY_ID).del();
    await db('companies').insert({
      id: COMPANY_ID, legal_name: 'Empresa Teste Ltda', cnpj: CNPJ,
      tax_regime: 'simples_nacional',
    });
  }, 300000);

  afterAll(async () => {
    if (db) {
      await db('fiscal_certificates').where('company_id', COMPANY_ID).del();
      await db('companies').where('id', COMPANY_ID).del();
      await db.destroy();
    }
    if (dirTrabalho) fs.rmSync(dirTrabalho, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await db('fiscal_certificates').where('company_id', COMPANY_ID).del();
    fs.rmSync(dirCerts, { recursive: true, force: true });
  });

  it('grava o certificado cifrado — nunca em texto claro no banco', async () => {
    const { captura } = carregarServicos();
    await captura.upsertCertificate(COMPANY_ID, {
      cnpj: CNPJ, uf: 'SP', password: SENHA_PFX, pfxBuffer: pfxOriginal,
    });

    const linha = await db('fiscal_certificates').where('company_id', COMPANY_ID).first();
    expect(linha).toBeTruthy();

    // A chave privada da empresa não pode estar legível para quem lê o banco,
    // nem para o backup diário, nem para a API REST do Supabase.
    const base64Puro = pfxOriginal.toString('base64');
    expect(linha.pfx_data).not.toBe(base64Puro);
    expect(linha.pfx_data).not.toContain(base64Puro.slice(0, 64));

    // A senha também é cifrada, e não sobra em texto claro em lugar nenhum.
    expect(linha.password_encrypted).not.toBe(SENHA_PFX);
    expect(JSON.stringify(linha)).not.toContain(SENHA_PFX);

    // Validade lida do próprio certificado, não do que o cliente informou.
    expect(new Date(linha.cert_valid_until).getTime()).toBeGreaterThan(Date.now());
    expect(linha.cnpj).toBe(CNPJ);
  }, 180000);

  it('SOBREVIVE AO RESTART: reconstrói o .pfx do banco depois do disco sumir', async () => {
    const { captura } = carregarServicos();
    await captura.upsertCertificate(COMPANY_ID, {
      cnpj: CNPJ, uf: 'SP', password: SENHA_PFX, pfxBuffer: pfxOriginal,
    });

    // Deploy: o disco fora do volume é descartado e o processo reinicia.
    fs.rmSync(dirCerts, { recursive: true, force: true });
    expect(fs.existsSync(path.join(dirCerts, `${COMPANY_ID}.pfx`))).toBe(false);

    const caminho = await materializarComoOEmitterFaz();

    // Byte a byte igual ao que foi enviado: a cifra é reversível sem perda.
    expect(fs.readFileSync(caminho).equals(pfxOriginal)).toBe(true);
  }, 180000);

  it('o arquivo reconstruído tem permissão 0600', async () => {
    const { captura } = carregarServicos();
    await captura.upsertCertificate(COMPANY_ID, {
      cnpj: CNPJ, uf: 'SP', password: SENHA_PFX, pfxBuffer: pfxOriginal,
    });
    fs.rmSync(dirCerts, { recursive: true, force: true });
    const caminho = await materializarComoOEmitterFaz();

    // Chave privada legível por outros usuários do container seria vazamento.
    expect(fs.statSync(caminho).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(caminho)).mode & 0o777).toBe(0o700);
  }, 180000);

  it('O PYTHON ABRE o certificado reconstruído — é o que a pynfe faz para assinar', async () => {
    const { captura, cripto } = carregarServicos();
    await captura.upsertCertificate(COMPANY_ID, {
      cnpj: CNPJ, uf: 'SP', password: SENHA_PFX, pfxBuffer: pfxOriginal,
    });
    fs.rmSync(dirCerts, { recursive: true, force: true });

    const caminho = await materializarComoOEmitterFaz();
    const linha = await db('fiscal_certificates').where('company_id', COMPANY_ID).first();
    const senha = cripto.decryptSecret(String(linha.password_encrypted));

    // A senha decifrada tem de abrir o arquivo decifrado. Se qualquer uma das
    // duas pontas se perder, a nota falha só na transmissão.
    expect(senha).toBe(SENHA_PFX);

    const resultado = pythonConsegueAbrir(caminho, senha);
    expect(resultado.ok).toBe(true);
    expect(resultado.detalhe).toContain(CNPJ);
  }, 180000);

  it('recusa o certificado de outra empresa antes de gravar qualquer coisa', async () => {
    const { captura } = carregarServicos();
    await db('companies').where('id', COMPANY_ID).update({ cnpj: '98765432000121' });

    try {
      await expect(captura.upsertCertificate(COMPANY_ID, {
        cnpj: CNPJ, uf: 'SP', password: SENHA_PFX, pfxBuffer: pfxOriginal,
      })).rejects.toThrow(/pertence ao CNPJ/i);

      // Recusar depois de gravar deixaria certificado da empresa errada no banco.
      const linha = await db('fiscal_certificates').where('company_id', COMPANY_ID).first();
      expect(linha).toBeUndefined();
    } finally {
      await db('companies').where('id', COMPANY_ID).update({ cnpj: CNPJ });
    }
  }, 180000);

  it('senha errada não grava certificado', async () => {
    const { captura } = carregarServicos();
    await expect(captura.upsertCertificate(COMPANY_ID, {
      cnpj: CNPJ, uf: 'SP', password: 'senha-errada', pfxBuffer: pfxOriginal,
    })).rejects.toThrow();

    expect(await db('fiscal_certificates').where('company_id', COMPANY_ID).first())
      .toBeUndefined();
  }, 180000);

  it('trocar a chave de criptografia torna o certificado ilegível — e isso precisa doer', async () => {
    // FISCAL_CERT_ENCRYPTION_KEY foi definida em produção em 10/08/2026. Se
    // alguém trocar essa variável, os certificados já gravados param de abrir.
    // O fallback de legado devolveria o texto cifrado como se fosse base64
    // válido, e o erro só apareceria lá na frente, na pynfe. Este teste fixa
    // que o dado NÃO volta utilizável — para ninguém trocar a chave achando
    // que é inofensivo.
    const { captura } = carregarServicos();
    await captura.upsertCertificate(COMPANY_ID, {
      cnpj: CNPJ, uf: 'SP', password: SENHA_PFX, pfxBuffer: pfxOriginal,
    });

    jest.resetModules();
    process.env.FISCAL_CERT_ENCRYPTION_KEY = 'outra-chave-completamente-diferente';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const outroCripto = require('../../src/utils/certEncryption');

    const linha = await db('fiscal_certificates').where('company_id', COMPANY_ID).first();
    const recuperado = outroCripto.decryptSecretWithLegacyFallback(String(linha.pfx_data));

    expect(Buffer.from(recuperado, 'base64').equals(pfxOriginal)).toBe(false);

    process.env.FISCAL_CERT_ENCRYPTION_KEY = CHAVE_CIFRA;
  }, 180000);
});
