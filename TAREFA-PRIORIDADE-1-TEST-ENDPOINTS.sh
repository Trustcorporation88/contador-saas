#!/bin/bash

set -euo pipefail

################################################################################
#                                                                              #
#   PRIORIDADE 1 - TESTE MANUAL DOS ENDPOINTS DE DOCUMENTOS FISCAIS           #
#                                                                              #
#   Requer: servidor disponível, token JWT válido e uma empresa selecionada    #
#                                                                              #
################################################################################

API_URL="${API_URL:-http://localhost:3000/api/v1}"
JWT_TOKEN="${JWT_TOKEN:-<substituir-token>}"
DOCUMENTO_ID=""

JSON_HEADER="Content-Type: application/json"
AUTH_HEADER="Authorization: Bearer ${JWT_TOKEN}"

print_header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

pretty_print() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

print_header "1️⃣  STATUS DA API"
curl -s -X GET "${API_URL}/status" | pretty_print

print_header "2️⃣  CRIAR DOCUMENTO"
CREATE_RESPONSE=$(curl -s -X POST \
  "${API_URL}/documentos" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "tipo": "nfe",
    "numero": "NF-1001",
    "serie": "1",
    "descricao": "Compra de material de escritório",
    "data_emissao": "2026-05-18",
    "data_vencimento": "2026-05-28",
    "contraparte_tipo": "fornecedor",
    "contraparte_cnpj": "12345678000190",
    "contraparte_nome": "Fornecedor Exemplo Ltda",
    "contraparte_email": "financeiro@fornecedor.com",
    "contraparte_telefone": "1133334444",
    "itens": [
      { "descricao": "Papel A4", "quantidade": 10, "valor_unitario": 28.90 },
      { "descricao": "Toner", "quantidade": 2, "valor_unitario": 179.90 }
    ]
  }')

echo "${CREATE_RESPONSE}" | pretty_print

if command -v jq >/dev/null 2>&1; then
  DOCUMENTO_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.data.id // empty')
fi

if [[ -z "${DOCUMENTO_ID}" ]]; then
  echo ""
  echo "Não foi possível capturar o ID automaticamente. Copie o id do response para DOCUMENTO_ID e repita os passos seguintes, se necessário."
fi

print_header "3️⃣  LISTAR DOCUMENTOS"
curl -s -X GET \
  "${API_URL}/documentos?limit=10&sort_by=created_at&sort_order=desc" \
  -H "${AUTH_HEADER}" | pretty_print

if [[ -n "${DOCUMENTO_ID}" ]]; then
  print_header "4️⃣  OBTER DOCUMENTO POR ID"
  curl -s -X GET \
    "${API_URL}/documentos/${DOCUMENTO_ID}" \
    -H "${AUTH_HEADER}" | pretty_print

  print_header "5️⃣  ATUALIZAR DOCUMENTO (RASCUNHO)"
  curl -s -X PUT \
    "${API_URL}/documentos/${DOCUMENTO_ID}" \
    -H "${JSON_HEADER}" \
    -H "${AUTH_HEADER}" \
    -d '{
      "descricao": "Compra de material de escritório - revisão 1",
      "contraparte_nome": "Fornecedor Exemplo Revisado Ltda",
      "itens": [
        { "descricao": "Papel A4", "quantidade": 12, "valor_unitario": 28.90 },
        { "descricao": "Toner", "quantidade": 2, "valor_unitario": 179.90 }
      ]
    }' | pretty_print

  print_header "6️⃣  REGISTRAR DOCUMENTO"
  curl -s -X POST \
    "${API_URL}/documentos/${DOCUMENTO_ID}/registrar" \
    -H "${AUTH_HEADER}" | pretty_print

  print_header "7️⃣  ESTATÍSTICAS"
  curl -s -X GET \
    "${API_URL}/documentos/stats/estatisticas" \
    -H "${AUTH_HEADER}" | pretty_print

  print_header "8️⃣  CANCELAR DOCUMENTO"
  curl -s -X DELETE \
    "${API_URL}/documentos/${DOCUMENTO_ID}" \
    -H "${AUTH_HEADER}" | pretty_print
else
  print_header "4️⃣ a 8️⃣  ETAPAS CONDICIONAIS"
  echo "Defina DOCUMENTO_ID para executar get/update/registrar/stats/cancelar."
fi

echo ""
echo "Teste manual concluído."