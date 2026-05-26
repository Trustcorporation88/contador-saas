#!/bin/bash

# EFD API Test Script
# Tests all EFD endpoints with sample data
# Usage: bash test-efd-endpoints.sh

set -e

# Configuration
API_BASE="http://localhost:3000/api/v1"
TOKEN="${AUTH_TOKEN:-your-jwt-token-here}"
COMPANY_ID="${COMPANY_ID:-550e8400-e29b-41d4-a716-446655440000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_header() {
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Test 1: Get available months for EFD
test_get_available_months() {
    print_header "Test 1: GET /companies/{companyId}/efd/months"
    
    RESPONSE=$(curl -s -X GET \
        "$API_BASE/companies/$COMPANY_ID/efd/months" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        print_success "Got available months"
        MONTH=$(echo "$RESPONSE" | jq -r '.data[0].month // 3')
        YEAR=$(echo "$RESPONSE" | jq -r '.data[0].year // 2024')
        echo "    Month: $MONTH, Year: $YEAR"
    else
        print_error "Failed to get available months"
    fi
    echo ""
}

# Test 2: Generate EFD
test_generate_efd() {
    print_header "Test 2: POST /companies/{companyId}/efd/generate"
    
    RESPONSE=$(curl -s -X POST \
        "$API_BASE/companies/$COMPANY_ID/efd/generate" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"month\": ${MONTH:-3},
            \"year\": ${YEAR:-2024},
            \"includeOperations\": true,
            \"includeInventory\": false,
            \"includeAdjustments\": true
        }")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        print_success "EFD generated successfully"
        GENERATION_ID=$(echo "$RESPONSE" | jq -r '.data.id')
        echo "    Generation ID: $GENERATION_ID"
    else
        print_error "Failed to generate EFD"
        print_error "Response: $RESPONSE"
        return 1
    fi
    echo ""
}

# Test 3: Get EFD details
test_get_efd_details() {
    print_header "Test 3: GET /companies/{companyId}/efd/{generationId}"
    
    if [ -z "$GENERATION_ID" ]; then
        print_info "Skipping - No Generation ID available"
        return 0
    fi
    
    RESPONSE=$(curl -s -X GET \
        "$API_BASE/companies/$COMPANY_ID/efd/$GENERATION_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        print_success "Got EFD details"
        STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
        RECORD_COUNT=$(echo "$RESPONSE" | jq -r '.data.record_count')
        echo "    Status: $STATUS"
        echo "    Record Count: $RECORD_COUNT"
    else
        print_error "Failed to get EFD details"
    fi
    echo ""
}

# Test 4: Validate EFD
test_validate_efd() {
    print_header "Test 4: POST /companies/{companyId}/efd/{generationId}/validate"
    
    if [ -z "$GENERATION_ID" ]; then
        print_info "Skipping - No Generation ID available"
        return 0
    fi
    
    RESPONSE=$(curl -s -X POST \
        "$API_BASE/companies/$COMPANY_ID/efd/$GENERATION_ID/validate" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        IS_VALID=$(echo "$RESPONSE" | jq -r '.data.is_valid')
        ERROR_COUNT=$(echo "$RESPONSE" | jq -r '.data.errors | length')
        
        if [ "$IS_VALID" = "true" ]; then
            print_success "EFD validated successfully"
        else
            print_error "EFD has $ERROR_COUNT validation errors"
        fi
        
        echo "    Debit Total: $(echo "$RESPONSE" | jq -r '.data.summary.total_debit')"
        echo "    Credit Total: $(echo "$RESPONSE" | jq -r '.data.summary.total_credit')"
        echo "    Balanced: $(echo "$RESPONSE" | jq -r '.data.summary.debit_credit_balanced')"
    else
        print_error "Failed to validate EFD"
    fi
    echo ""
}

# Test 5: List EFD generations
test_list_efd() {
    print_header "Test 5: GET /companies/{companyId}/efd/list"
    
    RESPONSE=$(curl -s -X GET \
        "$API_BASE/companies/$COMPANY_ID/efd/list?page=1&limit=10&status=validated" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        COUNT=$(echo "$RESPONSE" | jq -r '.data | length')
        TOTAL=$(echo "$RESPONSE" | jq -r '.pagination.total')
        print_success "Listed EFD generations"
        echo "    Count: $COUNT"
        echo "    Total: $TOTAL"
    else
        print_error "Failed to list EFD generations"
    fi
    echo ""
}

# Test 6: Get EFD account balances
test_get_account_balances() {
    print_header "Test 6: GET /companies/{companyId}/efd/{generationId}/accounts"
    
    if [ -z "$GENERATION_ID" ]; then
        print_info "Skipping - No Generation ID available"
        return 0
    fi
    
    RESPONSE=$(curl -s -X GET \
        "$API_BASE/companies/$COMPANY_ID/efd/$GENERATION_ID/accounts" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        COUNT=$(echo "$RESPONSE" | jq -r '.count')
        print_success "Got account balances"
        echo "    Account Count: $COUNT"
    else
        print_error "Failed to get account balances"
    fi
    echo ""
}

# Test 7: Get journal entries
test_get_journal_entries() {
    print_header "Test 7: GET /companies/{companyId}/efd/{generationId}/journal-entries"
    
    if [ -z "$GENERATION_ID" ]; then
        print_info "Skipping - No Generation ID available"
        return 0
    fi
    
    RESPONSE=$(curl -s -X GET \
        "$API_BASE/companies/$COMPANY_ID/efd/$GENERATION_ID/journal-entries" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        COUNT=$(echo "$RESPONSE" | jq -r '.count')
        print_success "Got journal entries"
        echo "    Entry Count: $COUNT"
    else
        print_error "Failed to get journal entries"
    fi
    echo ""
}

# Test 8: Download EFD
test_download_efd() {
    print_header "Test 8: GET /companies/{companyId}/efd/{generationId}/download"
    
    if [ -z "$GENERATION_ID" ]; then
        print_info "Skipping - No Generation ID available"
        return 0
    fi
    
    # Download file
    curl -s -X GET \
        "$API_BASE/companies/$COMPANY_ID/efd/$GENERATION_ID/download" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -o "/tmp/efd_download_test.txt"
    
    if [ -f "/tmp/efd_download_test.txt" ] && [ -s "/tmp/efd_download_test.txt" ]; then
        print_success "Downloaded EFD file"
        LINE_COUNT=$(wc -l < /tmp/efd_download_test.txt)
        echo "    File Size: $(du -h /tmp/efd_download_test.txt | cut -f1)"
        echo "    Lines: $LINE_COUNT"
        echo "    First 3 lines:"
        head -3 /tmp/efd_download_test.txt | sed 's/^/        /'
    else
        print_error "Failed to download EFD file"
    fi
    echo ""
}

# Test 9: Get EFD status
test_get_status() {
    print_header "Test 9: GET /companies/{companyId}/efd/status"
    
    RESPONSE=$(curl -s -X GET \
        "$API_BASE/companies/$COMPANY_ID/efd/status" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    echo "$RESPONSE" | jq '.'
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        print_success "Got EFD status"
        TOTAL=$(echo "$RESPONSE" | jq -r '.data.stats.total')
        VALIDATED=$(echo "$RESPONSE" | jq -r '.data.stats.validated')
        echo "    Total EFDs: $TOTAL"
        echo "    Validated: $VALIDATED"
    else
        print_error "Failed to get EFD status"
    fi
    echo ""
}

# Test 10: Cancel EFD (if needed)
test_cancel_efd() {
    print_header "Test 10: POST /companies/{companyId}/efd/{generationId}/cancel (Optional)"
    
    if [ -z "$GENERATION_ID" ]; then
        print_info "Skipping - No Generation ID available"
        return 0
    fi
    
    read -p "    Do you want to cancel the EFD? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        RESPONSE=$(curl -s -X POST \
            "$API_BASE/companies/$COMPANY_ID/efd/$GENERATION_ID/cancel" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json")
        
        echo "$RESPONSE" | jq '.'
        
        if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
            print_success "EFD cancelled"
        else
            print_error "Failed to cancel EFD"
        fi
    else
        print_info "Skipped cancel"
    fi
    echo ""
}

# Main execution
main() {
    print_header "EFD API Test Suite"
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "your-jwt-token-here" ]; then
        print_error "Please set AUTH_TOKEN environment variable"
        echo "    Usage: export AUTH_TOKEN='your-jwt-token' && bash test-efd-endpoints.sh"
        exit 1
    fi
    
    if [ -z "$COMPANY_ID" ] || [ "$COMPANY_ID" = "550e8400-e29b-41d4-a716-446655440000" ]; then
        print_error "Please set COMPANY_ID environment variable"
        echo "    Usage: export COMPANY_ID='your-company-uuid' && bash test-efd-endpoints.sh"
        exit 1
    fi
    
    print_info "API Base: $API_BASE"
    print_info "Company ID: $COMPANY_ID"
    echo ""
    
    # Run tests
    test_get_available_months
    test_generate_efd
    test_get_efd_details
    test_validate_efd
    test_list_efd
    test_get_account_balances
    test_get_journal_entries
    test_download_efd
    test_get_status
    test_cancel_efd
    
    print_header "Test Suite Completed"
    print_success "All EFD API tests completed"
}

# Run main function
main
