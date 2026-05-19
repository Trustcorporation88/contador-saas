#!/bin/bash

set -euo pipefail

################################################################################
#                                                                              #
#   PRIORIDADE 5 - TESTE MANUAL DE FLUXO DE CAIXA E RELATÓRIOS BÁSICOS        #
#                                                                              #
#   Requer: API no ar, JWT válido, companyId conhecido                         #
#                                                                              #
################################################################################

API_URL="${API_URL:-http://localhost:3000/api/v1}"
JWT_TOKEN="${JWT_TOKEN:-<jwt-token>}"
COMPANY_ID="${COMPANY_ID:-<company-id>}"

AUTH_HEADER="Authorization: Bearer ${JWT_TOKEN}"

pretty_print() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

step() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

step "1️⃣  RESUMO EXECUTIVO"
curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/reports/executive-summary?date_from=2026-05-01&date_to=2026-05-31" \
  -H "${AUTH_HEADER}" | pretty_print

step "2️⃣  SÉRIE MENSAL DE FLUXO"
curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/reports/cash-flow-summary?months=12" \
  -H "${AUTH_HEADER}" | pretty_print

step "3️⃣  DRE"
curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/reports/income-statement?date_from=2026-05-01&date_to=2026-05-31" \
  -H "${AUTH_HEADER}" | pretty_print

step "4️⃣  BALANÇO PATRIMONIAL"
curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/reports/balance-sheet?date_to=2026-05-31" \
  -H "${AUTH_HEADER}" | pretty_print

step "5️⃣  EXPORTAR DRE XLSX"
curl -s -L -X GET \
  "${API_URL}/companies/${COMPANY_ID}/reports/income-statement/export?date_from=2026-05-01&date_to=2026-05-31&format=xlsx" \
  -H "${AUTH_HEADER}" \
  -o /tmp/dre-prioridade-5.xlsx

echo "Arquivo gerado em /tmp/dre-prioridade-5.xlsx"

step "6️⃣  EXPORTAR BALANÇO PDF"
curl -s -L -X GET \
  "${API_URL}/companies/${COMPANY_ID}/reports/balance-sheet/export?date_to=2026-05-31&format=pdf" \
  -H "${AUTH_HEADER}" \
  -o /tmp/balanco-prioridade-5.pdf

echo "Arquivo gerado em /tmp/balanco-prioridade-5.pdf"

echo ""
echo "Teste manual da Prioridade 5 concluído."