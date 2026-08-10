/**
 * Inspeção somente-leitura do Postgres legado (Railway).
 * Conta users/companies e lista empresas — NÃO altera produção.
 *
 * Uso:
 *   RAILWAY_DATABASE_PUBLIC_URL='postgresql://...' node scripts/inspect-legacy-postgres.mjs
 *
 * Aceita também DATABASE_PUBLIC_URL ou DATABASE_URL (só para esta leitura).
 * Não use a URL do Supabase aqui — o objetivo é o Postgres antigo do Railway.
 */
import pg from 'pg';

const connectionString =
  process.env.RAILWAY_DATABASE_PUBLIC_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    'Defina RAILWAY_DATABASE_PUBLIC_URL com a Public URL do Postgres Railway (contador-saas).',
  );
  process.exit(1);
}

if (/\$\{\{/.test(connectionString)) {
  console.error(
    'A URL ainda é um template (${{...}}). Reveal/copie o valor resolvido no Railway.',
  );
  process.exit(1);
}

const host = connectionString.split('@')[1]?.split('/')[0] ?? '?';
console.log(`Conectando (somente leitura) → ${host}`);

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

try {
  await client.connect();

  const tables = await client.query(
    `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY 1`,
  );
  console.log(`Tabelas public: ${tables.rows.length}`);

  for (const name of ['users', 'companies', 'company_users']) {
    const exists = await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [
      `public.${name}`,
    ]);
    if (!exists.rows[0].ok) {
      console.log(`${name}: TABELA AUSENTE`);
      continue;
    }
    const count = await client.query(`SELECT count(*)::int AS n FROM ${name}`);
    console.log(`${name}: ${count.rows[0].n}`);
  }

  const companiesExists = await client.query(
    `SELECT to_regclass('public.companies') IS NOT NULL AS ok`,
  );
  if (companiesExists.rows[0].ok) {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'companies'`,
    );
    const names = new Set(cols.rows.map((r) => r.column_name));
    const legal = names.has('legal_name')
      ? 'legal_name'
      : names.has('name')
        ? 'name'
        : 'id::text';
    const trade = names.has('trade_name') ? ', trade_name' : '';
    const created = names.has('created_at') ? 'created_at' : 'NULL';

    const rows = await client.query(
      `SELECT id, cnpj, ${legal} AS legal_name${trade}, ${created} AS created_at
         FROM companies
        ORDER BY ${created} NULLS LAST
        LIMIT 50`,
    );
    console.log('\nEmpresas (até 50):');
    console.log(JSON.stringify(rows.rows, null, 2));
  }

  const usersExists = await client.query(
    `SELECT to_regclass('public.users') IS NOT NULL AS ok`,
  );
  if (usersExists.rows[0].ok) {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'`,
    );
    const names = new Set(cols.rows.map((r) => r.column_name));
    const role = names.has('role') ? ', role' : '';
    const users = await client.query(
      `SELECT email${role}, created_at
         FROM users
        ORDER BY created_at NULLS LAST
        LIMIT 30`,
    );
    console.log('\nUsers (até 30, sem senha):');
    console.log(JSON.stringify(users.rows, null, 2));
  }

  console.log('\nOK — inspeção concluída. Produção (Supabase) não foi alterada.');
} catch (err) {
  console.error('ERRO:', err.message);
  if (err.code) console.error('code:', err.code);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
