/**
 * Passo 2 do plano de migração: copiar as empresas do Postgres antigo do Railway
 * (projeto contador-saas) para o Supabase, sem tocar em produção além de inserir
 * as empresas e associá-las ao seu usuário.
 *
 * Faz tudo por conexão direta (SOURCE -> TARGET), sem passar pela API:
 *   1. Lê as colunas de "companies" nos dois bancos e monta o mapeamento
 *      (os schemas divergem entre ambientes: name/legal_name, zip_code/postal_code,
 *       fiscal_year_start_month/fiscal_year_start...).
 *   2. Faz upsert das empresas no Supabase (conflito por CNPJ quando houver índice
 *      único, senão por id), preservando o id de origem quando possível.
 *   3. Associa cada empresa ao usuário informado (company_users, papel 'admin').
 *
 * Por padrão roda em modo simulação (dry-run): NÃO escreve nada, só mostra o
 * que faria. Para gravar de verdade, passe --aplicar.
 *
 * Uso (PowerShell):
 *   cd C:\Contador-saas\contador-saas\backend
 *   $env:SOURCE_DATABASE_URL = 'DATABASE_PUBLIC_URL do Railway (banco antigo)'
 *   $env:TARGET_DATABASE_URL = 'URI do Supabase (Settings -> Database), porta 5432'
 *   $env:TARGET_USER_EMAIL   = 'voce@empresa.com.br'   # usuário que verá as empresas
 *   node scripts/migrar-empresas-railway-para-supabase.mjs            # simulação
 *   node scripts/migrar-empresas-railway-para-supabase.mjs --aplicar  # grava
 *
 * Para pular empresas de teste, liste os CNPJs (só dígitos) em EXCLUIR_CNPJS:
 *   $env:EXCLUIR_CNPJS = '11222333000181,11444777000161'
 */
import pg from 'pg';

const aplicar = process.argv.includes('--aplicar');

const SOURCE =
  process.env.SOURCE_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.RAILWAY_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
const USER_EMAIL = process.env.TARGET_USER_EMAIL;

const CNPJ_BOOTSTRAP = '00000000000000';

// CNPJs a pular além da bootstrap. Aceita EXCLUIR_CNPJS='cnpj1,cnpj2' (com ou sem
// máscara — só os dígitos são considerados).
const EXCLUIR = [
  CNPJ_BOOTSTRAP,
  ...(process.env.EXCLUIR_CNPJS || '')
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean),
];

function abortar(msg) {
  console.error(msg);
  process.exit(1);
}

if (!SOURCE) abortar('Defina SOURCE_DATABASE_URL (DATABASE_PUBLIC_URL do Postgres do Railway).');
if (!TARGET) abortar('Defina TARGET_DATABASE_URL (URI do Supabase).');
for (const [nome, url] of [['SOURCE', SOURCE], ['TARGET', TARGET]]) {
  if (/\$\{\{|YOUR-PASSWORD|SENHA@|cole-aqui/i.test(url)) {
    abortar(`A URL de ${nome} ainda tem placeholder. Use o valor real e resolvido.`);
  }
}

/**
 * Colunas de "companies" que costumam mudar de nome entre ambientes.
 * Para cada coluna de DESTINO, a primeira coluna de ORIGEM que existir é usada.
 */
const MAPA_COLUNAS = {
  legal_name: ['legal_name', 'name'],
  name: ['name', 'legal_name'],
  postal_code: ['postal_code', 'zip_code'],
  zip_code: ['zip_code', 'postal_code'],
  fiscal_year_start: ['fiscal_year_start', 'fiscal_year_start_month'],
  fiscal_year_start_month: ['fiscal_year_start_month', 'fiscal_year_start'],
};

function novaPool(url) {
  const local = url.includes('localhost') || url.includes('127.0.0.1');
  return new pg.Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

async function colunasSet(pool, tabela) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tabela],
  );
  return new Set(rows.map((r) => r.column_name));
}

async function colunasInfo(pool, tabela) {
  const { rows } = await pool.query(
    `SELECT column_name AS name,
            is_nullable,
            (column_default IS NOT NULL) AS has_default,
            data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tabela],
  );
  return rows;
}

async function existeTabela(pool, tabela) {
  const { rows } = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS existe`, [
    `public.${tabela}`,
  ]);
  return rows[0].existe;
}

/** Há índice/constraint UNIQUE de coluna única sobre (tabela.col)? */
async function temUniqueDeUmaColuna(pool, tabela, col) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE n.nspname = 'public' AND c.relname = $1
        AND i.indisunique AND i.indnkeyatts = 1 AND a.attname = $2
      LIMIT 1`,
    [tabela, col],
  );
  return rows.length > 0;
}

const source = novaPool(SOURCE);
const target = novaPool(TARGET);

try {
  console.log(aplicar ? '== MODO: APLICAR (vai gravar no Supabase) ==' : '== MODO: SIMULAÇÃO (dry-run, nada é gravado) ==');
  console.log('');

  if (!(await existeTabela(source, 'companies'))) {
    abortar('A tabela "companies" não existe na ORIGEM. Confira a SOURCE_DATABASE_URL.');
  }
  if (!(await existeTabela(target, 'companies'))) {
    abortar('A tabela "companies" não existe no DESTINO. O Supabase não está migrado?');
  }

  const colsOrigem = await colunasSet(source, 'companies');
  const colsDestino = await colunasInfo(target, 'companies');

  // Monta o plano de colunas: para cada coluna de destino, acha na origem a(s)
  // coluna(s) candidata(s) que existir(em). Quando há mais de uma (ex.: name e
  // legal_name coexistem, mas só uma está preenchida), usa COALESCE na ordem de
  // prioridade. Cada expressão vem apelidada com o nome da coluna de destino.
  const plano = [];
  for (const alvo of colsDestino) {
    const candidatas = MAPA_COLUNAS[alvo.name] || [alvo.name];
    const existentes = candidatas.filter((c) => colsOrigem.has(c));
    if (existentes.length === 0) continue;
    const expr = existentes.length > 1 ? `COALESCE(${existentes.join(', ')})` : existentes[0];
    plano.push({ alvo: alvo.name, expr, origem: existentes.join('/') });
  }

  const preenchidas = new Set(plano.map((p) => p.alvo));
  const faltandoObrigatorias = colsDestino.filter(
    (c) => !preenchidas.has(c.name) && c.is_nullable === 'NO' && !c.has_default,
  );

  console.log('Mapeamento de colunas (destino <- origem):');
  for (const p of plano) {
    console.log(`  ${p.alvo}${p.alvo === p.origem ? '' : `  <- ${p.origem}`}`);
  }
  const semMapa = colsDestino.filter((c) => !preenchidas.has(c.name)).map((c) => c.name);
  if (semMapa.length) {
    console.log(`  (não preenchidas, usarão default/null: ${semMapa.join(', ')})`);
  }
  console.log('');

  if (faltandoObrigatorias.length) {
    console.error('Colunas NOT NULL no destino sem correspondente na origem e sem default:');
    for (const c of faltandoObrigatorias) console.error(`  - ${c.name} (${c.data_type})`);
    console.error('');
    console.error('Ajuste o MAPA_COLUNAS neste script para mapear essas colunas antes de aplicar.');
    process.exit(1);
  }

  // Chave de conflito: CNPJ se houver unique de uma coluna; senão id.
  const temCnpj = colsOrigem.has('cnpj') && preenchidas.has('cnpj');
  const cnpjUnico = temCnpj && (await temUniqueDeUmaColuna(target, 'companies', 'cnpj'));
  const idUnico = preenchidas.has('id') && (await temUniqueDeUmaColuna(target, 'companies', 'id'));
  const chaveConflito = cnpjUnico ? 'cnpj' : idUnico ? 'id' : null;
  if (!chaveConflito) {
    abortar('Não achei chave única (cnpj nem id) em companies no destino para fazer upsert com segurança.');
  }
  console.log(`Chave de conflito para upsert: ${chaveConflito}`);

  // Lê as empresas da origem, pulando a bootstrap e quaisquer CNPJs de EXCLUIR.
  // Cada expressão é apelidada com o nome da coluna de destino.
  const selecaoOrigem = plano.map((p) => `${p.expr} AS "${p.alvo}"`);
  const filtro = temCnpj ? `WHERE cnpj IS NULL OR cnpj <> ALL($1::text[])` : '';
  const params = temCnpj ? [EXCLUIR] : [];
  const { rows: empresas } = await source.query(
    `SELECT ${selecaoOrigem.join(', ')} FROM companies ${filtro}`,
    params,
  );
  if (EXCLUIR.length > 1) {
    console.log(`Pulando ${EXCLUIR.length} CNPJ(s) (bootstrap + EXCLUIR_CNPJS).`);
  }
  console.log(`Empresas a migrar: ${empresas.length}`);
  console.log('');

  // Resolve o usuário de destino para a associação (opcional, mas recomendado).
  let userId = null;
  if (USER_EMAIL) {
    if (!(await existeTabela(target, 'users'))) {
      abortar('TARGET_USER_EMAIL definido, mas a tabela "users" não existe no destino.');
    }
    const { rows } = await target.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [USER_EMAIL],
    );
    if (rows.length === 0) {
      abortar(`Usuário ${USER_EMAIL} não encontrado no destino. Crie/entre com ele antes de associar.`);
    }
    userId = rows[0].id;
    console.log(`Empresas serão associadas ao usuário ${USER_EMAIL} (id ${userId}) como 'admin'.`);
  } else {
    console.log('TARGET_USER_EMAIL não definido: as empresas serão migradas SEM associação.');
    console.log('Defina TARGET_USER_EMAIL para que apareçam para o seu usuário.');
  }
  console.log('');

  if (empresas.length === 0) {
    console.log('Nada para migrar.');
    process.exit(0);
  }

  if (!aplicar) {
    console.log('Simulação concluída. Reveja o mapeamento acima e rode de novo com --aplicar.');
    console.log('Exemplo das empresas que seriam migradas:');
    const nomeCol = plano.find((p) => p.alvo === 'legal_name' || p.alvo === 'name')?.alvo;
    for (const e of empresas.slice(0, 15)) {
      const nome = nomeCol ? e[nomeCol] : '(sem nome)';
      console.log(`  - ${nome ?? '(sem nome)'} — CNPJ ${e.cnpj ?? '?'}`);
    }
    if (empresas.length > 15) console.log(`  ... e mais ${empresas.length - 15}`);
    process.exit(0);
  }

  // ── Aplicação de fato, em transação no destino ────────────────────────────
  const cuCols = (await existeTabela(target, 'company_users'))
    ? await colunasSet(target, 'company_users')
    : new Set();

  const clienteDestino = await target.connect();
  let empresasOk = 0;
  let assocOk = 0;
  try {
    await clienteDestino.query('BEGIN');

    const colunasInsert = plano.map((p) => p.alvo);
    const placeholders = colunasInsert.map((_, i) => `$${i + 1}`);
    const setUpdate = colunasInsert
      .filter((c) => c !== chaveConflito)
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(', ');
    const sqlUpsert =
      `INSERT INTO companies (${colunasInsert.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
      `ON CONFLICT (${chaveConflito}) DO UPDATE SET ${setUpdate || `${chaveConflito} = EXCLUDED.${chaveConflito}`} ` +
      `RETURNING id`;

    for (const e of empresas) {
      const valores = plano.map((p) => e[p.alvo]);
      const { rows } = await clienteDestino.query(sqlUpsert, valores);
      const companyId = rows[0].id;
      empresasOk++;

      if (userId && cuCols.size > 0) {
        const cols = ['user_id', 'company_id', 'role'];
        const vals = [userId, companyId, 'admin'];
        if (cuCols.has('permissions')) {
          cols.push('permissions');
          vals.push('{}');
        }
        if (cuCols.has('is_active')) {
          cols.push('is_active');
          vals.push(true);
        }
        if (cuCols.has('created_at')) {
          cols.push('created_at');
          vals.push(new Date());
        }
        if (cuCols.has('updated_at')) {
          cols.push('updated_at');
          vals.push(new Date());
        }
        const ph = cols.map((_, i) => `$${i + 1}`);
        const res = await clienteDestino.query(
          `INSERT INTO company_users (${cols.join(', ')}) VALUES (${ph.join(', ')})
           ON CONFLICT (user_id, company_id) DO NOTHING`,
          vals,
        );
        assocOk += res.rowCount;
      }
    }

    await clienteDestino.query('COMMIT');
  } catch (err) {
    await clienteDestino.query('ROLLBACK');
    throw err;
  } finally {
    clienteDestino.release();
  }

  console.log('');
  console.log(`✅ ${empresasOk} empresa(s) migrada(s) para o Supabase.`);
  if (userId) console.log(`✅ ${assocOk} associação(ões) nova(s) em company_users para ${USER_EMAIL}.`);
  console.log('Confira no app (produção continua no Supabase) e valide a listagem de empresas.');
} catch (error) {
  console.error('FALHA:', error.message);
  const dica = {
    ENOTFOUND: 'Host não encontrado — confira as URLs de origem e destino.',
    ETIMEDOUT: 'Timeout. No Supabase use o pooler (porta 5432 session mode) ou o host correto.',
    ENETUNREACH: 'Rede inalcançável — host só IPv6? Use o host pooler.supabase.com.',
    '28P01': 'Senha recusada. Caracteres especiais (@ : / # ?) precisam vir codificados na URL.',
    '23505': 'Violação de unicidade — pode haver CNPJ repetido com id diferente entre os bancos.',
  }[error.code];
  if (dica) console.error(dica);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
