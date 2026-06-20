# 📋 Recomendações de Qualidade de Código - Contador SaaS

**Data**: 2026-06-20  
**Severidade**: Misto (Média/Baixa)  
**Impacto**: Melhorias long-term em manutenibilidade, performance e UX

---

## 🎯 Problemas Identificados & Soluções

### 1. **N+1 Queries no Login** ⚠️ (Média)

**Localização**: `backend/src/services/authService.ts:744-780`

**Problema**:
```typescript
// usersStore é um Map em memória que pode ficar out-of-sync
const existingUser = usersStore.get(email);
if (!existingUser) {
  // Nova query ao BD se não em cache
  const dbUser = await db('users').where({ email }).first();
}
```

**Impacto**: Se 100 usuários não estão no cache, são 100 queries.

**Solução Recomendada**:
```typescript
// Sempre buscar do BD (fonte de verdade)
async findUserByEmail(email: string): Promise<UserStore | null> {
  const db = await getDatabase();
  const user = await db('users')
    .where(db.raw('LOWER(email) = ?', [email.toLowerCase()]))
    .first();
  return user ? this.mapDbUserToStore(user) : null;
}
```

**Status**: ⏳ Não corrigido ainda (não é bloqueador)

---

### 2. **InMemory Store vs PostgreSQL Desincronizado** ⚠️ (Média)

**Localização**: `backend/src/services/authService.ts:58-60`

**Problema**:
- `usersStore` e `refreshTokensStore` são Maps em memória
- Podem ficar fora de sincronia se banco é modificado externamente
- Múltiplas instâncias do backend (scaling) compartilham estado inconsistente

```typescript
// Perigoso em produção com múltiplas instâncias
const usersStore: Map<string, UserStore> = new Map();
const refreshTokensStore: Map<string, RefreshTokenStore> = new Map();
```

**Solução Recomendada** (Futura):
1. Remover in-memory stores completamente
2. Usar apenas PostgreSQL como fonte de verdade
3. Adicionar Redis para cache com TTL apropriado

**Status**: ⏳ A fazer (quando escalar para múltiplas instâncias)

---

### 3. **Rate Limiting Não Persistido em BD** ⚠️ (Média)

**Localização**: `backend/src/services/authService.ts:60`

**Problema**:
```typescript
const loginAttemptsStore: Map<string, { attempts: number; resetTime: Date }> = new Map();
```

- Rate limiting em memória
- Não sobrevive a restarts
- Não sincroniza entre instâncias

**Impacto**: Um atacker pode fazer reset com crash

**Solução Recomendada**:
```typescript
// Usar Redis com TTL automático
async checkLoginRateLimit(email: string): Promise<void> {
  const attempts = await redis.incr(`login_attempts:${email}`);
  if (attempts === 1) {
    await redis.expire(`login_attempts:${email}`, 15 * 60); // 15 min TTL
  }
  if (attempts > 5) {
    throw new RateLimitError('Too many login attempts');
  }
}
```

**Status**: ⏳ A fazer (quando Redis estiver estável)

---

### 4. **Falta de Connection Pooling Externo** ⚠️ (Baixa)

**Problema**: Múltiplas instâncias Node.js cada uma com pool=20

**Cenário**:
- 5 instâncias Node × pool_max=20 = **100 conexões PostgreSQL**
- PostgreSQL default: max_connections=100 → **esgotado!**

**Solução Recomendada** (Futura, para escala):
```bash
# Usar PgBouncer como proxy de conexões
docker run -d \
  -e DATABASES_HOST=postgres \
  -e DATABASES_USER=contador_user \
  -p 6432:6432 \
  edoburu/pgbouncer
```

**Atualizar backend**:
```env
DATABASE_URL=postgresql://contador_user@pgbouncer:6432/contador_db
DATABASE_POOL_MAX=5  # Reduzir pois pool é externo
```

**Status**: ⏳ Considerar quando atingir 10K+ usuários

---

### 5. **Falta de Request Logging Estruturado** 📊 (Baixa)

**Localização**: `backend/src/middleware/requestLogger.ts`

**Problema**: Logar sem trace IDs torna debugging difícil

**Solução Recomendada**:
```typescript
import { v4 as uuidv4 } from 'uuid';

// Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  req.traceId = traceId; // Adicionar ao request
  
  logger.info('Request start', {
    traceId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });
  
  res.on('finish', () => {
    logger.info('Request end', {
      traceId,
      status: res.statusCode,
      duration: Date.now() - req.startTime,
    });
  });
  
  next();
});
```

**Status**: ⏳ Recomendado para produção

---

### 6. **Falta de Circuit Breaker para BD** 🔌 (Média)

**Problema**: Se PostgreSQL ficar lento, todas as requisições ficam em fila

**Solução Recomendada**:
```typescript
// Usar library como opossum
const breaker = new CircuitBreaker(async () => {
  return db.raw('SELECT 1');
}, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

// Middleware
app.use(async (req, res, next) => {
  try {
    await breaker.fire();
    next();
  } catch {
    res.status(503).json({ error: 'Database unavailable' });
  }
});
```

**Status**: ⏳ Considerar para resiliência

---

### 7. **Falta de Input Validation no Login** 🔒 (Baixa)

**Localização**: `backend/src/controllers/authController.ts:32-50`

**Problema**: Validação basicona (regex simples)

**Solução Recomendada** (usando Joi/Zod):
```typescript
const loginSchema = joi.object({
  email: joi.string().email().required().lowercase(),
  password: joi.string().min(8).max(256).required(),
});

export async function login(req: Request, res: Response): Promise<void> {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }
  
  const response = await authService.login(value.email, value.password);
  // ...
}
```

**Status**: ✅ Parcialmente feito (frontend tem validação)

---

### 8. **Falta de Healthcheck Detalhado** 🏥 (Baixa)

**Localização**: `backend/src/controllers/healthController.ts`

**Problema**: Healthcheck simples não detecta dependências quebradas

**Solução Recomendada**:
```typescript
export async function health(req: Request, res: Response): Promise<void> {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
  };

  try {
    await getDatabase().raw('SELECT 1');
    checks.database = 'healthy';
  } catch {
    checks.database = 'unhealthy';
  }

  if (envConfig.cache.enabled) {
    try {
      await redisClient.ping();
      checks.redis = 'healthy';
    } catch {
      checks.redis = 'unhealthy';
    }
  }

  const allHealthy = Object.values(checks).every(s => s === 'healthy');
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
```

**Status**: ⏳ Recomendado para SRE/DevOps

---

### 9. **BCRYPT_ROUNDS Como Configuração Global** 🔐 (Média)

**Problema**: Não há versão para diferentes níveis de segurança

**Solução Recomendada**:
```typescript
// env.ts
BCRYPT_ROUNDS_LOGIN: 10,      // Fast (login)
BCRYPT_ROUNDS_SIGNUP: 12,     // Moderate (less frequent)
BCRYPT_ROUNDS_BACKUP: 14,     // Slow (one-time backup codes)

// authService.ts
async verifyPasswordForUser(...) {
  return await bcrypt.compare(password, hash);  // Automático
}

async hashPassword(password: string, context: 'login' | 'signup') {
  const rounds = context === 'login' ? 10 : 12;
  return bcrypt.hash(password, rounds);
}
```

**Status**: ⏳ Otimização futura

---

### 10. **Falta de Database Migrations Versionadas** 🗄️ (Média)

**Problema**: Múltiplas migrations SQL e TS sem padrão claro

```
backend/migrations/
├── 010_create_bank_reconciliation_tables.sql
├── 010_create_nfe_ocr_tables.ts          ← Conflito de versão!
├── add_auth_tables.ts                    ← Sem timestamp
└── 20260522173122_optimize_indexes.ts    ← Com timestamp
```

**Solução Recomendada**:
```
backend/src/migrations/
├── 20260101_001_initial_schema.ts
├── 20260115_002_add_auth_tables.ts
├── 20260120_003_add_das_boletos.ts
└── 20260620_004_add_users_email_index.ts
```

**Status**: ⏳ Refatorar quando tiver tempo

---

### 11. **Falta de API Deprecation Headers** 📡 (Baixa)

**Problema**: Mudanças de API causam breaking changes silenciosamente

**Solução Recomendada**:
```typescript
app.use((req, res, next) => {
  // Adicionar headers de deprecation
  if (req.path === '/api/v1/auth/legacy-endpoint') {
    res.set('Deprecated', 'true');
    res.set('Sunset', 'Sun, 31 Dec 2026 23:59:59 GMT');
    res.set('Link', '<https://docs.contador.dev/v2>; rel="successor-version"');
  }
  next();
});
```

**Status**: ⏳ Para quando tiver v2

---

### 12. **TypeScript Strict Mode** 🔒 (Baixa)

**Localização**: `backend/tsconfig.json`, `frontend/tsconfig.json`

**Problema**: Alguns settings não estão em strict mode

```json
// Adicionar:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**Status**: ⏳ Implementar gradualmente

---

## 📊 Matriz de Priorização

| # | Item | Severidade | Esforço | Impacto | Status |
|---|------|-----------|---------|--------|--------|
| 1 | N+1 Queries | Média | 2h | 30% performance | ⏳ TODO |
| 2 | InMemory Store | Média | 4h | Escalabilidade | ⏳ TODO |
| 3 | Rate Limiting BD | Média | 3h | Segurança | ⏳ TODO |
| 4 | PgBouncer | Baixa | 6h | 10K+ usuarios | ⏳ LATER |
| 5 | Request Logging | Baixa | 2h | Debug | ⏳ TODO |
| 6 | Circuit Breaker | Média | 3h | Resiliência | ⏳ TODO |
| 7 | Input Validation | Baixa | 2h | Segurança | ✅ PARTIAL |
| 8 | Healthcheck Detalhado | Baixa | 1h | DevOps | ⏳ TODO |
| 9 | BCRYPT_ROUNDS Variável | Média | 2h | Segurança | ⏳ TODO |
| 10 | Migrations Versionadas | Média | 4h | Manutenção | ⏳ TODO |
| 11 | Deprecation Headers | Baixa | 1h | API | ⏳ LATER |
| 12 | TypeScript Strict | Baixa | 8h | Confiabilidade | ⏳ PROGRESSIVE |

---

## 🚀 Roadmap Recomendado

### Q3 2026 (Agosto-Setembro)
- [ ] N+1 queries (2h)
- [ ] Rate limiting com Redis (3h)
- [ ] Request logging estruturado (2h)
- [ ] Healthcheck detalhado (1h)
- **Total**: 8h (1 sprint)

### Q4 2026 (Outubro-Dezembro)
- [ ] InMemory store → PostgreSQL full (4h)
- [ ] Circuit breaker (3h)
- [ ] BCRYPT_ROUNDS variável (2h)
- [ ] Migrations versionadas (4h)
- **Total**: 13h (2 sprints)

### 2027
- [ ] PgBouncer setup (6h)
- [ ] TypeScript strict mode (8h)
- [ ] Deprecation headers para v2 (1h)

---

## 🎓 Testes Recomendados

### Unit Tests (Backend)
```bash
npm test -- authService.spec.ts
npm test -- rateLimit.spec.ts
npm test -- database.spec.ts
```

### Integration Tests
```bash
npm run test:integration
```

### Load Tests
```bash
npm run test:load -- --users 100 --duration 60s
```

---

## 📚 Referências

- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

---

**Criado por**: Zed AI Agent  
**Próxima revisão**: 2026-09-20
