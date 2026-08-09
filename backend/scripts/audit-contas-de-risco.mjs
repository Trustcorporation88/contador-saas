/**
 * Audita a base de produção em busca de contas com senha previsível.
 *
 * Somente leitura por padrão. Com --desativar, marca as contas encontradas como
 * inativas e rebaixa o papel de 'admin' para 'user' — o papel 'admin' libera
 * qualquer empresa no middleware multi-tenant, então uma conta dessas com senha
 * conhecida vale como acesso à contabilidade de todos os clientes.
 *
 * Uso:
 *   DATABASE_URL='postgres://...' node scripts/audit-contas-de-risco.mjs
 *   DATABASE_URL='postgres://...' node scripts/audit-contas-de-risco.mjs --desativar
 */
import pg from 'pg';

const desativar = process.argv.includes('--desativar');
const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL (use a URL pública do Postgres do Railway).');
  process.exit(1);
}

/** Contas cuja senha está (ou já esteve) no código-fonte ou na documentação. */
const CONTAS_DE_RISCO = [
  { email: 'test@example.com', origem: 'seed de add_auth_tables — senha Test@123456' },
  { email: 'lucroreal@procontador.com.br', origem: 'conta demo — senha no código-fonte' },
  { email: 'lucropresumido@procontador.com.br', origem: 'conta demo — senha no código-fonte' },
  { email: 'simplesnacional@procontador.com.br', origem: 'conta demo — senha no código-fonte' },
  { email: 'mei@procontador.com.br', origem: 'conta demo — senha no código-fonte' },
  { email: 'admin@contador.dev', origem: 'ADMIN_BOOTSTRAP_EMAIL padrão' },
];

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },
});

try {
  // O schema varia entre ambientes (is_active/active, full_name/name).
  const { rows: colunas } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`,
  );
  const nomes = new Set(colunas.map((c) => c.column_name));
  const colunaAtivo = nomes.has('is_active') ? 'is_active' : 'active';
  // last_login não existe em todo ambiente; sem ela não dá para saber se a
  // conta já foi usada, mas a auditoria continua valendo.
  const colunaUltimoLogin = nomes.has('last_login') ? 'last_login' : 'NULL';

  const emails = CONTAS_DE_RISCO.map((c) => c.email);
  const { rows } = await pool.query(
    `SELECT id, email, role, ${colunaAtivo} AS ativo, ${colunaUltimoLogin} AS ultimo_login
       FROM users
      WHERE LOWER(email) = ANY($1::text[])
      ORDER BY email`,
    [emails],
  );

  console.log(`Total de usuários na base: ${(await pool.query('SELECT count(*) FROM users')).rows[0].count}`);
  console.log('');

  if (rows.length === 0) {
    console.log('Nenhuma conta de risco encontrada. Nada a fazer.');
    process.exit(0);
  }

  console.log(`${rows.length} conta(s) de risco encontrada(s):\n`);
  const preocupantes = [];
  for (const row of rows) {
    const origem = CONTAS_DE_RISCO.find((c) => c.email === row.email.toLowerCase())?.origem ?? '';
    const perigo = row.ativo === true;
    if (perigo) preocupantes.push(row);
    console.log(`  ${perigo ? '[ATIVA]  ' : '[inativa]'} ${row.email}`);
    console.log(`            papel: ${row.role}${row.role === 'admin' ? '  <- acessa TODAS as empresas' : ''}`);
    console.log(`            último login: ${row.ultimo_login ? new Date(row.ultimo_login).toISOString() : 'nunca / não registrado'}`);
    console.log(`            origem: ${origem}`);
  }

  console.log('');
  if (preocupantes.length === 0) {
    console.log('Todas já estão inativas — sem risco de login.');
    process.exit(0);
  }

  if (!desativar) {
    console.log(`${preocupantes.length} conta(s) ATIVA(S). Rode de novo com --desativar para`);
    console.log('rebaixar o papel e desativá-las, ou apague manualmente:');
    console.log('');
    console.log(`  DELETE FROM users WHERE LOWER(email) IN (${preocupantes.map((r) => `'${r.email}'`).join(', ')});`);
    process.exit(0);
  }

  const afetados = await pool.query(
    `UPDATE users SET role = 'user', ${colunaAtivo} = false, updated_at = now()
      WHERE id = ANY($1::text[])`,
    [preocupantes.map((r) => String(r.id))],
  );
  console.log(`${afetados.rowCount} conta(s) rebaixada(s) para 'user' e desativada(s).`);
  console.log('O login passa a ser recusado (o backend agora checa conta ativa).');
} catch (error) {
  console.error('Falha na auditoria:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
