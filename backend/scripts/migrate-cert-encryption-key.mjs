/**
 * Recriptografa os certificados A1 para uma FISCAL_CERT_ENCRYPTION_KEY dedicada.
 *
 * Por que é necessário: sem FISCAL_CERT_ENCRYPTION_KEY, a senha do certificado e
 * o próprio .pfx são cifrados com uma chave derivada do JWT_SECRET. Se você
 * apenas passar a definir a chave nova, `decryptSecret` (que não tem fallback)
 * estoura e a emissão de NF-e e a captura fiscal param de funcionar.
 *
 * Uso (sempre com o banco de PRODUÇÃO, via DATABASE_URL pública do Railway):
 *
 *   # 1. Simulação: não grava nada, só diz o que faria
 *   DATABASE_URL='postgres://...' \
 *   JWT_SECRET='<o JWT_SECRET atual>' \
 *   FISCAL_CERT_ENCRYPTION_KEY='<a chave nova>' \
 *   node scripts/migrate-cert-encryption-key.mjs
 *
 *   # 2. Aplicar de verdade
 *   ... mesmas variáveis ... node scripts/migrate-cert-encryption-key.mjs --apply
 *
 * Depois de aplicar, defina FISCAL_CERT_ENCRYPTION_KEY no Railway e faça o
 * redeploy. A ordem importa: migre primeiro, configure a variável depois.
 */
import crypto from 'crypto';
import pg from 'pg';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const aplicar = process.argv.includes('--apply');

const { DATABASE_URL, JWT_SECRET, FISCAL_CERT_ENCRYPTION_KEY, OLD_CERT_KEY } = process.env;

if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL (use a URL pública do Postgres do Railway).');
  process.exit(1);
}
if (!FISCAL_CERT_ENCRYPTION_KEY) {
  console.error('Defina FISCAL_CERT_ENCRYPTION_KEY com a chave NOVA.');
  process.exit(1);
}
// A chave antiga é a derivada do JWT_SECRET, a menos que você já usasse uma
// dedicada e esteja apenas rotacionando (aí informe OLD_CERT_KEY).
const segredoAntigo = OLD_CERT_KEY || JWT_SECRET;
if (!segredoAntigo) {
  console.error('Defina JWT_SECRET (a chave antiga é derivada dele) ou OLD_CERT_KEY.');
  process.exit(1);
}
if (segredoAntigo === FISCAL_CERT_ENCRYPTION_KEY) {
  console.error('A chave nova é igual à antiga — nada a migrar.');
  process.exit(1);
}

const chaveAntiga = crypto.createHash('sha256').update(segredoAntigo).digest();
const chaveNova = crypto.createHash('sha256').update(FISCAL_CERT_ENCRYPTION_KEY).digest();

function decifrar(payload, chave) {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, chave, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function cifrar(texto, chave) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, chave, iv);
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

/**
 * Converte um valor para a chave nova.
 * - Já legível com a chave nova: nada a fazer (script é seguro de repetir).
 * - Legível com a antiga: recifra.
 * - Ilegível com as duas: provavelmente base64 puro do formato legado — cifra.
 */
function converter(valor) {
  if (!valor) return { acao: 'vazio', valor: null };
  try {
    decifrar(valor, chaveNova);
    return { acao: 'ja-migrado', valor };
  } catch {
    // segue
  }
  try {
    return { acao: 'recifrado', valor: cifrar(decifrar(valor, chaveAntiga), chaveNova) };
  } catch {
    // segue
  }
  return { acao: 'legado-em-claro', valor: cifrar(valor, chaveNova) };
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },
});

try {
  const { rows } = await pool.query(
    `SELECT id, company_id, cnpj, password_encrypted, pfx_data
       FROM fiscal_certificates
      ORDER BY created_at`,
  );

  if (rows.length === 0) {
    console.log('Nenhum certificado cadastrado — pode definir FISCAL_CERT_ENCRYPTION_KEY');
    console.log('direto no Railway, sem migração nenhuma.');
    process.exit(0);
  }

  console.log(`${rows.length} certificado(s) encontrado(s).`);
  console.log(aplicar ? 'Modo: APLICAR\n' : 'Modo: SIMULAÇÃO (use --apply para gravar)\n');

  let falhas = 0;
  for (const row of rows) {
    const senha = converter(row.password_encrypted);
    const pfx = converter(row.pfx_data);

    // A senha é o valor crítico: sem ela a emissão para. Se não conseguimos
    // recuperá-la com nenhuma das chaves, não dá para migrar este registro.
    if (senha.acao === 'legado-em-claro' || senha.acao === 'vazio') {
      console.log(`  ${row.cnpj}  NÃO MIGRÁVEL — senha ilegível (${senha.acao}).`);
      console.log('    Recadastre o .pfx desta empresa em Captura Fiscal depois de definir a chave.');
      falhas += 1;
      continue;
    }

    console.log(`  ${row.cnpj}  senha: ${senha.acao}  |  pfx: ${pfx.acao}`);

    if (aplicar && (senha.acao === 'recifrado' || pfx.acao !== 'ja-migrado')) {
      await pool.query(
        `UPDATE fiscal_certificates
            SET password_encrypted = $1, pfx_data = $2, updated_at = now()
          WHERE id = $3`,
        [senha.valor, pfx.valor, row.id],
      );
    }
  }

  console.log('');
  if (falhas > 0) {
    console.log(`${falhas} certificado(s) precisam de recadastro manual.`);
  }
  if (!aplicar) {
    console.log('Nada foi gravado. Rode de novo com --apply quando estiver satisfeito.');
  } else {
    console.log('Migração concluída. Agora defina FISCAL_CERT_ENCRYPTION_KEY no Railway');
    console.log('e faça o redeploy. Depois teste emitir uma NF-e em homologação.');
  }
} catch (error) {
  console.error('Falha na migração:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
