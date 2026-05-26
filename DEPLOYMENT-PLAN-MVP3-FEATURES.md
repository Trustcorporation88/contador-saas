# 🚀 DEPLOYMENT PLAN: MVP 3 FEATURES PARA PRODUÇÃO

**Data**: 2024-01-11  
**Status**: 🟢 PRONTO PARA DEPLOY  
**Timeline**: 2 horas (CRITICAL PATH)  

---

## 📋 CHECKLIST DE DEPLOYMENT

### ✅ FASE 1: CODE READY (COMPLETADO)
- [x] Feature 1: Recurring Transactions (feature branch merged)
- [x] Feature 2: Bank Reconciliation (código + migrations)
- [x] Feature 3: OCR NF-e (código + migrations)
- [x] Routes registradas em companies.ts
- [x] Migrations adicionadas ao migrationRunner.ts
- [x] Commits pushed para origin/master

**Commits**:
```bash
85716ce - feat: merge 3 MVP features
50ce411 - feat: register reconciliation and nfe-ocr routes
678c8b0 - feat: add bank reconciliation and nfe ocr migrations
```

---

### 🔄 FASE 2: INFRASTRUCTURE DEPLOYMENT (EM ANDAMENTO)

#### 2.1 Backend Render Deploy
**Configuração**: `render.production.yaml`
- [x] autoDeploy: true (detects push to master)
- [x] healthCheckPath: /api/v1/health
- [x] Node 18-alpine + Docker
- [ ] Build iniciado (aguardando webhook do GitHub)
- [ ] Build completado
- [ ] Health check: 200 OK
- [ ] Logs: Migrations executadas

**URL**: https://contador-saas-api.onrender.com

#### 2.2 Frontend Vercel Deploy
**Configuração**: Vercel Dashboard
- [x] Connected to contador-saas repo
- [x] Branch: master
- [ ] Build iniciado (aguardando webhook)
- [ ] Build completado
- [ ] Deploy live

**URL**: https://procontador.com.br

---

### 🧪 FASE 3: SMOKE TESTS (TODO)

#### 3.1 Health Check
```bash
curl -X GET https://contador-saas-api.onrender.com/api/v1/health
# Expected: 200 OK
# Response: { status: 'operational', version: '1.0.0' }
```

#### 3.2 Database Status
```bash
SELECT * FROM migrations_executed WHERE migration_name LIKE '00%';
# Expected: ≥6 migrations (001-006)
```

#### 3.3 Test Endpoints

**A. Reconciliation Endpoints** (Feature 2)
```bash
# 1. Upload extrato CSV
curl -X POST \
  -F "file=@extrato.csv" \
  https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/reconciliation/upload \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, { id, fileName, transactionCount, status: 'uploaded' }

# 2. Listar uploads
curl https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/reconciliation \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, array de uploads

# 3. Obter sugestões de matching
curl https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/reconciliation/{UPLOAD_ID}/suggestions \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, array de suggestions com confidence scores

# 4. Executar reconciliação
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{"matches": [...]}' \
  https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/reconciliation/{UPLOAD_ID}/execute
# Expected: 200 OK, { reconciled: N, failed: 0 }
```

**B. NFe OCR Endpoints** (Feature 3)
```bash
# 1. Upload NF-e (PDF/imagem)
curl -X POST \
  -F "file=@nfe.pdf" \
  https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/nfe/ocr/upload \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, { uploadId, status: 'processing' }

# 2. Obter dados extraídos
curl https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/nfe/ocr/{UPLOAD_ID} \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, { invoiceKey, issuerCNPJ, totalAmount, etc }

# 3. Preview de lançamento
curl https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/nfe/ocr/{UPLOAD_ID}/preview \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, preview de journal entry a criar

# 4. Confirmar e criar lançamento
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{"account": "4.1", "description": "..."}' \
  https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/nfe/ocr/{UPLOAD_ID}/confirm
# Expected: 201 Created, { journalEntryId, status: 'created' }

# 5. Validar NF-e com SEFAZ
curl https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/nfe/ocr/{INVOICE_KEY}/validate \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, { isValid: true, validatedAt: '...' }
```

**C. Recurring Transactions Endpoints** (Feature 1)
```bash
# 1. Criar lançamento recorrente
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{
    "description": "Aluguel mensal",
    "frequency": "monthly",
    "nextDate": "2024-02-15",
    "amount": 5000.00,
    "account": "5.1"
  }' \
  https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/recurring-transactions
# Expected: 201 Created, { id, status: 'active' }

# 2. Listar recorrências
curl https://contador-saas-api.onrender.com/api/v1/companies/{COMPANY_ID}/recurring-transactions \
  -H "Authorization: Bearer {TOKEN}"
# Expected: 200 OK, array de transações recorrentes

# 3. Executar geração de lançamentos (cron job)
# Rodado automaticamente em 00:05 UTC
# Verifica: table recurring_transactions contém atividades
```

---

### 👤 FASE 4: ADMIN USER VALIDATION

```bash
# Login com credenciais de bootstrap
curl -X POST https://contador-saas-api.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@procontador.com.br",
    "password": "ProContador@2026"
  }'
# Expected: 200 OK, { accessToken, refreshToken, user: {...} }

# Verificar em produção: https://procontador.com.br
# 1. Abrir login
# 2. Inserir admin@procontador.com.br / ProContador@2026
# 3. Deve autenticar e redirecionar para dashboard
# 4. Dashboard deve carregar sem erros JS
```

---

### 📊 FASE 5: MONITORING & ALERTS

#### 5.1 Logs Monitor (Render)
```
[DATABASE] Running migrations...
[MIGRATIONS] Running 005_create_bank_reconciliation_tables...
✓ 005_create_bank_reconciliation_tables completed
[MIGRATIONS] Running 006_create_nfe_ocr_tables...
✓ 006_create_nfe_ocr_tables completed
[MIGRATIONS] All migrations completed successfully!
✓ Database connected successfully
[DAS] Initializing DAS Scheduler with cron jobs...
[DAS] ✓ DAS Scheduler initialized with 3 cron jobs
✓ Server running at http://0.0.0.0:10000
```

#### 5.2 Database Verification
```sql
-- Verificar que tabelas foram criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'bank_reconciliation_uploads', 
  'bank_transactions',
  'reconciliation_matches',
  'nfe_uploads',
  'nfe_registry'
);

-- Expected: 5 rows

-- Verificar migrations executadas
SELECT COUNT(*) as total_migrations FROM migrations_executed;
-- Expected: 6 (001-006)
```

#### 5.3 Error Monitoring
- [ ] Sentry DSN configured
- [ ] Slack notifications setup
- [ ] PagerDuty integration (if applicable)

---

## 🎯 SUCCESS CRITERIA

✅ = Deploy bem-sucedido quando:

- [x] Master branch contém 3 features
- [ ] Backend build sucesso no Render
- [ ] Frontend build sucesso na Vercel
- [ ] Database migrations executadas (6 total)
- [ ] Health check retorna 200
- [ ] Admin user consegue fazer login
- [ ] Endpoints reconciliation respondendo
- [ ] Endpoints OCR respondendo
- [ ] Endpoints recurring-transactions respondendo
- [ ] Cron jobs agendados (verificar logs)
- [ ] Sem erros JavaScript no frontend
- [ ] Sem erros na console do backend

---

## 📈 POST-DEPLOYMENT

### Immediate (30 min)
1. Monitor backend logs por erros
2. Monitor frontend error reporting (Sentry)
3. Test cada endpoint manualmente
4. Verificar database com queries acima

### Short-term (2 hours)
1. Monitor cron jobs executando
2. Test com dados reais (upload extrato + NF-e)
3. Verificar performance de queries

### Dashboard Links
- Render Backend: https://dashboard.render.com/services/contador-backend
- Vercel Frontend: https://vercel.com/trustcorporation88/contador-saas
- Database: Render PostgreSQL Starter Plan

---

## 📞 ESCALATION

Se algo der errado:
1. Check Render logs: https://dashboard.render.com
2. Check Vercel logs: https://vercel.com/trustcorporation88/contador-saas
3. Check database connection em Render PostgreSQL
4. Rollback: `git revert <commit-hash>`

---

**DEPLOYMENT INITIATED**: 2024-01-11T14:30:00Z  
**EXPECTED COMPLETION**: 2024-01-11T16:30:00Z  
**STATUS**: 🟢 READY TO LAUNCH
