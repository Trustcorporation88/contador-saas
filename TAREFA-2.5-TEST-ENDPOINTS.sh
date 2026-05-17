#!/bin/bash

################################################################################
#                                                                              #
#     TAREFA 2.5 - TEST ENDPOINTS - CRUD Plano de Contas (Chart of Accounts) #
#                                                                              #
#  Script de testes manual para validar todos os 8 endpoints implementados    #
#  Requer: server rodando, JWT válido, empresa criada                         #
#                                                                              #
################################################################################

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                         CONFIGURAÇÃO DE TESTES                            ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

API_URL="http://localhost:3000/api/v1"
COMPANY_ID="<substituir com ID real>"
ACCOUNT_ID="<será preenchido após criar>"

# JWT token (obter via POST /auth/login)
JWT_TOKEN="<substituir com token válido>"

# Headers
JSON_HEADER="Content-Type: application/json"
AUTH_HEADER="Authorization: Bearer ${JWT_TOKEN}"

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                          1. IMPORTAR PLANO PADRÃO                         ║
# ║        POST /companies/:companyId/accounts/import-plano                   ║
# ║              Importar 119 contas do plano-contas-padrao.json              ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  IMPORTAR PLANO PADRÃO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X POST \
  "${API_URL}/companies/${COMPANY_ID}/accounts/import-plano" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{"overwrite": false}' \
  | jq .

# Resposta esperada:
# {
#   "imported": 119,
#   "skipped": 0,
#   "total": 119,
#   "errors": null
# }

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                        2. LISTAR CONTAS (FLAT)                            ║
# ║           GET /companies/:companyId/accounts?page=1&limit=10              ║
# ║                      Listar com paginação (flat list)                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  LISTAR CONTAS (FLAT LIST) - PAGINADO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts?page=1&limit=10" \
  -H "${AUTH_HEADER}" \
  | jq .

# Resposta esperada:
# {
#   "data": [
#     {
#       "id": "uuid",
#       "code": "1",
#       "name": "ATIVO",
#       "type": "ASSET",
#       "balance": 0,
#       "debit_total": 0,
#       "credit_total": 0,
#       "is_analytical": false,
#       "created_at": "2026-05-17T...",
#       "updated_at": "2026-05-17T..."
#     },
#     ...
#   ],
#   "total": 119,
#   "page": 1,
#   "limit": 10,
#   "total_pages": 12
# }

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                      3. LISTAR CONTAS (HIERARQUIA)                        ║
# ║           GET /companies/:companyId/accounts?hierarchy=true               ║
# ║                      Retorna tree structure recursiva                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  LISTAR CONTAS (HIERARQUIA/TREE) - PRIMEIRAS CONTAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts?hierarchy=true" \
  -H "${AUTH_HEADER}" \
  | jq '.data | first'

# Resposta esperada:
# {
#   "code": "1",
#   "name": "ATIVO",
#   "type": "ASSET",
#   "is_analytical": false,
#   "children": [
#     {
#       "code": "1.1",
#       "name": "Ativo Circulante",
#       "type": "ASSET",
#       "is_analytical": false,
#       "children": [
#         {
#           "code": "1.1.1",
#           "name": "Caixa e Equivalentes de Caixa",
#           ...
#           "children": [...]
#         }
#       ]
#     }
#   ]
# }

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                      4. FILTRAR POR TIPO (ASSET)                          ║
# ║           GET /companies/:companyId/accounts?type=ASSET&limit=5            ║
# ║                    Filtrar contas por tipo específico                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  FILTRAR CONTAS POR TIPO (ASSET)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts?type=ASSET&limit=5" \
  -H "${AUTH_HEADER}" \
  | jq '.data | length'

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                      5. BUSCAR POR CÓDIGO/NOME                            ║
# ║           GET /companies/:companyId/accounts?search=Caixa                 ║
# ║                 Busca fulltext em code e name                            ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  BUSCAR CONTAS (search=Caixa)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts?search=Caixa" \
  -H "${AUTH_HEADER}" \
  | jq '.data[0]'

# Resposta esperada:
# {
#   "id": "uuid",
#   "code": "1.1.1.01",
#   "name": "Caixa",
#   "type": "ASSET",
#   ...
# }

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                      6. CRIAR CONTA CUSTOMIZADA                           ║
# ║           POST /companies/:companyId/accounts                             ║
# ║              Criar nova conta com parent_code (hierarquia)                ║
# ║         Requer role: ACCOUNTANT ou ADMIN (será validado em middleware)    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  CRIAR CONTA CUSTOMIZADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X POST \
  "${API_URL}/companies/${COMPANY_ID}/accounts" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "code": "1.1.1.99",
    "name": "Caixa - Escritório",
    "type": "ASSET",
    "parent_code": "1.1.1",
    "is_analytical": true
  }' \
  | jq .

# Resposta esperada (201):
# {
#   "id": "new-uuid",
#   "code": "1.1.1.99",
#   "name": "Caixa - Escritório",
#   "type": "ASSET",
#   "parent_code": "1.1.1",
#   "balance": 0,
#   "is_analytical": true,
#   "created_at": "2026-05-17T...",
#   "updated_at": "2026-05-17T..."
# }

# SALVAR O ID RETORNADO PARA TESTES SEGUINTES
# ACCOUNT_ID="<copiar do response acima>"

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                      7. OBTER DETALHES DA CONTA                           ║
# ║           GET /companies/:companyId/accounts/:accountId                   ║
# ║                        Obter conta com saldo                              ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  OBTER DETALHES DA CONTA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts/${ACCOUNT_ID}" \
  -H "${AUTH_HEADER}" \
  | jq .

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                        8. OBTER SALDO DA CONTA                            ║
# ║           GET /companies/:companyId/accounts/:accountId/balance           ║
# ║             Obter saldo (debit_total - credit_total)                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8️⃣  OBTER SALDO DA CONTA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts/${ACCOUNT_ID}/balance" \
  -H "${AUTH_HEADER}" \
  | jq .

# Resposta esperada:
# {
#   "account_id": "uuid",
#   "code": "1.1.1.99",
#   "name": "Caixa - Escritório",
#   "balance": 0,
#   "debit_total": 0,
#   "credit_total": 0
# }

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                        9. ATUALIZAR CONTA                                 ║
# ║           PUT /companies/:companyId/accounts/:accountId                   ║
# ║              Atualizar dados (IMUTÁVEL: code)                             ║
# ║         Requer role: ACCOUNTANT ou ADMIN (será validado em middleware)    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9️⃣  ATUALIZAR CONTA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X PUT \
  "${API_URL}/companies/${COMPANY_ID}/accounts/${ACCOUNT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Caixa - Escritório São Paulo",
    "is_analytical": false
  }' \
  | jq .

# Resposta esperada (200):
# {
#   "id": "uuid",
#   "code": "1.1.1.99",
#   "name": "Caixa - Escritório São Paulo",
#   "type": "ASSET",
#   "is_analytical": false,
#   "updated_at": "2026-05-17T..."
# }

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                    10. OBTER HIERARQUIA COMPLETA                          ║
# ║           GET /companies/:companyId/accounts/hierarchy                    ║
# ║                    Retorna árvore completa de contas                      ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔟  OBTER HIERARQUIA COMPLETA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts/hierarchy" \
  -H "${AUTH_HEADER}" \
  | jq '.data[0] | {code, name, children_count: (.children | length)}'

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                      11. DELETAR CONTA (SOFT DELETE)                      ║
# ║           DELETE /companies/:companyId/accounts/:accountId                ║
# ║         Requer role: ADMIN only (será validado em middleware)             ║
# ║         Restrição: Não pode deletar conta com journal_lines               ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣1️⃣  DELETAR CONTA (SOFT DELETE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X DELETE \
  "${API_URL}/companies/${COMPANY_ID}/accounts/${ACCOUNT_ID}" \
  -H "${AUTH_HEADER}" \
  -v

# Resposta esperada (204 No Content)
# Verificar que is_active = false

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                    12. TESTES DE VALIDAÇÃO E ERRO                         ║
# ║                  (Cenários de erro esperado)                              ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪  TESTES DE VALIDAÇÃO E ERRO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Teste 1: Criar com código duplicado (409)
echo ""
echo "❌ Teste 1: Criar com código duplicado"
curl -X POST \
  "${API_URL}/companies/${COMPANY_ID}/accounts" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "code": "1.1.1",
    "name": "Conta duplicada",
    "type": "ASSET"
  }' \
  | jq '.error'

# Teste 2: Criar com parent inválido (404)
echo ""
echo "❌ Teste 2: Criar com parent_code inválido"
curl -X POST \
  "${API_URL}/companies/${COMPANY_ID}/accounts" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "code": "9.9.9.99",
    "name": "Teste parent inválido",
    "type": "ASSET",
    "parent_code": "99.99.99"
  }' \
  | jq '.error'

# Teste 3: Criar com tipo inválido (400)
echo ""
echo "❌ Teste 3: Criar com tipo inválido"
curl -X POST \
  "${API_URL}/companies/${COMPANY_ID}/accounts" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "code": "9.9.9.98",
    "name": "Conta com tipo inválido",
    "type": "INVALID_TYPE"
  }' \
  | jq '.error'

# Teste 4: Buscar conta inexistente (404)
echo ""
echo "❌ Teste 4: Buscar conta inexistente"
curl -X GET \
  "${API_URL}/companies/${COMPANY_ID}/accounts/invalid-uuid" \
  -H "${AUTH_HEADER}" \
  | jq '.error'

################################################################################
#                                                                              #
#                         RESUMO DOS TESTES                                   #
#                                                                              #
#  ✅ Endpoints HTTP:              8 endpoints (GET, POST, PUT, DELETE)       #
#  ✅ Paginação:                   page, limit, total_pages                   #
#  ✅ Filtros:                     search, type, tax_code, parent_code        #
#  ✅ Hierarquia:                  tree structure recursiva                   #
#  ✅ Cálculo de saldo:            debit - credit (dinâmico)                  #
#  ✅ Validação:                   DTOs, código único, parent válido          #
#  ✅ Multi-tenancy:               isolamento por company_id                  #
#  ✅ Soft delete:                 is_active = false                          #
#  ✅ Importação:                  plano-contas-padrao.json                   #
#  ✅ Error handling:              400, 403, 404, 409, 500                    #
#                                                                              #
#  PRÓXIMAS AÇÕES:                                                            #
#  1. Executar testes com JWT válido                                          #
#  2. Verificar logs de auditoria em access_audit                             #
#  3. Validar isolamento multi-tenant                                         #
#  4. Testar com lançamentos (journal_entries)                                #
#                                                                              #
################################################################################
