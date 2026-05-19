#!/bin/bash

set -euo pipefail

################################################################################
#                                                                              #
#   PRIORIDADE 4 - TESTE MANUAL DOS ENDPOINTS DE CONTAS A PAGAR               #
#                                                                              #
#   Requer: API no ar, JWT válido e empresa autenticada                        #
#                                                                              #
################################################################################

API_URL="${API_URL:-http://localhost:3000/api/v1}"
JWT_TOKEN="${JWT_TOKEN:-<jwt-token>}"
CONTA_ID=""

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

step "1️⃣  CRIAR CONTA A PAGAR"
CREATE_RESPONSE=$(curl -s -X POST \
  "${API_URL}/contas-pagar" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "categoria": "fornecedor",
    "numero_titulo": "FORN-AP-2026-001",
    "descricao": "Boleto de fornecedor de insumos",
    "fornecedor_nome": "Insumos Brasil Ltda",
    "fornecedor_cnpj": "12345678000190",
    "fornecedor_email": "financeiro@insumosbrasil.com",
    "fornecedor_telefone": "11988887777",
    "data_emissao": "2026-05-18",
    "data_vencimento": "2026-05-25",
    "valor_original": 4250,
    "juros": 25,
    "multa": 10,
    "desconto": 0,
    "observacoes": "Compra mensal de insumos"
  }')

echo "${CREATE_RESPONSE}" | pretty_print

if command -v jq >/dev/null 2>&1; then
  CONTA_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.data.id // empty')
fi

step "2️⃣  LISTAR CONTAS A PAGAR"
curl -s -X GET \
  "${API_URL}/contas-pagar?limit=10&sort_by=data_vencimento&sort_order=asc" \
  -H "${AUTH_HEADER}" | pretty_print

if [[ -n "${CONTA_ID}" ]]; then
  step "3️⃣  OBTER CONTA POR ID"
  curl -s -X GET \
    "${API_URL}/contas-pagar/${CONTA_ID}" \
    -H "${AUTH_HEADER}" | pretty_print

  step "4️⃣  ATUALIZAR CONTA"
  curl -s -X PUT \
    "${API_URL}/contas-pagar/${CONTA_ID}" \
    -H "${JSON_HEADER}" \
    -H "${AUTH_HEADER}" \
    -d '{
      "descricao": "Boleto de fornecedor de insumos - revisado",
      "valor_original": 4300,
      "observacoes": "Valor ajustado após conferência de nota"
    }' | pretty_print

  step "5️⃣  REGISTRAR PAGAMENTO PARCIAL"
  curl -s -X POST \
    "${API_URL}/contas-pagar/${CONTA_ID}/pagamentos" \
    -H "${JSON_HEADER}" \
    -H "${AUTH_HEADER}" \
    -d '{
      "data_pagamento": "2026-05-20",
      "valor_pago": 2000,
      "juros": 0,
      "multa": 0,
      "desconto": 0,
      "forma_pagamento": "pix",
      "observacoes": "Pagamento parcial negociado com o fornecedor"
    }' | pretty_print

  step "6️⃣  CONSULTAR ESTATÍSTICAS"
  curl -s -X GET \
    "${API_URL}/contas-pagar/stats/estatisticas" \
    -H "${AUTH_HEADER}" | pretty_print

  step "7️⃣  CANCELAR CONTA"
  curl -s -X DELETE \
    "${API_URL}/contas-pagar/${CONTA_ID}" \
    -H "${AUTH_HEADER}" | pretty_print
else
  step "3️⃣ a 7️⃣  ETAPAS CONDICIONAIS"
  echo "Defina CONTA_ID para seguir com detalhe, atualização, pagamento, estatísticas e cancelamento."
fi

echo ""
echo "Teste manual de Contas a Pagar concluído."