# 🚀 Guia de Implementação - Performance & Qualidade

**Status**: ✅ **PRONTO PARA DEPLOY**  
**Data**: 2026-06-20  
**Tempo de Deploy Estimado**: 30 minutos  
**Tempo de Teste**: 1 hora

---

## 📋 Arquivos Modificados

### Backend

#### 1. `backend/src/config/env.ts`
**Mudanças**:
- `BCRYPT_ROUNDS`: 12 → **10**
- `DATABASE_POOL_MIN`: 2 → **5**
- `DATABASE_POOL_MAX`: 10 → **20**
- `DATABASE_CONNECTION_TIMEOUT_MILLIS`: 2000 → **10000**

✅ **Status**: Implementado

#### 2. `backend/src/services/authService.ts`
**Mudanças**:
- Linha 207: Remover `await this.bootstrapAdminUser();` do método `login()`

✅ **Status**: Implementado

#### 3. `backend/src/migrations/20260620_add_users_email_index.ts` (NOVO)
**Arquivo novo** que cria índice case-insensitive em `users.email`

✅ **Status**: Criado

### Frontend

#### 4. `frontend/src/config/api.ts`
**Mudanças**:
- Timeout axios: 30s → **60s**
- Adicionar retry automático com backoff exponencial

✅ **Status**: Implementado

---

## 🔧 Passos para Deploy

### Fase 1: Backup (5 min)

```bash
# Fazer backup do banco de dados
pg_dump contador_db > contador_db_backup_2026-06-20.sql

# Verificar integridade
psql contador_db < contador_db_backup_2026-06-20.sql --dry-run
```

### Fase 2: Deploy Backend (10 min)

```bash
cd backend

# Instalar dependências (se necessário)
npm install

# Build com mudanças
npm run build

# Executar migrations
npm run migrate

# Verificar índice foi criado
psql $DATABASE_URL -c "SELECT * FROM pg_indexes WHERE tablename='users' ORDER BY indexname;"
# Output esperado: idx_users_email_lower | users(LOWER(email))

# Reiniciar backend
npm run dev  # development
# ou
npm run start  # production
```

### Fase 3: Deploy Frontend (5 min)

```bash
cd frontend

# Build
npm run build

# Deploy (Vercel)
vercel deploy --prod

# Se self-hosted
docker build -t contador-frontend:latest .
docker push contador-frontend:latest
```

### Fase 4: Validação (10 min)

#### Teste 1: Login Local
```bash
# Terminal 1: Backend rodando em localhost:3000
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@contador.dev","password":"YourPassword"}' \
  -w "\nTime: %{time_total}s\n" | jq .

# Esperado: ~ 0.2-0.7s (antes: 2.5-3s+)
```

#### Teste 2: Verificar Índice
```bash
psql contador_db << SQL
-- Verificar índice
SELECT * FROM pg_indexes WHERE tablename='users';

-- Verificar tamanho da tabela e índices
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename = 'users';

-- Verificar uso do índice
EXPLAIN ANALYZE 
SELECT * FROM users WHERE LOWER(email) = 'admin@contador.dev';
SQL
```

**Output esperado**:
```
Seq Scan on users  →  Index Scan using idx_users_email_lower
```

#### Teste 3: Verificar Pool
```bash
psql contador_db << SQL
-- Verificar conexões ativas
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Verificar pool size (esperado: min 5, max 20)
SELECT setting FROM pg_settings WHERE name = 'max_connections';
SQL
```

#### Teste 4: Rate Limiting
```bash
# Fazer 10 logins rápidos (deve falhar no 6º)
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@contador.dev","password":"wrong"}' \
    2>/dev/null | jq .error
done
```

**Esperado**: RATE_LIMIT_EXCEEDED no 6º

#### Teste 5: Logs
```bash
# Verificar logs do backend
tail -100 /var/log/contador/backend.log | grep -E "(timeout|error|BCRYPT|pool)"

# Esperado:
# ✓ "BCRYPT_ROUNDS=10"
# ✓ "DATABASE_POOL_MIN=5"
# ✓ "Migrations completed"
# ✗ Sem erros de timeout
```

---

## ✅ Checklist Pré-Deploy

- [ ] **Backup do banco de dados feito**
  ```bash
  ls -lh contador_db_backup_*.sql
  ```

- [ ] **Código compilado sem erros**
  ```bash
  npm run build 2>&1 | tee build.log
  ```

- [ ] **Testes passando** (se tiver)
  ```bash
  npm test -- --coverage
  ```

- [ ] **Variáveis de ambiente corretas**
  ```bash
  grep -E "BCRYPT_ROUNDS|DATABASE_POOL|CONNECTION_TIMEOUT" .env
  ```

- [ ] **Índice criado no BD**
  ```bash
  psql $DATABASE_URL -c "\di+ idx_users_email*"
  ```

---

## ✅ Checklist Pós-Deploy

- [ ] **Backend rodando sem erros**
  ```bash
  curl http://localhost:3000/health
  # Esperado: {"status":"healthy"}
  ```

- [ ] **Login funcionando**
  ```bash
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"...","password":"..."}'
  # Esperado: 200 OK com tokens
  ```

- [ ] **MFA ainda funciona**
  - [ ] Fazer login com 2FA
  - [ ] Verificar código TOTP
  - [ ] Logout

- [ ] **Refresh token funcionando**
  - [ ] Fazer login
  - [ ] Guardar refresh token
  - [ ] Chamar POST /auth/refresh-token
  - [ ] Verificar novo access token

- [ ] **Rate limiting ativo**
  - [ ] 5 tentativas de login: OK
  - [ ] 6ª tentativa: 429 Too Many Requests

- [ ] **Performance medida**
  ```bash
  # Fazer 10 logins, medir tempo médio
  for i in {1..10}; do
    time curl -X POST http://localhost:3000/api/v1/auth/login ...
  done
  # Esperado: < 1 segundo em média
  ```

- [ ] **Logs limpos de erros**
  ```bash
  grep -i "error\|timeout\|crash" logs/*.log | wc -l
  # Esperado: 0
  ```

- [ ] **BD saudável**
  ```bash
  psql $DATABASE_URL -c "SELECT count(*) FROM users;"
  psql $DATABASE_URL -c "SELECT count(*) FROM journal_entries;"
  ```

---

## 🔄 Rollback (Se Necessário)

Se algo der errado, você pode reverter rapidamente:

### Opção 1: Reverter Código (30 segundos)
```bash
# Backend
cd backend
git revert HEAD --no-edit  # Reverte último commit
npm run build && npm run start

# Frontend
cd frontend
git revert HEAD --no-edit
npm run build && vercel deploy --prod
```

### Opção 2: Restaurar do Backup (5 minutos)
```bash
# Criar nova conexão (não no DB atual)
psql postgres -c "DROP DATABASE contador_db;"
psql postgres -c "CREATE DATABASE contador_db;"

# Restaurar
psql contador_db < contador_db_backup_2026-06-20.sql

# Reiniciar backend
npm run start
```

### Opção 3: Downgrade de Env Vars (30 segundos)
```bash
# Reverter para padrões antigos
export BCRYPT_ROUNDS=12
export DATABASE_POOL_MIN=2
export DATABASE_POOL_MAX=10
export DATABASE_CONNECTION_TIMEOUT_MILLIS=2000

# Reiniciar
npm run start
```

---

## 📊 Métricas Esperadas

### Antes (Baseline)
```
Login latency (p95): 2500-3000ms
Timeout errors: ~10% em picos
Database connections: max 10 simultâneamente
Query time (findUserByEmail): 50-100ms
```

### Depois (Target)
```
Login latency (p95): 500-800ms  ← 4x mais rápido
Timeout errors: < 0.1%
Database connections: max 15 simultâneamente
Query time (findUserByEmail): 5-10ms  ← 10x mais rápido
```

---

## 🎯 Sucesso Criteria

✅ **Deploy será considerado bem-sucedido se**:

1. Nenhum erro no build
2. Login funciona em < 1s (local)
3. Login funciona em < 2s (staging/production)
4. Índice foi criado com sucesso
5. Nenhum erro de timeout nos primeiros 1000 logins
6. Taxa de sucesso de login > 99%
7. Rate limiting funciona corretamente
8. Sem degradação em outras features

---

## 🚨 Troubleshooting

### Problema: "timeout of 60000ms exceeded"
**Solução**:
```bash
# Aumentar timeout frontend
export VITE_API_TIMEOUT=90000
npm run build
```

### Problema: "could not acquire connection"
**Solução**:
```bash
# Aumentar pool size
export DATABASE_POOL_MIN=10
export DATABASE_POOL_MAX=30
npm run start
```

### Problema: "index already exists"
**Solução**:
```bash
# Migration é idempotent (usa IF NOT EXISTS)
# Rodar novamente é seguro
npm run migrate
```

### Problema: "bcrypt compare slow"
**Solução**:
```bash
# Verificar BCRYPT_ROUNDS
echo $BCRYPT_ROUNDS  # Deve ser 10, não 12
grep BCRYPT backend/src/config/env.ts
```

### Problema: Logins lentos APÓS deploy
**Causa provável**: Cache antigo no browser

**Solução**:
```bash
# Forçar renovação
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Limpar cookies
# Browser → DevTools → Application → Cookies → Apagar tudo
```

---

## 📞 Suporte

Se tiver dúvidas durante o deploy:

1. **Verificar logs**:
   ```bash
   tail -200f /var/log/contador/backend.log
   ```

2. **Testar conexão BD**:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Verificar variáveis de env**:
   ```bash
   env | grep -E "DATABASE|BCRYPT|NODE_ENV"
   ```

4. **Rollback rápido**:
   ```bash
   git revert HEAD --no-edit
   npm run build && npm run start
   ```

---

## 📚 Documentação Completa

Referência detalhada disponível em:

- `PERFORMANCE-OPTIMIZATION-REPORT.md` - Análise detalhada do timeout
- `CODE-QUALITY-RECOMMENDATIONS.md` - Próximas melhorias recomendadas

---

**Deploy realizado em**: 2026-06-20  
**Próximo review**: 2026-07-20  
**Tempo de vida esperado**: Indefinido (melhorias perenes)

Good luck! 🚀
