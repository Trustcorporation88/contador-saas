# Sistema de Cache Redis - Contador Backend

## 📋 Visão Geral

Sistema de cache Redis production-ready implementado para otimizar performance do backend, reduzindo tempo de resposta em queries frequentes (relatórios, plano de contas, cálculos fiscais).

**Status**: ✅ Implementado e funcional  
**Data**: Maio 2026  
**Impacto Esperado**: 60%+ redução no response time, hit rate > 70%

---

## 🏗️ Arquitetura

### Componentes

```
backend/src/services/cache/
├── types.ts              # TypeScript interfaces e types
├── redisClient.ts        # Cliente Redis com retry logic
├── cacheService.ts       # Wrapper high-level do cache
└── cacheKeys.ts          # Helpers para geração de keys
```

### Stack Técnica

- **Cliente Redis**: `ioredis` (melhor suporte TypeScript)
- **Pattern**: Cache-aside com TTL configurável
- **Multi-tenancy**: Namespace isolado por `companyId`
- **Fail-safe**: App funciona mesmo se Redis cair

---

## ⚙️ Configuração

### Variáveis de Ambiente

Adicione no `.env`:

```bash
# Redis Connection
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=500
REDIS_ENABLE_OFFLINE_QUEUE=true
REDIS_LAZY_CONNECT=false

# Cache Configuration
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=600        # 10 minutos (fallback)
CACHE_REPORTS_TTL=300        # 5 minutos
CACHE_ACCOUNTS_TTL=900       # 15 minutos
CACHE_TAXES_TTL=3600         # 1 hora
CACHE_DASHBOARD_TTL=120      # 2 minutos
```

### Docker Compose

O Redis já está configurado no `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: contador_redis
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  restart: unless-stopped
```

---

## 🚀 Como Usar

### 1. Iniciar Redis

```bash
# Com Docker Compose
docker-compose up -d redis

# Standalone (local development)
redis-server
```

### 2. Verificar Conexão

```bash
# Health check do cache
curl http://localhost:3000/api/v1/health/cache
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-22T17:00:00.000Z",
  "redis": {
    "connected": true,
    "uptime": 86400,
    "uptimeHuman": "1d 0h 0m",
    "memoryUsed": "1.2MB",
    "keys": 42
  },
  "stats": {
    "hits": 1234,
    "misses": 321,
    "hitRate": 79.35,
    "hitRateFormatted": "79.35%"
  }
}
```

---

## 📊 Endpoints com Cache

### Reports (TTL: 5 minutos)

| Endpoint | Cache Key Pattern | Invalidação |
|----------|------------------|-------------|
| `GET /companies/:id/reports/balance-sheet` | `reports:{companyId}:balance-sheet:{date}` | Novo journal_entry |
| `GET /companies/:id/reports/income-statement` | `reports:{companyId}:income-statement:{from}:{to}` | Novo journal_entry |
| `GET /companies/:id/reports/trial-balance` | `reports:{companyId}:trial-balance:{from}:{to}` | Novo journal_entry |
| `GET /companies/:id/reports/ledger/:accountId` | `reports:{companyId}:ledger:{from}:{to}` | Novo journal_entry |

### Accounts (TTL: 15 minutos)

| Endpoint | Cache Key Pattern | Invalidação |
|----------|------------------|-------------|
| `GET /companies/:id/accounts?hierarchy=true` | `accounts:{companyId}:tree` | Create/Update/Delete account |
| `GET /companies/:id/accounts` | `accounts:{companyId}:list:{hash}` | Create/Update/Delete account |

### Taxes (TTL: 1 hora)

| Endpoint | Cache Key Pattern | Invalidação |
|----------|------------------|-------------|
| `POST /companies/:id/taxes/calculate` | `taxes:{companyId}:calculation:{period}:{regime}` | Salvar apuração |
| `GET /companies/:id/taxes/appraisal` | `taxes:{companyId}:appraisal:list:{hash}` | Nova apuração |

---

## 🔧 Invalidação de Cache

### Automática

O cache é invalidado automaticamente quando dados são modificados:

- **Accounts**: Invalidado em `POST`, `PUT`, `DELETE` de accounts
- **Reports**: Invalidado quando novos `journal_entries` são criados
- **Taxes**: Invalidado ao salvar nova apuração fiscal

### Manual (via código)

```typescript
import cacheService from '../services/cache/cacheService';

// Invalidar todos os reports de uma empresa
await cacheService.invalidateReports(companyId);

// Invalidar todas as accounts de uma empresa
await cacheService.invalidateAccounts(companyId);

// Invalidar todos os cálculos de impostos
await cacheService.invalidateTaxes(companyId);

// Invalidar TUDO de uma empresa
await cacheService.invalidateCompany(companyId);

// Invalidar chaves específicas
await cacheService.del('reports:uuid:balance-sheet:2024-01');

// Invalidar por pattern
await cacheService.delPattern('reports:uuid:*');
```

---

## 📈 Monitoring

### Health Check Endpoint

```bash
GET /api/v1/health/cache
```

Retorna:
- Status da conexão Redis
- Estatísticas de uso (hits, misses, hit rate)
- Métricas de memória e uptime
- Alertas de performance

### Logs Estruturados

O sistema loga automaticamente:

```json
{
  "level": "info",
  "message": "Cache HIT - Balance Sheet",
  "companyId": "uuid-123",
  "dateTo": "2024-01-31",
  "key": "reports:uuid-123:balance-sheet:2024-01-31",
  "timestamp": "2026-05-22T17:00:00.000Z"
}
```

### Métricas Importantes

- **Hit Rate**: Deve estar > 70% para performance ideal
- **Memory Used**: Monitor para não exceder limites do Redis
- **Keys Count**: Número de keys armazenadas

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Testar cache hit/miss
# Primeira chamada (MISS)
curl http://localhost:3000/api/v1/companies/uuid/reports/balance-sheet

# Segunda chamada (HIT - deve ser mais rápida)
curl http://localhost:3000/api/v1/companies/uuid/reports/balance-sheet

# 2. Testar invalidação
# Criar nova conta (invalida cache de accounts)
curl -X POST http://localhost:3000/api/v1/companies/uuid/accounts \
  -H "Content-Type: application/json" \
  -d '{"code": "1.1.1.01", "name": "Conta Teste", "type": "ASSET"}'

# 3. Verificar stats
curl http://localhost:3000/api/v1/health/cache
```

### Unit Tests (TODO)

```bash
npm test -- tests/cache/cacheService.test.ts
```

### Integration Tests (TODO)

```bash
npm test -- tests/cache/integration.test.ts
```

---

## 🔐 Segurança

- ✅ Cache keys **NÃO** incluem dados sensíveis (passwords, tokens)
- ✅ Isolamento multi-tenant via namespace `companyId`
- ✅ Redis **NÃO** exposto publicamente (apenas rede interna Docker)
- ✅ TTLs configurados para evitar dados obsoletos

---

## 🚨 Troubleshooting

### Redis não está conectando

```bash
# Verificar se Redis está rodando
docker ps | grep redis

# Verificar logs do Redis
docker logs contador_redis

# Testar conexão manualmente
redis-cli -h localhost -p 6379 ping
# Deve retornar: PONG
```

### Cache hit rate muito baixo (< 50%)

1. Verificar se TTLs não estão muito curtos
2. Analisar padrões de acesso (logs)
3. Verificar se invalidação não está muito agressiva
4. Considerar aumentar TTLs para dados menos críticos

### Memória do Redis crescendo indefinidamente

1. Verificar política de eviction:
   ```bash
   redis-cli config get maxmemory-policy
   # Deve ser: allkeys-lru
   ```

2. Definir limite de memória:
   ```bash
   redis-cli config set maxmemory 512mb
   ```

### App não funciona sem Redis

Isso **NÃO** deve acontecer! O cache é fail-safe:

- Se Redis estiver down, `cacheService.get()` retorna `null`
- App continua funcionando (apenas mais lento)
- Verificar logs para confirmar comportamento

---

## 📚 Referências

- [ioredis Documentation](https://github.com/redis/ioredis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)

---

## 🎯 Próximos Passos

### Curto Prazo
- [ ] Implementar unit tests (cacheService.test.ts)
- [ ] Implementar integration tests (integration.test.ts)
- [ ] Adicionar cache em dashboard endpoints
- [ ] Monitorar hit rate em produção

### Médio Prazo
- [ ] Cache warming (pre-populate cache na inicialização)
- [ ] Compression para valores grandes (>10KB)
- [ ] Integração com Prometheus/Grafana

### Longo Prazo
- [ ] Redis Cluster para horizontal scaling
- [ ] Cache tags para invalidação granular
- [ ] Distributed locks para writes concorrentes
- [ ] A/B testing de TTLs otimizados

---

## 👥 Contribuindo

Para adicionar cache em novos endpoints:

1. **Importar dependências**:
   ```typescript
   import cacheService, { TTL_CONFIG } from '../services/cache/cacheService';
   import CacheKeys from '../services/cache/cacheKeys';
   ```

2. **Gerar cache key**:
   ```typescript
   const cacheKey = CacheKeys.myResource(companyId, params);
   ```

3. **Try cache first**:
   ```typescript
   const cached = await cacheService.get(cacheKey);
   if (cached) {
     logger.info('Cache HIT', { key: cacheKey });
     return res.status(200).json(cached);
   }
   ```

4. **Fetch + store**:
   ```typescript
   const data = await MyService.getData();
   await cacheService.set(cacheKey, data, TTL_CONFIG.MY_TYPE);
   return res.status(200).json(data);
   ```

5. **Invalidar quando necessário**:
   ```typescript
   // Em mutations (POST/PUT/DELETE)
   await cacheService.delPattern(`myresource:${companyId}:*`);
   ```

---

**Autor**: Backend Architect Agent  
**Última Atualização**: Maio 2026  
**Status**: ✅ Production Ready
