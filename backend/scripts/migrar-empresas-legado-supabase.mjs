/**
 * Copia empresas (companies + vínculo em company_users) de um Postgres legado
 * (ex.: o Postgres do Railway de antes da migração para o Supabase) para o
 * banco Supabase que está em produção hoje.
 *
 * Por padrão roda em modo DRY-RUN: só mostra o que seria importado, sem
 * escrever nada. Passe --apply para gravar de verdade.
 *
 * Uso:
 *   SOURCE_DATABASE_URL='postgresql://postgres:SENHA@xxx.railway.app:PORTA/railway' \
 *   TARGET_DATABASE_URL='postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres' \
 *   ADMIN_EMAIL='voce@exemplo.com' \
 *     node scripts/migrar-empresas-legado-supabase.mjs
 *
 *   # depois de conferir a saída, para gravar de fato:
 *   ... node scripts/migrar-empresas-legado-supabase.mjs --apply
 *
 * - SOURCE_DATABASE_URL: banco antigo (Railway), só leitura.
 * - TARGET_DATABASE_URL: banco atual (Supabase). Aceita também DATABASE_URL
 *   como alias, para reaproveitar a mesma variável usada em
 *   verificar-supabase.mjs.
 * - ADMIN_EMAIL: usuário (já existente no Supabase) ao qual as empresas
 *   importadas serão associadas em company_users com papel 'admin'. Sem essa
 *   associação as empresas ficam no banco mas ninguém enxerga na aplicação
 *   (o multi-tenant filtra por company_users).
 *
 * Empresas cujo CNPJ já existe no destino são só reportadas (skip) — o script
 * nunca sobrescreve dados que já estão no Supabase.
 */
import pg from 'pg';

const apply = process.argv.includes('--apply');

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!SOURCE_DATABASE_URL) {
  console.error('Defina SOURCE_DATABASE_URL com a URL pública do Postgres legado (Railway).');
  process.exit(1);
}
if (!TARGET_DATABASE_URL) {
  console.error('Defina TARGET_DATABASE_URL (ou DATABASE_URL) com a URL do Supabase de produção.');
  process.exit(1);
}
if (!ADMIN_EMAIL) {
  console.error('Defina ADMIN_EMAIL: o usuário do Supabase ao qual as empresas importadas serão associadas.');
  process.exit(1);
}
if (SOURCE_DATABASE_URL === TARGET_DATABASE_URL) {
  console.error('SOURCE_DATABASE_URL e TARGET_DATABASE_URL são iguais — nada a migrar.');
  process.exit(1);
}
for (const [nome, url] of [['SOURCE_DATABASE_URL', SOURCE_DATABASE_URL], ['TARGET_DATABASE_URL', TARGET_DATABASE_URL]]) {
  if (/\$\{\{|YOUR-PASSWORD/.test(url)) {
    console.error(`${nome} ainda tem um placeholder não resolvido.`);
    process.exit(1);
  }
}

function clientePara(url) {
  const local = url.includes('localhost') || url.includes('127.0.0.1');
  return new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
}

const source = clientePara(SOURCE_DATABASE_URL);
const target = clientePara(TARGET_DATABASE_URL);

try {
  await source.connect();
  await target.connect();

  console.log(`Modo: ${apply ? 'APLICANDO (grava no Supabase)' : 'DRY-RUN (só leitura, nada será gravado)'}`);
  console.log('');

  const { rows: colunasOrigem } = await source.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'`,
  );
  if (colunasOrigem.length === 0) {
    console.error('Tabela "companies" não existe no banco de origem. Nada a migrar.');
    process.exitCode = 1;
    throw new Error('sem tabela companies na origem');
  }
  const nomesOrigem = new Set(colunasOrigem.map((c) => c.column_name));
  const colunaNomeOrigem = nomesOrigem.has('legal_name') ? 'legal_name' : (nomesOrigem.has('name') ? 'name' : null);
  if (!colunaNomeOrigem) {
    throw new Error('A tabela companies de origem não tem coluna "legal_name" nem "name" — schema inesperado.');
  }

  const { rows: empresasOrigem } = await source.query(
    `SELECT id, cnpj, ${colunaNomeOrigem} AS legal_name,
            ${nomesOrigem.has('trade_name') ? 'trade_name' : 'NULL'} AS trade_name,
            ${nomesOrigem.has('email') ? 'email' : 'NULL'} AS email,
            ${nomesOrigem.has('phone') ? 'phone' : 'NULL'} AS phone,
            ${nomesOrigem.has('address') ? 'address' : 'NULL'} AS address,
            ${nomesOrigem.has('city') ? 'city' : 'NULL'} AS city,
            ${nomesOrigem.has('state') ? 'state' : 'NULL'} AS state,
            ${nomesOrigem.has('postal_code') ? 'postal_code' : (nomesOrigem.has('zip_code') ? 'zip_code' : 'NULL')} AS postal_code,
            ${nomesOrigem.has('status') ? 'status' : `'active'`} AS status,
            ${nomesOrigem.has('tax_regime') ? 'tax_regime' : `'simples_nacional'`} AS tax_regime,
            ${nomesOrigem.has('is_active') ? 'is_active' : 'true'} AS is_active,
            ${nomesOrigem.has('created_at') ? 'created_at' : 'NULL'} AS created_at,
            ${nomesOrigem.has('updated_at') ? 'updated_at' : 'NULL'} AS updated_at
       FROM companies
      ORDER BY ${nomesOrigem.has('created_at') ? 'created_at NULLS LAST' : colunaNomeOrigem}`,
  );

  console.log(`Origem: ${empresasOrigem.length} empresa(s) encontrada(s).`);

  const bootstrap = empresasOrigem.filter((c) => c.cnpj === '00000000000000');
  const candidatas = empresasOrigem.filter((c) => c.cnpj !== '00000000000000');
  if (bootstrap.length > 0) {
    console.log(`  ⊘ ${bootstrap.length} ignorada(s) por serem de bootstrap (CNPJ 00000000000000).`);
  }
  console.log('');

  const { rows: adminRows } = await target.query(
    `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [ADMIN_EMAIL],
  );
  if (adminRows.length === 0) {
    throw new Error(`Usuário ${ADMIN_EMAIL} não existe no Supabase de destino. Crie a conta lá antes de migrar.`);
  }
  const adminUserId = adminRows[0].id;
  console.log(`Destino: associando empresas importadas ao usuário ${adminRows[0].email} (id ${adminUserId}).`);
  console.log('');

  let importadas = 0;
  let jaExistiam = 0;
  let vinculosNovos = 0;

  for (const c of candidatas) {
    const { rows: existentes } = await target.query('SELECT id FROM companies WHERE cnpj = $1', [c.cnpj]);

    if (existentes.length > 0) {
      jaExistiam++;
      console.log(`  = já existe no destino: ${c.legal_name} (${c.cnpj})`);
      if (apply) {
        const { rowCount } = await target.query(
          `INSERT INTO company_users (id, user_id, company_id, role, permissions, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'admin', $3, true, NOW(), NOW())
           ON CONFLICT (user_id, company_id) DO NOTHING`,
          [adminUserId, existentes[0].id, JSON.stringify(['*'])],
        );
        if (rowCount > 0) vinculosNovos++;
      }
      continue;
    }

    console.log(`  + ${apply ? 'importando' : 'importaria'}: ${c.legal_name} (${c.cnpj})`);
    importadas++;

    if (!apply) continue;

    await target.query(
      `INSERT INTO companies (
        id, cnpj, legal_name, trade_name, email, phone, address, city, state,
        postal_code, status, tax_regime, is_active, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14, NOW()),COALESCE($15, NOW())
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        c.id, c.cnpj, c.legal_name, c.trade_name, c.email, c.phone, c.address,
        c.city, c.state, c.postal_code, c.status, c.tax_regime, c.is_active,
        c.created_at, c.updated_at,
      ],
    );

    const { rowCount } = await target.query(
      `INSERT INTO company_users (id, user_id, company_id, role, permissions, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'admin', $3, true, NOW(), NOW())
       ON CONFLICT (user_id, company_id) DO NOTHING`,
      [adminUserId, c.id, JSON.stringify(['*'])],
    );
    if (rowCount > 0) vinculosNovos++;
  }

  console.log('');
  console.log(`Total: ${candidatas.length} candidata(s), ${importadas} nova(s), ${jaExistiam} já existiam, ${vinculosNovos} vínculo(s) criado(s).`);
  if (!apply) {
    console.log('');
    console.log('Nada foi gravado (dry-run). Confira a lista acima e rode de novo com --apply para gravar no Supabase.');
  }
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
