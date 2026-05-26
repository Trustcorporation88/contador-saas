#!/bin/bash
# =====================================================
# Bank Reconciliation API Test Script
# Tests all reconciliation endpoints
# =====================================================

# Configuration
API_URL="https://contador-saas-api.onrender.com/api/v1"
# Usar TOKEN de autenticação (deve ser configurado)
TOKEN="${1:-your-jwt-token-here}"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_test() {
  echo -e "${YELLOW}==== TEST: $1 ====${NC}"
}

print_success() {
  echo -e "${GREEN}✓ SUCCESS: $1${NC}\n"
  ((TESTS_PASSED++))
}

print_error() {
  echo -e "${RED}✗ FAILED: $1${NC}\n"
  ((TESTS_FAILED++))
}

# =====================================================
# Test Data Setup
# =====================================================

# Use company ID (deve ser configurado)
COMPANY_ID="${2:-550e8400-e29b-41d4-a716-446655440000}"

# Criar arquivo CSV de teste temporário
CSV_FILE="/tmp/test_extrato.csv"
cat > "$CSV_FILE" << 'EOF'
Data;Estabelecimento;Localidade;Moeda Origem;Valor Origem;US$;Cotacao;R$
16/03;MERCAD*ACQUEPARC02/06;;;;;;30.45
18/03;LOCITANE BUEUPARCO2/03;;;;;;77.56
18/03;MP*BANCORRADESPARCO2/02;;;;;;106.43
20/03;ZIG PARC02/02;;;;;;110.00
21/03;SEPHORA CATARIPARCO2/06;;;;;;45.71
26/03;DBM DAHYANA PARCO2/03;;;;;;235.00
27/03;ATACADAO 139 APARCO2/02;;;;;;357.49
30/03;MERCADOLIVRE*MPARCO2/03;;;;;;20.43
EOF

echo "📝 Arquivo de teste criado: $CSV_FILE"

# =====================================================
# TEST 1: Upload de Extrato
# =====================================================

print_test "POST /companies/{id}/reconciliation/upload"

UPLOAD_RESPONSE=$(curl -s -X POST \
  "$API_URL/companies/$COMPANY_ID/reconciliation/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$CSV_FILE")

UPLOAD_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$UPLOAD_ID" ]; then
  print_error "Failed to get upload ID from response"
  echo "Response: $UPLOAD_RESPONSE"
else
  print_success "Upload successful, ID: $UPLOAD_ID"
  echo "Response:"
  echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"
fi

# =====================================================
# TEST 2: Listar Uploads
# =====================================================

print_test "GET /companies/{id}/reconciliation"

LIST_RESPONSE=$(curl -s -X GET \
  "$API_URL/companies/$COMPANY_ID/reconciliation?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$LIST_RESPONSE" | grep -q "uploads"; then
  print_success "List uploads successful"
  echo "Response:"
  echo "$LIST_RESPONSE" | jq '.' 2>/dev/null || echo "$LIST_RESPONSE"
else
  print_error "Failed to list uploads"
  echo "Response: $LIST_RESPONSE"
fi

# =====================================================
# TEST 3: Obter Detalhes do Upload
# =====================================================

if [ ! -z "$UPLOAD_ID" ]; then
  print_test "GET /companies/{id}/reconciliation/{uploadId}"

  DETAILS_RESPONSE=$(curl -s -X GET \
    "$API_URL/companies/$COMPANY_ID/reconciliation/$UPLOAD_ID" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$DETAILS_RESPONSE" | grep -q "upload"; then
    print_success "Get upload details successful"
    echo "Response:"
    echo "$DETAILS_RESPONSE" | jq '.' 2>/dev/null || echo "$DETAILS_RESPONSE"
  else
    print_error "Failed to get upload details"
    echo "Response: $DETAILS_RESPONSE"
  fi

  # =====================================================
  # TEST 4: Obter Sugestões
  # =====================================================

  print_test "GET /companies/{id}/reconciliation/{uploadId}/suggestions"

  SUGGESTIONS_RESPONSE=$(curl -s -X GET \
    "$API_URL/companies/$COMPANY_ID/reconciliation/$UPLOAD_ID/suggestions?min_confidence=0.7" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$SUGGESTIONS_RESPONSE" | grep -q "suggestions"; then
    print_success "Get suggestions successful"
    echo "Response:"
    echo "$SUGGESTIONS_RESPONSE" | jq '.' 2>/dev/null || echo "$SUGGESTIONS_RESPONSE"

    # Extract suggestion IDs for execute test
    BANK_TX_ID=$(echo "$SUGGESTIONS_RESPONSE" | grep -o '"bank_transaction_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    JOURNAL_ID=$(echo "$SUGGESTIONS_RESPONSE" | grep -o '"journal_entry_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  else
    print_error "Failed to get suggestions"
    echo "Response: $SUGGESTIONS_RESPONSE"
  fi

  # =====================================================
  # TEST 5: Executar Reconciliação
  # =====================================================

  if [ ! -z "$BANK_TX_ID" ] && [ ! -z "$JOURNAL_ID" ]; then
    print_test "POST /companies/{id}/reconciliation/{uploadId}/execute"

    EXECUTE_PAYLOAD=$(cat <<EOF
{
  "accepted_suggestions": [
    {
      "bank_transaction_id": "$BANK_TX_ID",
      "journal_entry_id": "$JOURNAL_ID"
    }
  ]
}
EOF
)

    EXECUTE_RESPONSE=$(curl -s -X POST \
      "$API_URL/companies/$COMPANY_ID/reconciliation/$UPLOAD_ID/execute" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$EXECUTE_PAYLOAD")

    if echo "$EXECUTE_RESPONSE" | grep -q "reconciled"; then
      print_success "Execute reconciliation successful"
      echo "Response:"
      echo "$EXECUTE_RESPONSE" | jq '.' 2>/dev/null || echo "$EXECUTE_RESPONSE"
    else
      print_error "Failed to execute reconciliation"
      echo "Response: $EXECUTE_RESPONSE"
    fi
  else
    echo -e "${YELLOW}⊘ SKIPPED: Execute test (no suggestions found)${NC}"
  fi
else
  echo -e "${YELLOW}⊘ SKIPPED: Remaining tests (upload failed)${NC}"
fi

# =====================================================
# Cleanup
# =====================================================

rm -f "$CSV_FILE"
echo "🧹 Temporary files cleaned up"

# =====================================================
# Summary
# =====================================================

echo ""
echo "====================================="
echo "📊 TEST SUMMARY"
echo "====================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "====================================="

if [ $TESTS_FAILED -eq 0 ]; then
  exit 0
else
  exit 1
fi
