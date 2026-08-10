/**
 * Conta usuários/empresas num Postgres legado (ex.: o Postgres do Railway que o
 * contador-api usava antes de mudar para o Supabase) sem alterar nada.
 *
 * Isso substitui o one-liner de PowerShell usado para checar manualmente se as
 * empresas antigas ainda existem num banco fora de uso — mesma consulta, mas com
 * mensagens de erro traduzidas e sem precisar montar o comando na mão toda vez.
 *
 * Uso:
 *   DATABASE_URL='postgresql://postgres:SENHA@xxx.railway.app:PORTA/railway' \
 *     node scripts/contar-empresas-legado.mjs
 *
 * No Railway: Postgres → Variables → DATABASE_PUBLIC_URL (Reveal), ou
 * Postgres → aba Connect → Public URL. Não é o template ${{PGUSER}}...; precisa
 * ser a URL já resolvida, com host tipo *.railway.app.
 *
 * Este script só faz SELECT. Não muda a DATABASE_URL de nenhum serviço em
 * produção — é só para inspecionar o banco antigo antes de decidir migrar algo.
 */
import pg from 'pg';

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL com a URL pública do Postgres legado (Railway → Connect → Public URL).');
  process.exit(1);
}

if (/\$\{\{|YOUR-PASSWORD/.test(DATABASE_URL)) {
  console.error('A URL ainda tem um placeholder (ex.: ${{PGUSER}}... ou [YOUR-PASSWORD]).');
  console.error('Copie o valor já resolvido em Postgres → Variables → DATABASE_PUBLIC_URL → Reveal.');
  process.exit(1);
}

const local = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: local ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  const host = DATABASE_URL.split('@')[1]?.split('/')[0] ?? '?';
  await pool.query('SELECT 1');
  console.log('CONEXÃO OK');
  console.log(`  host: ${host}`);
  console.log('');

  const { rows: tabelas } = await pool.query(
    `SELECT to_regclass('public.users') IS NOT NULL AS tem_users,
            to_regclass('public.companies') IS NOT NULL AS tem_companies,
            to_regclass('public.company_users') IS NOT NULL AS tem_company_users`,
  );
  const { tem_users: temUsers, tem_companies: temCompanies, tem_company_users: temCompanyUsers } = tabelas[0];

  if (!temUsers && !temCompanies) {
    console.log('Nenhuma tabela users/companies encontrada neste banco.');
    console.log('Ou o banco está vazio, ou este não é o Postgres que a aplicação usava.');
    process.exit(0);
  }

  if (temUsers) {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
    console.log(`USUÁRIOS: ${rows[0].n}`);
  } else {
    console.log('USUÁRIOS: tabela "users" não existe neste banco.');
  }

  if (!temCompanies) {
    console.log('EMPRESAS: tabela "companies" não existe neste banco.');
    process.exit(0);
  }

  const { rows: totalEmpresas } = await pool.query('SELECT count(*)::int AS n FROM companies');
  console.log(`EMPRESAS: ${totalEmpresas[0].n}`);
  console.log('');

  if (totalEmpresas[0].n === 0) {
    console.log('Nenhuma empresa neste banco — não é aqui que os dados antigos estão.');
    process.exit(0);
  }

  // O nome da coluna varia entre versões do schema (name vs. legal_name,
  // zip_code vs. postal_code), então detecta antes de montar a consulta.
  const { rows: colunas } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'`,
  );
  const nomes = new Set(colunas.map((c) => c.column_name));
  const colunaNome = nomes.has('legal_name') ? 'legal_name' : (nomes.has('name') ? 'name' : null);
  const colunaCriadoEm = nomes.has('created_at') ? 'created_at' : null;

  const selectNome = colunaNome ? colunaNome : `'(sem coluna de nome)'`;
  const orderBy = colunaCriadoEm ? `ORDER BY ${colunaCriadoEm} NULLS LAST` : '';

  const { rows: empresas } = await pool.query(
    `SELECT ${selectNome} AS nome, cnpj${colunaCriadoEm ? `, ${colunaCriadoEm} AS criado_em` : ''}
       FROM companies
      ${orderBy}
      LIMIT 20`,
  );
  console.log(`Primeiras ${empresas.length} empresa(s) (de ${totalEmpresas[0].n}):`);
  for (const e of empresas) {
    const data = e.criado_em ? new Date(e.criado_em).toISOString().slice(0, 10) : '?';
    console.log(`  - ${e.nome ?? '(sem nome)'}  CNPJ ${e.cnpj}  (${data})`);
  }

  if (temCompanyUsers) {
    const { rows: vinc } = await pool.query('SELECT count(*)::int AS n FROM company_users');
    console.log('');
    console.log(`VÍNCULOS company_users: ${vinc[0].n}`);
  }

  console.log('');
  console.log('Achou dados? Próximo passo: migrar-empresas-legado-supabase.mjs (dry-run por padrão).');
} catch (error) {
  console.error('FALHA NA CONEXÃO OU CONSULTA:', error.message);
  const dica = {
    ENOTFOUND: 'Host não encontrado — confira se copiou a URL pública inteira (com *.railway.app).',
    ETIMEDOUT: 'Timeout ao conectar — confira se é a URL PÚBLICA (não a interna .railway.internal).',
    ENETUNREACH: 'Rede inalcançável — provável URL interna do Railway; use a Public URL.',
    '28P01': 'Senha recusada. Copie de novo o valor resolvido de DATABASE_PUBLIC_URL.',
    '3D000': 'Banco (database) não existe nesse servidor — confira o nome depois da última barra na URL.',
    '42P01': 'Tabela não existe — o schema deste banco é diferente do esperado, ou está vazio.',
  }[error.code] || (/password/i.test(error.message)
    ? 'Senha recusada. Confira se copiou o valor já resolvido (sem colchetes/placeholders).'
    : null);
  if (dica) console.error(dica);
  process.exitCode = 1;
} finally {
  await pool.end();
}
