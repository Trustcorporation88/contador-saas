/**
 * Passo 1 do plano de migração: contar o que existe no Postgres antigo do Railway
 * (projeto contador-saas) antes de copiar qualquer coisa para o Supabase.
 *
 * Somente leitura. Não escreve nada em lugar nenhum.
 *
 * Uso (PowerShell):
 *   cd C:\Contador-saas\contador-saas\backend
 *   $env:SOURCE_DATABASE_URL = 'cole-aqui-a-DATABASE_PUBLIC_URL-do-Railway'
 *   node scripts/contar-empresas-railway.mjs
 *
 * Também aceita DATABASE_URL / DATABASE_PUBLIC_URL / RAILWAY_DATABASE_URL como
 * fallback, para reaproveitar variáveis que você já tenha exportado.
 */
import pg from 'pg';

const SOURCE =
  process.env.SOURCE_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!SOURCE) {
  console.error('Defina SOURCE_DATABASE_URL com a DATABASE_PUBLIC_URL do Postgres do Railway.');
  console.error('Ex.: postgresql://postgres:SENHA@xxx.proxy.rlwy.net:PORTA/railway');
  process.exit(1);
}

if (/\$\{\{|YOUR-PASSWORD|SENHA@|cole-aqui/i.test(SOURCE)) {
  console.error('A URL ainda tem placeholder (${{...}}, SENHA, cole-aqui...).');
  console.error('Use o valor já resolvido: Railway → Postgres → Variables → DATABASE_PUBLIC_URL → Reveal.');
  process.exit(1);
}

const isLocal = SOURCE.includes('localhost') || SOURCE.includes('127.0.0.1');
const pool = new pg.Pool({
  connectionString: SOURCE,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

/** Retorna o conjunto de colunas de uma tabela (vazio se a tabela não existir). */
async function colunasDe(tabela) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tabela],
  );
  return new Set(rows.map((r) => r.column_name));
}

async function existe(tabela) {
  const { rows } = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS existe`, [
    `public.${tabela}`,
  ]);
  return rows[0].existe;
}

async function contar(tabela) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${tabela}`);
  return rows[0].n;
}

try {
  const { rows: versao } = await pool.query('SELECT version()');
  const host = SOURCE.split('@')[1]?.split('/')[0] ?? '?';
  console.log('CONEXÃO OK');
  console.log(`  ${versao[0].version.split(',')[0]}`);
  console.log(`  host: ${host}`);
  console.log('');

  if (!(await existe('companies'))) {
    console.log('A tabela "companies" não existe neste banco.');
    console.log('Provavelmente não é o Postgres certo — confira o projeto/serviço no Railway.');
    process.exit(0);
  }

  const totalUsers = (await existe('users')) ? await contar('users') : null;
  const totalCompanies = await contar('companies');
  console.log(`users:     ${totalUsers === null ? '(tabela ausente)' : totalUsers}`);
  console.log(`companies: ${totalCompanies}`);
  console.log('');

  if (totalCompanies === 0) {
    console.log('Nenhuma empresa neste banco. Se você esperava dados aqui, é o Postgres errado.');
    process.exit(0);
  }

  // A escolha das colunas varia entre ambientes (name/legal_name, created_at pode
  // não existir). Monta o SELECT só com o que existir, para não quebrar.
  const cols = await colunasDe('companies');
  // O nome pode estar em "name" ou "legal_name" (às vezes as duas colunas existem
  // e só uma está preenchida), então junta as que houver com COALESCE.
  const colsNome = ['legal_name', 'name', 'trade_name'].filter((c) => cols.has(c));
  const nomeExpr = colsNome.length ? `COALESCE(${colsNome.join(', ')})` : `NULL`;
  const ordena = cols.has('created_at') ? 'ORDER BY created_at NULLS LAST' : '';

  const { rows: amostra } = await pool.query(
    `SELECT ${nomeExpr} AS nome, cnpj FROM companies ${ordena} LIMIT 30`,
  );
  console.log(`Amostra (até 30 de ${totalCompanies}):`);
  for (const r of amostra) {
    console.log(`  - ${r.nome ?? '(sem nome)'} — CNPJ ${r.cnpj ?? '?'}`);
  }
  console.log('');
  console.log(`Se companies > 0, siga para o passo 2 (migrar para o Supabase):`);
  console.log('  node scripts/migrar-empresas-railway-para-supabase.mjs');
} catch (error) {
  console.error('FALHA:', error.message);
  const dica = {
    ENOTFOUND: 'Host não encontrado — confira se copiou a URL pública inteira do Railway.',
    ETIMEDOUT: 'Timeout — confirme que está usando a DATABASE_PUBLIC_URL (host .proxy.rlwy.net), não a interna.',
    ENETUNREACH: 'Rede inalcançável — use o host público do Railway, não o interno (postgres.railway.internal).',
    '28P01': 'Senha recusada. Se a senha tem @ : / # ou ?, ela precisa vir codificada na URL.',
  }[error.code];
  if (dica) console.error(dica);
  process.exitCode = 1;
} finally {
  await pool.end();
}
