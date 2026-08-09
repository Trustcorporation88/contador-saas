/**
 * Checagem pós-deploy no Supabase: conexão, migrações, exposição via API REST,
 * contas de risco e certificados. Somente leitura.
 *
 * Uso:
 *   DATABASE_URL='<a mesma URI que está no Railway>' node scripts/verificar-supabase.mjs
 */
import pg from 'pg';

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL com a mesma URI configurada no Railway.');
  process.exit(1);
}

if (DATABASE_URL.includes('[YOUR-PASSWORD]') || DATABASE_URL.includes('YOUR-PASSWORD')) {
  console.error('A URI ainda tem o placeholder [YOUR-PASSWORD].');
  console.error('Troque pela senha real do banco (Supabase → Settings → Database).');
  process.exit(1);
}

const local = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: local ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const problemas = [];

function relatar() {
  console.log('');
  console.log('─'.repeat(70));
  if (problemas.length === 0) {
    console.log('Nada pendente. Faça o teste de fumaça com um usuário comum (não admin).');
    return;
  }
  console.log(`${problemas.length} pendência(s):`);
  problemas.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
}

try {
  const { rows: versao } = await pool.query('SELECT version()');
  console.log('CONEXÃO OK');
  console.log(`  ${versao[0].version.split(',')[0]}`);
  const host = DATABASE_URL.split('@')[1]?.split('/')[0] ?? '?';
  console.log(`  host: ${host}`);
  if (host.includes('pooler.supabase.com:6543')) {
    problemas.push(
      'Você está na porta 6543 (pooler em transaction mode), pensada para serverless. '
      + 'Para um backend que fica de pé, use 5432 (session mode).',
    );
  }
  console.log('');

  // ── Migrações ──────────────────────────────────────────────────────────────
  const { rows: temTabela } = await pool.query(
    `SELECT to_regclass('public.migrations_executed') IS NOT NULL AS existe`,
  );
  if (!temTabela[0].existe) {
    console.log('MIGRAÇÕES: nenhuma rodou ainda.');
    problemas.push(
      'A tabela migrations_executed não existe: o backend não conseguiu subir contra este banco. '
      + 'Veja o log de deploy do Railway.',
    );
  } else {
    const { rows: migracoes } = await pool.query(
      'SELECT migration_name FROM migrations_executed ORDER BY migration_name',
    );
    const { rows: tabelas } = await pool.query(
      `SELECT count(*)::int AS total FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'`,
    );
    console.log(`MIGRAÇÕES: ${migracoes.length} registrada(s), ${tabelas[0].total} tabela(s) criada(s)`);

    // Em vez de comparar com um número fixo (a numeração das migrações salta:
    // existe 017a, 019b...), confere as tabelas e colunas que a aplicação
    // realmente precisa para funcionar.
    const essenciais = ['users', 'companies', 'company_users', 'nfe', 'nfe_itens',
      'nfe_numeracao', 'fiscal_certificates', 'accounts', 'journal_entries'];
    const ausentes = [];
    for (const tabela of essenciais) {
      const { rows } = await pool.query('SELECT to_regclass($1) IS NOT NULL AS existe', [
        `public.${tabela}`,
      ]);
      if (!rows[0].existe) ausentes.push(tabela);
    }
    if (ausentes.length > 0) {
      problemas.push(`Tabelas essenciais ausentes: ${ausentes.join(', ')} — o boot falhou no meio.`);
    }

    // Colunas das migrações mais recentes: se faltarem, o deploy está com código antigo.
    for (const [tabela, coluna] of [['nfe', 'forma_pagamento'], ['nfe', 'transmitindo_em']]) {
      const { rows } = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2) AS existe`,
        [tabela, coluna],
      );
      if (!rows[0].existe) {
        problemas.push(
          `Coluna ${tabela}.${coluna} ausente — o Railway está rodando uma versão anterior do código.`,
        );
      }
    }
  }
  console.log('');

  // ── Exposição via API REST do Supabase ─────────────────────────────────────
  const { rows: semRls } = await pool.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
      ORDER BY 1`,
  );
  const { rows: temAnon } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS existe`,
  );

  if (!temAnon[0].existe) {
    console.log('API REST: role anon não existe (não parece ser um projeto Supabase).');
  } else if (semRls.length === 0) {
    console.log('API REST: todas as tabelas com RLS — nada exposto pela chave anon.');
  } else {
    console.log(`API REST: ${semRls.length} tabela(s) SEM row level security`);
    console.log(`  ${semRls.slice(0, 8).map((r) => r.relname).join(', ')}${semRls.length > 8 ? ', ...' : ''}`);
    problemas.push(
      `${semRls.length} tabela(s) legíveis pela chave anon (que é pública). `
      + 'Rode scripts/supabase-blindar-tabelas.sql no SQL Editor do Supabase.',
    );
  }
  console.log('');

  // ── Contas de risco ────────────────────────────────────────────────────────
  const { rows: colunas } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`,
  );
  if (colunas.length === 0) {
    console.log('USUÁRIOS: tabela users não existe — sem o que conferir.');
    relatar();
    process.exit(problemas.length === 0 ? 0 : 0);
  }
  const colunaAtivo = colunas.some((c) => c.column_name === 'is_active') ? 'is_active' : 'active';
  const { rows: risco } = await pool.query(
    `SELECT email, role, ${colunaAtivo} AS ativo FROM users
      WHERE LOWER(email) = ANY($1::text[]) AND ${colunaAtivo} = true`,
    [[
      'test@example.com',
      'lucroreal@procontador.com.br',
      'lucropresumido@procontador.com.br',
      'simplesnacional@procontador.com.br',
      'mei@procontador.com.br',
      'admin@contador.dev',
    ]],
  );
  const { rows: totalUsuarios } = await pool.query('SELECT count(*)::int AS total FROM users');
  console.log(`USUÁRIOS: ${totalUsuarios[0].total} no total, ${risco.length} conta(s) de risco ativa(s)`);
  if (risco.length > 0) {
    for (const r of risco) console.log(`  ATIVA: ${r.email} (${r.role})`);
    problemas.push(
      `${risco.length} conta(s) com senha previsível ativa(s). `
      + 'Rode scripts/audit-contas-de-risco.mjs --desativar.',
    );
  }
  if (totalUsuarios[0].total === 0) {
    problemas.push(
      'Nenhum usuário na base: /api/v1/setup fica aberto. Defina ADMIN_BOOTSTRAP_PASSWORD '
      + 'no Railway e reinicie, ou defina SETUP_TOKEN para usar o setup com segurança.',
    );
  }
  console.log('');

  // ── Certificados (decide se precisa migrar a chave de criptografia) ────────
  const { rows: temCerts } = await pool.query(
    `SELECT to_regclass('public.fiscal_certificates') IS NOT NULL AS existe`,
  );
  if (temCerts[0].existe) {
    const { rows: certs } = await pool.query('SELECT count(*)::int AS total FROM fiscal_certificates');
    console.log(`CERTIFICADOS A1: ${certs[0].total}`);
    console.log(certs[0].total === 0
      ? '  Pode definir FISCAL_CERT_ENCRYPTION_KEY direto no Railway, sem migração.'
      : '  Migre com scripts/migrate-cert-encryption-key.mjs ANTES de definir a chave.');
  }

  relatar();
} catch (error) {
  console.error('FALHA NA CONEXÃO:', error.message);
  const dica = {
    ENOTFOUND: 'Host não encontrado — confira se copiou a URI inteira do Supabase.',
    ETIMEDOUT: 'Timeout. Se estiver usando db.<ref>.supabase.co, esse host é só IPv6; use o pooler.',
    ENETUNREACH: 'Rede inalcançável — típico de host só IPv6. Use o host pooler.supabase.com.',
    '28P01': 'Senha recusada. Se a senha tem @ : / # ou ?, ela precisa vir codificada na URI.',
  }[error.code] || (/password/i.test(error.message)
    ? 'Senha recusada. Confira a senha do banco e a codificação de caracteres especiais.'
    : null);
  if (dica) console.error(dica);
  process.exitCode = 1;
} finally {
  await pool.end();
}
