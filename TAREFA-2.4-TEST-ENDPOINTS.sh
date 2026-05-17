#!/bin/bash
# ============================================================================
# TAREFA 2.4: CRUD Companies - Quick Reference Guide
# ============================================================================
# Scripts de teste para validar endpoints
# Pré-requisito: Servidor rodando em http://localhost:3000
#                Token JWT válido via header Authorization: Bearer <token>
# ============================================================================

# VARIÁVEIS
TOKEN="seu_jwt_token_aqui"
BASE_URL="http://localhost:3000/api/v1"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              TAREFA 2.4: CRUD Companies - Test Suite               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"

# ============================================================================
# 1. CREATE - Criar nova empresa
# ============================================================================
echo -e "\n${YELLOW}[1] CREATE - POST /companies${NC}"
echo -e "Descrição: Criar nova empresa"
echo -e "Requer: Admin role\n"

curl -X POST "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "11222333000181",
    "name": "Empresa Teste LTDA",
    "address": "Rua Principal, 123",
    "phone": "(11) 99999-8888",
    "email": "contato@empresa.com",
    "tax_regime": "LUCRO_REAL",
    "fiscal_year_start": {
      "month": 1,
      "day": 1
    }
  }' | jq .

# Guardar company_id para próximos testes
COMPANY_ID=$(echo '...' | jq -r '.data.id') # Substituir por ID real

# ============================================================================
# 2. LIST - Listar empresas com paginação
# ============================================================================
echo -e "\n${YELLOW}[2] LIST - GET /companies${NC}"
echo -e "Descrição: Listar empresas com paginação e filtros"
echo -e "Query Params: page, limit, search, tax_regime, created_from, created_to\n"

echo -e "${BLUE}Exemplo 1: Paginação padrão (page=1, limit=10)${NC}"
curl -X GET "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo -e "\n${BLUE}Exemplo 2: Buscar por nome (case-insensitive)${NC}"
curl -X GET "$BASE_URL/companies?search=Empresa" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo -e "\n${BLUE}Exemplo 3: Filtrar por regime tributário${NC}"
curl -X GET "$BASE_URL/companies?tax_regime=LUCRO_REAL" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo -e "\n${BLUE}Exemplo 4: Paginação customizada${NC}"
curl -X GET "$BASE_URL/companies?page=2&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================================================
# 3. GET DETAIL - Obter detalhes da empresa
# ============================================================================
echo -e "\n${YELLOW}[3] GET - /companies/:id${NC}"
echo -e "Descrição: Obter detalhes completos de uma empresa"
echo -e "Acesso: Owner ou Admin\n"

curl -X GET "$BASE_URL/companies/$COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================================================
# 4. UPDATE - Atualizar empresa
# ============================================================================
echo -e "\n${YELLOW}[4] UPDATE - PUT /companies/:id${NC}"
echo -e "Descrição: Atualizar dados da empresa"
echo -e "Nota: CNPJ é imutável\n"

curl -X PUT "$BASE_URL/companies/$COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Empresa Teste LTDA - Atualizado",
    "email": "novo@email.com",
    "phone": "(11) 98888-7777",
    "tax_regime": "LUCRO_PRESUMIDO"
  }' | jq .

# ============================================================================
# 5. GET STATS - Obter estatísticas
# ============================================================================
echo -e "\n${YELLOW}[5] GET STATS - /companies/:id/stats${NC}"
echo -e "Descrição: Obter estatísticas da empresa\n"

curl -X GET "$BASE_URL/companies/$COMPANY_ID/stats" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================================================
# 6. DELETE - Deletar empresa (soft delete)
# ============================================================================
echo -e "\n${YELLOW}[6] DELETE - /companies/:id${NC}"
echo -e "Descrição: Deletar empresa (soft delete: is_active = false)"
echo -e "Requer: Admin role\n"

curl -X DELETE "$BASE_URL/companies/$COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n${GREEN}✅ Teste concluído!${NC}"

# ============================================================================
# VALIDAÇÃO DE ERROS
# ============================================================================
echo -e "\n${YELLOW}TESTE DE VALIDAÇÃO - Erros Esperados${NC}\n"

echo -e "${BLUE}Teste 1: CNPJ inválido (400 Bad Request)${NC}"
curl -X POST "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "invalid",
    "name": "Teste",
    "tax_regime": "LUCRO_REAL"
  }' | jq .

echo -e "\n${BLUE}Teste 2: CNPJ duplicado (409 Conflict)${NC}"
curl -X POST "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "11222333000181",
    "name": "Outra Empresa",
    "tax_regime": "LUCRO_REAL"
  }' | jq .

echo -e "\n${BLUE}Teste 3: Nome muito curto (400 Bad Request)${NC}"
curl -X POST "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "12345678901234",
    "name": "AB",
    "tax_regime": "LUCRO_REAL"
  }' | jq .

echo -e "\n${BLUE}Teste 4: Tax regime inválido (400 Bad Request)${NC}"
curl -X POST "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "12345678901234",
    "name": "Empresa Teste",
    "tax_regime": "INVALIDO"
  }' | jq .

# ============================================================================
# CÓDIGOS DE RESPOSTA ESPERADOS
# ============================================================================
echo -e "\n${YELLOW}CÓDIGOS DE RESPOSTA ESPERADOS:${NC}"
cat <<'CODES'

✓ 201 Created     - POST /companies (sucesso)
✓ 200 OK          - GET /companies, GET /:id, PUT /:id (sucesso)
✓ 204 No Content  - DELETE /:id (sucesso - soft delete)
✗ 400 Bad Request - Validação falhou (invalid CNPJ, missing fields, etc.)
✗ 401 Unauthorized - Token ausente ou inválido
✗ 403 Forbidden   - User sem permissão (non-admin creating, etc.)
✗ 404 Not Found   - Company não existe
✗ 409 Conflict    - CNPJ já existe (duplicado)
✗ 500 Error       - Erro no servidor

CODES

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  📌 DICAS PARA TESTES MANUAIS:                                      ║${NC}"
echo -e "${GREEN}║  1. Use um cliente REST (Postman, Insomnia, curl)                   ║${NC}"
echo -e "${GREEN}║  2. Obtenha um token JWT válido (via auth endpoint)                 ║${NC}"
echo -e "${GREEN}║  3. Substitua Bearer token antes de executar scripts                ║${NC}"
echo -e "${GREEN}║  4. Valide respostas JSON com 'jq' para melhor legibilidade         ║${NC}"
echo -e "${GREEN}║  5. Teste com diferentes roles (admin, accountant, viewer)          ║${NC}"
echo -e "${GREEN}║  6. Verifique auditoria em access_audit table                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"

# ============================================================================
# INSTALAÇÃO DO JQ (se necessário)
# ============================================================================
cat <<'JQ'

Se não tiver jq instalado:
  Windows (WSL): apt-get install jq
  macOS:         brew install jq
  Linux:         apt-get install jq
  
JQ

EOF
