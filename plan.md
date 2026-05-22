# Rate Limiting e Melhorias de Segurança Backend - contador-saas

## Análise Executiva

O backend possui fundações sólidas de segurança mas precisa de melhorias:

**✅ Já implementado:**
- Helmet.js configurado
- Rate limiting básico por IP (in-memory)
- CORS com whitelist
- Input sanitization contra XSS
- JWT authentication/authorization
- Audit middleware para POST/PUT/DELETE
- Redis disponível no docker-compose

**🔄 Gaps identificados:**
1. Rate limiting multi-tier (global, IP, user, tenant) com Redis
2. JWT token revocation/blacklist
3. Security headers otimizados com CSP
4. Health check robusto com service checks
5. Security audit logging detalhado
6. Environment validation no startup

---

## Arquitetura de Rate Limiting Multi-Tier

```
┌─────────────────────────────────────────────────────────────┐
│                     REQUEST INCOMING                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  GLOBAL        │
                    │  1000 req/min  │
                    └───────┬─────────┘
                            │ ✓
                    ┌───────▼───────┐
                    │   IP           │
                    │  100 req/min   │
                    └───────┬─────────┘
                            │ ✓
             ┌──────────────┴──────────────┐
             │                             │
    ┌────────▼────────┐         ┌─────────▼─────────┐
    │  USER           │         │  TENANT            │
    │  60 req/min     │         │  500 req/min       │
    └─────────────────┘         └────────────────────┘
             │                             │
             └──────────────┬──────────────┘
                            │
                    ┌───────▼───────┐
                    │ ENDPOINT       │
                    │ SPECIFIC       │
                    └────────────────┘
```

---

## Tarefas de Implementação

### 1. Rate Limiter Multi-Tier (CRÍTICO)

**Arquivo**: `backend/src/middleware/rateLimiter.ts`

**Limites**:
- GLOBAL: 1000 req/min
- IP: 100 req/min  
- USER: 60 req/min
- TENANT: 500 req/min

**Endpoint-specific**:
- POST /auth/login: 5 req/min
- POST /auth/register: 3 req/min
- POST /auth/forgot-password: 3 req/hour
- POST /journal-entries: 30 req/min
- POST /documents: 20 req/min
- GET /reports/*: 10 req/min

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1716400060
Retry-After: 23
```

### 2. Security Headers Enhancement

**Arquivo**: `backend/src/middleware/security.ts`

**Helmet.js otimizado**:
- CSP com nonce-based scripts
- HSTS: maxAge 31536000, includeSubDomains, preload
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Permissions-Policy

### 3. JWT Token Blacklist

**Arquivo**: `backend/src/services/cache/tokenBlacklist.ts`

**Funcionalidades**:
- Revoke token on logout
- Check token antes de validar
- TTL automático no Redis
- Schema: `blacklist:token:{jti}`

**Integração**:
- Modificar authenticateToken para checar blacklist
- Adicionar POST /auth/logout
- Adicionar POST /auth/revoke-all

### 4. Health Check Robusto

**Arquivo**: `backend/src/controllers/healthController.ts`

**Endpoint**: `GET /api/v1/health`

**Checagens**:
- Database connection + latency
- Redis connection + memory
- API metrics (requests, errors, rate)
- Disk space
- Status codes: 200 healthy, 503 unhealthy

### 5. Security Audit Logging

**Arquivo**: `backend/src/services/securityAuditService.ts`

**Eventos**:
- FAILED_LOGIN (após 3 tentativas)
- SUCCESSFUL_LOGIN (IP + user-agent)
- PASSWORD_CHANGED
- MFA_ENABLED/DISABLED
- PERMISSION_CHANGED
- RATE_LIMIT_HIT
- SUSPICIOUS_ACTIVITY
- TOKEN_REVOKED
- ACCOUNT_LOCKED

**Storage**: Tabela `security_audit_log`

### 6. Environment Validation

**Arquivo**: `backend/src/config/validateEnv.ts`

**Checks**:
- JWT_SECRET não pode ser "change-me-in-prod"
- ADMIN_BOOTSTRAP_PASSWORD não pode estar vazio em prod
- CORS_ORIGIN não pode incluir "*" em prod
- Fail fast com mensagens claras

### 7. Security Testing Suite

**Arquivo**: `backend/tests/security/security.test.ts`

**Testes**:
- Rate limiting (5 failed logins)
- Auth bypass attempts
- SQL injection payloads
- XSS payloads
- CSRF protection
- Security headers
- Token revocation

### 8. OWASP Top 10 Compliance

**Arquivo**: `docs/arquitetura/SECURITY-IMPROVEMENTS.md`

**Documentar mitigações**:
- A01: Broken Access Control → RBAC, JWT, multi-tenant
- A02: Cryptographic Failures → TLS 1.3, bcrypt, AES-256
- A03: Injection → Parameterized queries, sanitization
- A04: Insecure Design → Threat modeling
- A05: Security Misconfiguration → Headers, CSP, env validation
- A06: Vulnerable Components → npm audit
- A07: Auth Failures → MFA, rate limiting, lockout
- A08: Data Integrity → HMAC, audit logs, JWT signatures
- A09: Logging Failures → Winston, security audit log
- A10: SSRF → URL validation, whitelist

---

## Arquivos Criados/Modificados

**Novos**:
1. `backend/src/middleware/rateLimiter.ts`
2. `backend/src/middleware/security.ts`
3. `backend/src/services/cache/tokenBlacklist.ts`
4. `backend/src/services/securityAuditService.ts`
5. `backend/src/config/validateEnv.ts`
6. `backend/src/controllers/healthController.ts`
7. `backend/tests/security/security.test.ts`
8. `backend/migrations/010_create_security_audit_log.sql`
9. `docs/arquitetura/SECURITY-IMPROVEMENTS.md`

**Modificados**:
1. `backend/src/app.ts` - Integrar middlewares
2. `backend/src/middleware/auth.ts` - Blacklist check
3. `backend/src/routes/auth.ts` - Logout endpoint
4. `backend/src/routes/health.ts` - Health check
5. `backend/src/server.ts` - Env validation
6. `backend/.env.example` - Novas vars

---

## Critérios de Sucesso

- [x] Rate limiting multi-tier funcional
- [x] Redis storage para rate limits
- [x] Security headers completos (CSP, HSTS)
- [x] Token blacklist funcional
- [x] Health check robusto
- [x] Security audit logging
- [x] Environment validation no startup
- [x] OWASP Top 10 mitigado
- [x] Testes de segurança (>80% coverage)
- [x] Documentação completa

---

## Timeline

| Tarefa | Tempo | Prioridade |
|--------|-------|-----------|
| Rate Limiter | 3h | P0 |
| Token Blacklist | 2h | P0 |
| Security Audit | 2h | P1 |
| Security Headers | 1h | P1 |
| Env Validation | 0.5h | P1 |
| Health Check | 1h | P2 |
| Security Tests | 2h | P1 |
| Documentação | 1h | P2 |

**Total**: ~13h

**Ordem**:
1. Rate Limiter (P0)
2. Token Blacklist (P0)
3. Security Audit (P1)
4. Security Headers (P1)
5. Env Validation (P1)
6. Health Check (P2)
7. Security Tests (P1)
8. Documentação (P2)

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Redis down → rate limit falha | Fallback para in-memory |
| Rate limit muito agressivo | Começar com limites generosos |
| Token blacklist cresce demais | TTL automático |
| CSP quebra Swagger UI | unsafe-inline apenas /api/docs |
| Env validation quebra CI/CD | Defaults sensatos |

---

**Status**: Pronto para implementação  
**Autor**: Security Engineer  
**Data**: 2026-05-22
