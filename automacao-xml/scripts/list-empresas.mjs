import pg from 'pg';

const url =
  process.env.DATABASE_PUBLIC_URL ||
  'postgresql://postgres:QHaigBTtukAcsJDzuWdsHgwjUukKXiCA@thomas.proxy.rlwy.net:21158/railway';

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const companies = await client.query(
  `SELECT id, cnpj, legal_name, trade_name, tax_regime, state
   FROM companies WHERE is_active = true ORDER BY legal_name`,
);
let certs = { rows: [] };
try {
  certs = await client.query(
    'SELECT company_id, cnpj, uf, serpro_motor_enabled FROM fiscal_certificates WHERE active = true',
  );
} catch {
  // tabela pode não existir ainda em ambiente antigo
}
console.log(JSON.stringify({ companies: companies.rows, certs: certs.rows }, null, 2));
await client.end();
