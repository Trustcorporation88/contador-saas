#!/bin/bash

set -euo pipefail

################################################################################
#                                                                              #
#   PRIORIDADE 3 - TESTE MANUAL DOS ENDPOINTS DE CONTAS A RECEBER             #
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

step "1️⃣  CRIAR TÍTULO A RECEBER"
CREATE_RESPONSE=$(curl -s -X POST \
  "${API_URL}/contas-receber" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "categoria": "boleto",
    "numero_titulo": "BOL-AR-2026-001",
    "descricao": "Venda faturada para Cliente Exemplo",
    "cliente_nome": "Cliente Exemplo Ltda",
    "cliente_cnpj": "12345678000190",
    "cliente_email": "financeiro@clienteexemplo.com",
    "cliente_telefone": "11999990000",
    "data_emissao": "2026-05-18",
    "data_vencimento": "2026-06-02",
    "valor_original": 8500,
    "juros": 50,
    "multa": 25,
    "desconto": 0,
    "observacoes": "Cobrança referente ao contrato mensal"
  }')

echo "${CREATE_RESPONSE}" | pretty_print

if command -v jq >/dev/null 2>&1; then
  CONTA_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.data.id // empty')
fi

step "2️⃣  LISTAR TÍTULOS"
curl -s -X GET \
  "${API_URL}/contas-receber?limit=10&sort_by=data_vencimento&sort_order=asc" \
  -H "${AUTH_HEADER}" | pretty_print

if [[ -n "${CONTA_ID}" ]]; then
  step "3️⃣  OBTER TÍTULO POR ID"
  curl -s -X GET \
    "${API_URL}/contas-receber/${CONTA_ID}" \
    -H "${AUTH_HEADER}" | pretty_print

  step "4️⃣  ATUALIZAR TÍTULO"
  curl -s -X PUT \
    "${API_URL}/contas-receber/${CONTA_ID}" \
    -H "${JSON_HEADER}" \
    -H "${AUTH_HEADER}" \
    -d '{
      "descricao": "Venda faturada para Cliente Exemplo - revisada",
      "valor_original": 8700,
      "observacoes": "Título ajustado após conferência comercial"
    }' | pretty_print

  step "5️⃣  REGISTRAR RECEBIMENTO PARCIAL"
  curl -s -X POST \
    "${API_URL}/contas-receber/${CONTA_ID}/recebimentos" \
    -H "${JSON_HEADER}" \
    -H "${AUTH_HEADER}" \
    -d '{
      "data_recebimento": "2026-05-20",
      "valor_recebido": 5000,
      "juros": 0,
      "multa": 0,
      "desconto": 0,
      "forma_recebimento": "pix",
      "observacoes": "Entrada parcial negociada com o cliente"
    }' | pretty_print

  step "6️⃣  CONSULTAR ESTATÍSTICAS"
  curl -s -X GET \
    "${API_URL}/contas-receber/stats/estatisticas" \
    -H "${AUTH_HEADER}" | pretty_print

  step "7️⃣  CANCELAR TÍTULO"
  curl -s -X DELETE \
    "${API_URL}/contas-receber/${CONTA_ID}" \
    -H "${AUTH_HEADER}" | pretty_print
else
  step "3️⃣ a 7️⃣  ETAPAS CONDICIONAIS"
  echo "Defina CONTA_ID para seguir com detalhe, atualização, recebimento, estatísticas e cancelamento."
fi

echo ""
echo "Teste manual de Contas a Receber concluído."