/**
 * Importa empresas do backend Render (via API) para o PostgreSQL Railway.
 * Uso: node scripts/import-companies-from-render.mjs
 */
import pg from 'pg';

const RENDER_API = 'https://contador-backend-iy8h.onrender.com/api/v1';
const RAILWAY_DB =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL;

const LOGIN = {
  email: process.env.ADMIN_EMAIL || 'admin@procontador.com.br',
  password: process.env.ADMIN_PASSWORD || 'ProContador@2026',
};

async function login(baseUrl) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });
  if (!res.ok) {
    throw new Error(`Login falhou em ${baseUrl}: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data;
}

async function fetchCompanies(token) {
  const res = await fetch(`${RENDER_API}/companies?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Listar empresas falhou: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data || [];
}

async function main() {
  if (!RAILWAY_DB) {
    throw new Error('Defina RAILWAY_DATABASE_URL ou DATABASE_PUBLIC_URL');
  }

  console.log('→ Login Render...');
  const renderAuth = await login(RENDER_API.replace('/api/v1', '/api/v1'));
  const companies = await fetchCompanies(renderAuth.accessToken);
  console.log(`→ ${companies.length} empresa(s) no Render`);

  console.log('→ Login Railway (produção)...');
  const railwayAuth = await login('https://procontador.com.br/api/v1');
  const adminUserId = railwayAuth.user.id;

  const client = new pg.Client({
    connectionString: RAILWAY_DB,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let imported = 0;
  let skipped = 0;

  for (const c of companies) {
    if (c.cnpj === '00000000000000') {
      console.log(`  ⊘ Ignorada (bootstrap): ${c.name}`);
      skipped++;
      continue;
    }

    const row = {
      id: c.id,
      cnpj: c.cnpj,
      legal_name: c.name || c.legal_name,
      trade_name: c.trade_name || null,
      email: c.email || null,
      phone: c.phone || null,
      address: c.address || null,
      city: c.city || null,
      state: c.state || null,
      postal_code: c.postal_code || null,
      status: c.status || 'active',
      tax_regime: c.tax_regime || 'simples_nacional',
      fiscal_year_start: c.fiscal_year_start ?? 1,
      is_active: c.is_active !== false,
      created_at: c.created_at || new Date().toISOString(),
      updated_at: c.updated_at || new Date().toISOString(),
    };

    await client.query(
      `INSERT INTO companies (
        id, cnpj, legal_name, trade_name, email, phone, address, city, state,
        postal_code, status, tax_regime, fiscal_year_start, is_active, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      ON CONFLICT (id) DO UPDATE SET
        cnpj = EXCLUDED.cnpj,
        legal_name = EXCLUDED.legal_name,
        trade_name = EXCLUDED.trade_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        tax_regime = EXCLUDED.tax_regime,
        fiscal_year_start = EXCLUDED.fiscal_year_start,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at`,
      [
        row.id,
        row.cnpj,
        row.legal_name,
        row.trade_name,
        row.email,
        row.phone,
        row.address,
        row.city,
        row.state,
        row.postal_code,
        row.status,
        row.tax_regime,
        row.fiscal_year_start,
        row.is_active,
        row.created_at,
        row.updated_at,
      ],
    );

    await client.query(
      `INSERT INTO company_users (id, user_id, company_id, role, permissions, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'admin', $3, true, NOW(), NOW())
       ON CONFLICT (user_id, company_id) DO NOTHING`,
      [adminUserId, row.id, JSON.stringify(['*'])],
    );

    console.log(`  ✓ ${row.legal_name} (${row.cnpj})`);
    imported++;
  }

  await client.end();
  console.log(`\n✅ Concluído: ${imported} importada(s), ${skipped} ignorada(s)`);
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
