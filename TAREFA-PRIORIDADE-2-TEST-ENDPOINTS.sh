#!/bin/bash

set -euo pipefail

################################################################################
#                                                                              #
#   PRIORIDADE 2 - TESTE MANUAL DOS ENDPOINTS DE DIÁRIO CONTÁBIL              #
#                                                                              #
#   Requer: API no ar, JWT válido, companyId real e contas contábeis reais     #
#                                                                              #
################################################################################

API_URL="${API_URL:-http://localhost:3000/api/v1}"
COMPANY_ID="${COMPANY_ID:-<company-id>}"
JWT_TOKEN="${JWT_TOKEN:-<jwt-token>}"
DEBIT_ACCOUNT_ID="${DEBIT_ACCOUNT_ID:-<conta-debito>}"
CREDIT_ACCOUNT_ID="${CREDIT_ACCOUNT_ID:-<conta-credito>}"

DRAFT_ID=""
POSTED_ID=""
DELETE_ID=""

JSON_HEADER="Content-Type: application/json"
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

step "1️⃣  LISTAR LANÇAMENTOS"
curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/journal-entries?page=1&limit=10" \
  -H "${AUTH_HEADER}" | pretty_print

step "2️⃣  CRIAR RASCUNHO PRINCIPAL"
CREATE_RESPONSE=$(curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/journal-entries" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d "{
    \"entry_date\": \"2026-05-18\",
    \"description\": \"Pagamento de aluguel da sede administrativa\",
    \"reference_type\": \"BOLETO\",
    \"reference_number\": \"BOL-2026-0518\",
    \"reference_issuer\": \"Imobiliária Exemplo\",
    \"lines\": [
      {
        \"account_id\": \"${DEBIT_ACCOUNT_ID}\",
        \"debit\": 4500,
        \"credit\": 0,
        \"description\": \"Despesa de aluguel\"
      },
      {
        \"account_id\": \"${CREDIT_ACCOUNT_ID}\",
        \"debit\": 0,
        \"credit\": 4500,
        \"description\": \"Saída bancária\"
      }
    ]
  }")

echo "${CREATE_RESPONSE}" | pretty_print

if command -v jq >/dev/null 2>&1; then
  DRAFT_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.id // empty')
fi

step "3️⃣  BUSCAR RASCUNHO POR ID"
if [[ -n "${DRAFT_ID}" ]]; then
  curl -s -X GET \
    "${API_URL}/companies/${COMPANY_ID}/journal-entries/${DRAFT_ID}" \
    -H "${AUTH_HEADER}" | pretty_print
else
  echo "DRAFT_ID não capturado automaticamente."
fi

step "4️⃣  ATUALIZAR RASCUNHO"
if [[ -n "${DRAFT_ID}" ]]; then
  curl -s -X PUT \
    "${API_URL}/companies/${COMPANY_ID}/journal-entries/${DRAFT_ID}" \
    -H "${JSON_HEADER}" \
    -H "${AUTH_HEADER}" \
    -d "{
      \"description\": \"Pagamento de aluguel da sede administrativa - conferido\",
      \"lines\": [
        {
          \"account_id\": \"${DEBIT_ACCOUNT_ID}\",
          \"debit\": 4600,
          \"credit\": 0,
          \"description\": \"Despesa de aluguel atualizada\"
        },
        {
          \"account_id\": \"${CREDIT_ACCOUNT_ID}\",
          \"debit\": 0,
          \"credit\": 4600,
          \"description\": \"Saída bancária atualizada\"
        }
      ]
    }" | pretty_print
else
  echo "DRAFT_ID não disponível."
fi

step "5️⃣  POSTAR RASCUNHO"
if [[ -n "${DRAFT_ID}" ]]; then
  POST_RESPONSE=$(curl -s -X POST \
    "${API_URL}/companies/${COMPANY_ID}/journal-entries/${DRAFT_ID}/post" \
    -H "${AUTH_HEADER}")

  echo "${POST_RESPONSE}" | pretty_print

  if command -v jq >/dev/null 2>&1; then
    POSTED_ID=$(echo "${POST_RESPONSE}" | jq -r '.id // empty')
  fi
else
  echo "DRAFT_ID não disponível."
fi

step "6️⃣  ESTORNAR LANÇAMENTO POSTADO"
if [[ -n "${POSTED_ID}" ]]; then
  curl -s -X POST \
    "${API_URL}/companies/${COMPANY_ID}/journal-entries/${POSTED_ID}/reverse" \
    -H "${JSON_HEADER}" \
    -H "${AUTH_HEADER}" \
    -d '{"reverse_date":"2026-05-19"}' | pretty_print
else
  echo "POSTED_ID não disponível."
fi

step "7️⃣  CRIAR RASCUNHO DE EXCLUSÃO"
DELETE_RESPONSE=$(curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/journal-entries" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d "{
    \"entry_date\": \"2026-05-18\",
    \"description\": \"Rascunho temporário para teste de exclusão\",
    \"reference_type\": \"MANUAL\",
    \"reference_number\": \"TMP-DEL-001\",
    \"lines\": [
      {
        \"account_id\": \"${DEBIT_ACCOUNT_ID}\",
        \"debit\": 100,
        \"credit\": 0
      },
      {
        \"account_id\": \"${CREDIT_ACCOUNT_ID}\",
        \"debit\": 0,
        \"credit\": 100
      }
    ]
  }")

echo "${DELETE_RESPONSE}" | pretty_print

if command -v jq >/dev/null 2>&1; then
  DELETE_ID=$(echo "${DELETE_RESPONSE}" | jq -r '.id // empty')
fi

step "8️⃣  EXCLUIR RASCUNHO TEMPORÁRIO"
if [[ -n "${DELETE_ID}" ]]; then
  curl -s -o /dev/null -w "HTTP %{http_code}\n" -X DELETE \
    "${API_URL}/companies/${COMPANY_ID}/journal-entries/${DELETE_ID}" \
    -H "${AUTH_HEADER}"
else
  echo "DELETE_ID não disponível."
fi

step "9️⃣  LISTAR APENAS POSTADOS"
curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/journal-entries?is_posted=true&page=1&limit=10" \
  -H "${AUTH_HEADER}" | pretty_print

echo ""
echo "Teste manual do Diário concluído."