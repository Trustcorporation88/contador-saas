/**
 * Script de teste da API — O Contador
 * Testa todos os módulos principais em sequência
 */

const BASE = "http://localhost:3000/api/v1";

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

function ok(status) {
  return status >= 200 && status < 300;
}
function log(emoji, label, status, extra) {
  const mark = ok(status) ? "✅" : "❌";
  console.log(
    `${mark} ${emoji} ${label.padEnd(40)} HTTP ${status}${extra ? " — " + extra : ""}`,
  );
}

async function run() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TESTE DE API — O Contador");
  console.log("═══════════════════════════════════════════════\n");

  // ── 1. AUTH ─────────────────────────────────────────────
  console.log("── AUTH ─────────────────────────────────────────");
  const login = await req("POST", "/auth/login", {
    email: "admin@contador.dev",
    password: "Admin@123456",
  });
  log("🔐", "Login", login.status);
  if (!ok(login.status)) {
    console.log("   ERRO:", login.body);
    return;
  }

  const TOKEN = login.body.data.accessToken;
  const me = await req("GET", "/auth/me", null, TOKEN);
  log("👤", "Auth /me", me.status, me.body?.data?.email);

  // ── 2. COMPANIES ─────────────────────────────────────────
  console.log("\n── COMPANIES ────────────────────────────────────");
  const companies = await req("GET", "/companies", null, TOKEN);
  log(
    "🏢",
    "Listar empresas",
    companies.status,
    `total=${companies.body?.pagination?.total ?? companies.body?.data?.length}`,
  );

  const techsol = companies.body?.data?.find(
    (c) => c.cnpj === "12345678000195",
  );
  const COMPANY_ID = techsol?.id;
  log(
    "🏢",
    "TechSol encontrada",
    COMPANY_ID ? 200 : 404,
    COMPANY_ID ? techsol.legal_name : "NÃO ENCONTRADA",
  );

  if (!COMPANY_ID) {
    console.log("   Abortando — empresa de teste não encontrada");
    return;
  }

  const companyDetail = await req(
    "GET",
    `/companies/${COMPANY_ID}`,
    null,
    TOKEN,
  );
  log("🏢", "Detalhe da empresa", companyDetail.status);

  const companyStats = await req(
    "GET",
    `/companies/${COMPANY_ID}/stats`,
    null,
    TOKEN,
  );
  log("📊", "Stats da empresa", companyStats.status);

  // ── 3. PLANO DE CONTAS ────────────────────────────────────
  console.log("\n── PLANO DE CONTAS ──────────────────────────────");
  const accounts = await req(
    "GET",
    `/companies/${COMPANY_ID}/accounts`,
    null,
    TOKEN,
  );
  log(
    "📒",
    "Listar contas",
    accounts.status,
    `total=${accounts.body?.data?.length ?? accounts.body?.length}`,
  );

  const hierarchy = await req(
    "GET",
    `/companies/${COMPANY_ID}/accounts/hierarchy`,
    null,
    TOKEN,
  );
  log(
    "🌳",
    "Hierarquia de contas",
    hierarchy.status,
    `raízes=${hierarchy.body?.data?.length}`,
  );

  // ── 4. LANÇAMENTOS ────────────────────────────────────────
  console.log("\n── LANÇAMENTOS ──────────────────────────────────");
  const journals = await req(
    "GET",
    `/companies/${COMPANY_ID}/journal-entries`,
    null,
    TOKEN,
  );
  log(
    "📝",
    "Listar lançamentos",
    journals.status,
    `total=${journals.body?.pagination?.total ?? journals.body?.data?.length}`,
  );

  const firstEntry = journals.body?.data?.[0];
  if (firstEntry) {
    const journalDetail = await req(
      "GET",
      `/companies/${COMPANY_ID}/journal-entries/${firstEntry.id}`,
      null,
      TOKEN,
    );
    log(
      "📝",
      "Detalhe do lançamento",
      journalDetail.status,
      firstEntry.description?.substring(0, 30),
    );
  }

  // ── 5. RELATÓRIOS ─────────────────────────────────────────
  console.log("\n── RELATÓRIOS ───────────────────────────────────");
  const balanco = await req(
    "GET",
    `/companies/${COMPANY_ID}/reports/balance-sheet?date_to=2026-05-31`,
    null,
    TOKEN,
  );
  log("⚖️ ", "Balanço Patrimonial", balanco.status);

  const dre = await req(
    "GET",
    `/companies/${COMPANY_ID}/reports/income-statement?date_from=2026-05-01&date_to=2026-05-31`,
    null,
    TOKEN,
  );
  log("📈", "DRE", dre.status);

  const trialBalance = await req(
    "GET",
    `/companies/${COMPANY_ID}/reports/trial-balance`,
    null,
    TOKEN,
  );
  log("🧾", "Balancete", trialBalance.status);

  const executiveSummary = await req(
    "GET",
    `/companies/${COMPANY_ID}/reports/executive-summary?date_from=2026-05-01&date_to=2026-05-31`,
    null,
    TOKEN,
  );
  log("📊", "Resumo executivo", executiveSummary.status);

  const cashflow = await req(
    "GET",
    `/companies/${COMPANY_ID}/reports/cash-flow-summary`,
    null,
    TOKEN,
  );
  log("💰", "Fluxo de caixa", cashflow.status);

  const clientMonthly = await req(
    "GET",
    `/companies/${COMPANY_ID}/reports/client-summary/monthly?period=2026-05`,
    null,
    TOKEN,
  );
  log("👥", "Resumo cliente mensal", clientMonthly.status);

  // ── 6. IMPOSTOS ───────────────────────────────────────────
  console.log("\n── IMPOSTOS ─────────────────────────────────────");
  const taxCalc = await req(
    "POST",
    `/companies/${COMPANY_ID}/taxes/calculate`,
    {
      tax_regime: "SIMPLES",
      period_start: "2026-05-01",
      period_end: "2026-05-31",
      rbt12: 28000,
    },
    TOKEN,
  );
  log("🧮", "Cálculo de impostos", taxCalc.status);

  const appraisals = await req(
    "GET",
    `/companies/${COMPANY_ID}/taxes/appraisal`,
    null,
    TOKEN,
  );
  log("📋", "Listar apurações", appraisals.status);

  // ── 7. CONTAS A RECEBER / PAGAR ───────────────────────────
  console.log("\n── CONTAS A RECEBER / PAGAR ─────────────────────");
  const cr = await req("GET", "/contas-receber", null, TOKEN);
  log(
    "💵",
    "Contas a receber",
    cr.status,
    `total=${cr.body?.pagination?.total ?? cr.body?.data?.length}`,
  );

  const crStats = await req(
    "GET",
    "/contas-receber/stats/estatisticas",
    null,
    TOKEN,
  );
  log("📊", "Stats contas a receber", crStats.status);

  const cp = await req("GET", "/contas-pagar", null, TOKEN);
  log(
    "💸",
    "Contas a pagar",
    cp.status,
    `total=${cp.body?.pagination?.total ?? cp.body?.data?.length}`,
  );

  const cpStats = await req(
    "GET",
    "/contas-pagar/stats/estatisticas",
    null,
    TOKEN,
  );
  log("📊", "Stats contas a pagar", cpStats.status);

  // ── 8. DOCUMENTOS FISCAIS ─────────────────────────────────
  console.log("\n── DOCUMENTOS FISCAIS ───────────────────────────");
  const docs = await req("GET", "/documentos", null, TOKEN);
  log(
    "📄",
    "Listar documentos fiscais",
    docs.status,
    `total=${docs.body?.pagination?.total ?? docs.body?.data?.length}`,
  );

  const docStats = await req(
    "GET",
    "/documentos/stats/estatisticas",
    null,
    TOKEN,
  );
  log("📊", "Stats documentos fiscais", docStats.status);

  // ── 9. AUDITORIA ──────────────────────────────────────────
  console.log("\n── AUDITORIA ────────────────────────────────────");
  const auditStats = await req("GET", "/audit/stats", null, TOKEN);
  log("🔍", "Stats de auditoria", auditStats.status);

  const auditLogs = await req("GET", "/audit/logs", null, TOKEN);
  log("📋", "Logs de auditoria", auditLogs.status);

  // ── 10. HEALTH ────────────────────────────────────────────
  console.log("\n── HEALTH ───────────────────────────────────────");
  const health = await req("GET", "/health", null, TOKEN);
  log("🏥", "Health geral", health.status, health.body?.status);

  const healthCache = await req("GET", "/health/cache", null, TOKEN);
  log(
    "📦",
    "Health Redis/cache",
    healthCache.status,
    `connected=${healthCache.body?.redis?.connected}`,
  );

  const healthDb = await req("GET", "/health/database", null, TOKEN);
  log(
    "🗄️ ",
    "Health banco de dados",
    healthDb.status,
    `connected=${healthDb.body?.database?.connected ?? healthDb.body?.connected}`,
  );

  // ── 11. COPILOTO ──────────────────────────────────────────
  console.log("\n── COPILOTO ─────────────────────────────────────");
  const copiloStatus = await req("GET", "/copiloto/status", null, TOKEN);
  log(
    "🤖",
    "Copiloto status",
    copiloStatus.status,
    `engine=${copiloStatus.body?.engine}`,
  );

  // ── RESUMO ────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  FIM DOS TESTES");
  console.log("═══════════════════════════════════════════════\n");

  // Detalha erros nos relatórios se houver
  if (!ok(balanco.status))
    console.log(
      "  Balanço erro:",
      JSON.stringify(balanco.body).substring(0, 200),
    );
  if (!ok(dre.status))
    console.log("  DRE erro:", JSON.stringify(dre.body).substring(0, 200));
  if (!ok(taxCalc.status))
    console.log(
      "  Imposto erro:",
      JSON.stringify(taxCalc.body).substring(0, 200),
    );
}

run().catch(console.error);
