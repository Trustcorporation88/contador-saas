#!/bin/bash
# OCR NF-e — Test Cases (cURL examples)
# Execute these commands to test the OCR API endpoints

# ============================================================================
# SETUP: Set your credentials
# ============================================================================
API_URL="http://localhost:3000/api/v1"
TOKEN="your-jwt-token-here"
COMPANY_ID="your-company-uuid-here"

# ============================================================================
# 1. UPLOAD NF-e (PDF or Image)
# ============================================================================
echo "🔹 Test 1: Upload NF-e File"
echo "Uploading NF-e PDF for OCR extraction..."

UPLOAD_RESPONSE=$(curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/upload" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@nfe_sample.pdf")

echo "Response:"
echo "$UPLOAD_RESPONSE" | jq .

# Extract upload ID from response
UPLOAD_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')
echo "Upload ID: $UPLOAD_ID"

# ============================================================================
# 2. GET UPLOAD DATA
# ============================================================================
echo ""
echo "🔹 Test 2: Get Upload Data"
echo "Retrieving OCR extraction data..."

curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/${UPLOAD_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq .

# ============================================================================
# 3. GET JOURNAL ENTRY PREVIEW
# ============================================================================
echo ""
echo "🔹 Test 3: Generate Journal Entry Preview"
echo "Generating preview with suggested accounts..."

PREVIEW_RESPONSE=$(curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/${UPLOAD_ID}/preview" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response:"
echo "$PREVIEW_RESPONSE" | jq .

# ============================================================================
# 4. CONFIRM AND CREATE JOURNAL ENTRY (no adjustments)
# ============================================================================
echo ""
echo "🔹 Test 4: Confirm OCR and Create Journal Entry (Default Accounts)"
echo "Creating journal entry with suggested accounts..."

CONFIRM_RESPONSE=$(curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/${UPLOAD_ID}/confirm" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Response:"
echo "$CONFIRM_RESPONSE" | jq .

JOURNAL_ENTRY_ID=$(echo "$CONFIRM_RESPONSE" | jq -r '.journal_entry_id')
echo "Journal Entry ID: $JOURNAL_ENTRY_ID"

# ============================================================================
# 5. CONFIRM WITH ACCOUNT ADJUSTMENTS
# ============================================================================
echo ""
echo "🔹 Test 5: Confirm OCR with Custom Accounts"
echo "Creating journal entry with adjusted accounts..."

curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/${UPLOAD_ID}/confirm" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustments": {
      "debit_account": "1.1.2.2",
      "credit_account": "2.1.1.2"
    },
    "labels": ["urgent", "supplier-xyz"]
  }' | jq .

# ============================================================================
# 6. VALIDATE NF-e KEY WITH SEFAZ
# ============================================================================
echo ""
echo "🔹 Test 6: Validate NF-e Key with SEFAZ"
echo "Validating 44-digit invoice key..."

# Sample valid-format key (for testing)
INVOICE_KEY="35220310000011223456789012345678901234567890"

curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/${INVOICE_KEY}/validate" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq .

# ============================================================================
# 7. VALIDATE INVALID KEY
# ============================================================================
echo ""
echo "🔹 Test 7: Validate Invalid NF-e Key"
echo "Testing with invalid key (too short)..."

INVALID_KEY="35220310000011223456789012345678901234"

curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/${INVALID_KEY}/validate" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq .

# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

echo ""
echo "🔹 Test 8: Upload Without File (Error Case)"
echo "Testing error handling for missing file..."

curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/upload" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq .

echo ""
echo "🔹 Test 9: Upload Unsupported File Type (Error Case)"
echo "Testing error handling for unsupported file type..."

echo "test content" > test.txt
curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/upload" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@test.txt" \
  | jq .
rm test.txt

echo ""
echo "🔹 Test 10: Get Non-existent Upload (Error Case)"
echo "Testing 404 error for non-existent upload..."

curl -s -X GET \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq .

# ============================================================================
# PERFORMANCE TESTING
# ============================================================================

echo ""
echo "🔹 Performance Test: Measure OCR Extraction Time"
echo "Uploading file and measuring response time..."

time curl -s -X POST \
  "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/upload" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@nfe_sample.pdf" \
  -o /dev/null -w "\nHTTP Status: %{http_code}\nTime Total: %{time_total}s\n"

# ============================================================================
# BATCH TESTING (multiple files)
# ============================================================================

echo ""
echo "🔹 Batch Test: Upload Multiple NF-e Files"
echo "Testing batch OCR processing..."

for i in {1..3}; do
  echo "Processing file $i..."
  curl -s -X POST \
    "${API_URL}/companies/${COMPANY_ID}/nfe/ocr/upload" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "file=@nfe_sample_${i}.pdf" \
    | jq '.id'
  
  sleep 1  # Rate limiting
done

# ============================================================================
# USAGE NOTES
# ============================================================================

: << 'NOTES'
SETUP INSTRUCTIONS:

1. Get your JWT token:
   POST /auth/login
   Body: { "email": "user@company.com", "password": "..." }
   Response: { "token": "eyJhbGc..." }

2. Get your Company ID:
   GET /companies
   Response: { "data": [{ "id": "uuid", "name": "..." }] }

3. Prepare test files:
   - nfe_sample.pdf (PDF of invoice)
   - nfe_sample_1.pdf, nfe_sample_2.pdf, nfe_sample_3.pdf (batch test)

4. Update variables in this script:
   - TOKEN=your-jwt-token
   - COMPANY_ID=your-company-id

5. Run this script:
   chmod +x ocr-nfe-test.sh
   ./ocr-nfe-test.sh

EXPECTED RESPONSES:

✅ Upload (201):
{
  "id": "uuid",
  "status": "extracted",
  "extraction_confidence": 0.92,
  "ocr_data": {
    "nf_number": "123456",
    "invoice_key": "352203...",
    "total_value": 1500.00,
    ...
  }
}

✅ Preview (200):
{
  "nf_number": "123456",
  "type": "entrada",
  "suggested_entries": [
    { "account_code": "1.1.2.1", "debit": 1500 },
    { "account_code": "2.1.1.1", "credit": 1500 }
  ]
}

✅ Confirm (201):
{
  "journal_entry_id": "uuid",
  "nfe_status": "processed"
}

✅ Validate (200):
{
  "status": "valid",
  "invoice_key": "352203...",
  "issuer_cnpj": "10000000000100"
}

❌ Error (400):
{
  "error": "Arquivo não fornecido",
  "details": "Faça upload de um PDF ou imagem de NF-e"
}

CONFIDENCE SCORES:
- 0.9-1.0: Excellent (use as-is)
- 0.7-0.9: Good (verify key fields)
- 0.6-0.7: Fair (manual review recommended)
- <0.6: Poor (error status, needs manual entry)

SUPPORTED FILE TYPES:
- application/pdf
- image/jpeg
- image/png
- image/tiff

MAX FILE SIZE: 50MB

NOTES

echo ""
echo "✅ All tests completed!"
echo "Check responses above for errors"
