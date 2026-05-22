/**
 * Multi-Tier Rate Limiting Middleware
 * 
 * Implementa 4 camadas de rate limiting usando Redis:
 * 1. Global - Previne DDoS
 * 2. Por IP - Previne abuse por endereço
 * 3. Por usuário autenticado - Protege recursos por conta
 * 4. Por tenant/empresa - Isola impacto entre clientes
 * 
 * Usa Sliding Window algorithm para precisão e prevenção de burst attacks.
 * 
 * @module middleware/rateLimiter
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { envConfig } from '../config/env';
import { logger } from './requestLogger';

/**
 * Redis client singleton
 */
let redisClient: Redis | null = null;

/**
 * Inicializa conexão Redis
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      password: envConfig.redis.password || undefined,
      db: envConfig.redis.db,
      maxRetriesPerRequest: envConfig.redis.maxRetries,
      retryStrategy: (times: number) => {
        if (times > envConfig.redis.maxRetries) {
          logger.error('Redis max retries exceeded for rate limiter');
          return null;
        }
        return Math.min(times * envConfig.redis.retryDelay, 2000);
      },
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error in rate limiter', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Rate limiter Redis connected');
    });
  }

  return redisClient;
}

/**
 * Rate limit tier configuration
 */
interface RateLimitTier {
  tier: 'global' | 'ip' | 'user' | 'tenant' | 'endpoint';
  limit: number;
  windowMs: number;
  identifier: string;
}

/**
 * Endpoint-specific rate limit overrides
 */
interface EndpointRateLimit {
  path: string;
  method: string;
  limit: number;
  windowMs: number;
}

/**
 * Configurações de rate limit por endpoint
 */
const ENDPOINT_LIMITS: EndpointRateLimit[] = [
  // Auth endpoints (mais restritivos)
  {
    path: '/api/v1/auth/login',
    method: 'POST',
    limit: 5,
    windowMs: 60 * 1000, // 5 tentativas por minuto
  },
  {
    path: '/api/v1/auth/register',
    method: 'POST',
    limit: 3,
    windowMs: 60 * 1000, // 3 tentativas por minuto
  },
  {
    path: '/api/v1/auth/forgot-password',
    method: 'POST',
    limit: 3,
    windowMs: 60 * 60 * 1000, // 3 tentativas por hora
  },

  // Endpoints de escrita (moderado)
  {
    path: '/api/v1/journal-entries',
    method: 'POST',
    limit: 30,
    windowMs: 60 * 1000,
  },
  {
    path: '/api/v1/documents',
    method: 'POST',
    limit: 20,
    windowMs: 60 * 1000,
  },

  // Endpoints de relatórios (pesado)
  {
    path: '/api/v1/reports/balance-sheet',
    method: 'GET',
    limit: 10,
    windowMs: 60 * 1000,
  },
  {
    path: '/api/v1/reports/income-statement',
    method: 'GET',
    limit: 10,
    windowMs: 60 * 1000,
  },
  {
    path: '/api/v1/reports/cash-flow',
    method: 'GET',
    limit: 10,
    windowMs: 60 * 1000,
  },
];

/**
 * Limites padrão por tier
 */
const DEFAULT_LIMITS = {
  global: {
    limit: 1000,
    windowMs: 60 * 1000, // 1000 req/min
  },
  ip: {
    limit: 100,
    windowMs: 60 * 1000, // 100 req/min
  },
  user: {
    limit: 60,
    windowMs: 60 * 1000, // 60 req/min
  },
  tenant: {
    limit: 500,
    windowMs: 60 * 1000, // 500 req/min
  },
};

/**
 * In-memory fallback quando Redis está indisponível
 */
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Sliding Window Rate Limiter usando Redis ZSET
 * 
 * @param key - Chave Redis
 * @param limit - Número máximo de requests
 * @param windowMs - Janela de tempo em millisegundos
 * @returns {allowed, remaining, resetAt} - Resultado da verificação
 */
async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = now + windowMs;

  try {
    // Pipeline Redis para atomicidade
    const pipeline = redis.pipeline();

    // 1. Remove requests fora da janela
    pipeline.zremrangebyscore(key, '-inf', windowStart);

    // 2. Conta requests na janela atual
    pipeline.zcard(key);

    // 3. Adiciona request atual (usa timestamp + random para unicidade)
    const requestId = `${now}-${Math.random().toString(36).substring(7)}`;
    pipeline.zadd(key, now, requestId);

    // 4. Define TTL (janela + buffer)
    pipeline.expire(key, Math.ceil(windowMs / 1000) + 60);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline returned null');
    }

    // Extrai count antes de adicionar novo request
    const count = (results[1][1] as number) || 0;
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count - (allowed ? 1 : 0));

    return { allowed, remaining, resetAt };
  } catch (error) {
    // Fallback para in-memory se Redis falhar
    logger.warn('Redis unavailable, using in-memory rate limit', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });

    return inMemoryFallback(key, limit, windowMs);
  }
}

/**
 * In-memory fallback (menos preciso mas funcional)
 */
function inMemoryFallback(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = inMemoryStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    inMemoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  const allowed = bucket.count < limit;
  if (allowed) {
    bucket.count += 1;
    inMemoryStore.set(key, bucket);
  }

  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Extrai IP do request (considera proxies)
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Busca configuração de rate limit específica para endpoint
 */
function getEndpointLimit(
  req: Request,
): { limit: number; windowMs: number } | null {
  const endpointConfig = ENDPOINT_LIMITS.find(
    (config) =>
      config.method === req.method &&
      (req.path === config.path || req.path.startsWith(config.path)),
  );

  if (endpointConfig) {
    return {
      limit: endpointConfig.limit,
      windowMs: endpointConfig.windowMs,
    };
  }

  return null;
}

/**
 * Middleware de rate limiting multi-tier
 */
export function rateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip se rate limiting desabilitado
    if (!envConfig.enableRateLimiting) {
      return next();
    }

    // Skip health check endpoint
    if (req.path === '/health' || req.path === '/api/v1/health') {
      return next();
    }

    const ip = getClientIp(req);
    const userId = (req as any).user?.id || null;
    const companyId = (req as any).user?.companyId || null;

    // Tiers a verificar
    const tiers: RateLimitTier[] = [];

    // 1. Global rate limit
    tiers.push({
      tier: 'global',
      limit: DEFAULT_LIMITS.global.limit,
      windowMs: DEFAULT_LIMITS.global.windowMs,
      identifier: 'global',
    });

    // 2. IP rate limit
    tiers.push({
      tier: 'ip',
      limit: DEFAULT_LIMITS.ip.limit,
      windowMs: DEFAULT_LIMITS.ip.windowMs,
      identifier: ip,
    });

    // 3. User rate limit (se autenticado)
    if (userId) {
      tiers.push({
        tier: 'user',
        limit: DEFAULT_LIMITS.user.limit,
        windowMs: DEFAULT_LIMITS.user.windowMs,
        identifier: userId,
      });
    }

    // 4. Tenant rate limit (se multi-tenant)
    if (companyId) {
      tiers.push({
        tier: 'tenant',
        limit: DEFAULT_LIMITS.tenant.limit,
        windowMs: DEFAULT_LIMITS.tenant.windowMs,
        identifier: companyId,
      });
    }

    // 5. Endpoint-specific rate limit (override)
    const endpointLimit = getEndpointLimit(req);
    if (endpointLimit) {
      tiers.push({
        tier: 'endpoint',
        limit: endpointLimit.limit,
        windowMs: endpointLimit.windowMs,
        identifier: `${req.method}:${req.path}:${userId || ip}`,
      });
    }

    // Verifica cada tier sequencialmente
    for (const tier of tiers) {
      const key = `ratelimit:${tier.tier}:${tier.identifier}`;
      const result = await slidingWindowRateLimit(
        key,
        tier.limit,
        tier.windowMs,
      );

      // Adiciona headers de rate limit (do tier mais restritivo)
      res.setHeader('X-RateLimit-Limit', tier.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfter.toString());

        // Log rate limit hit
        logger.warn('Rate limit exceeded', {
          tier: tier.tier,
          identifier: tier.identifier,
          limit: tier.limit,
          path: req.path,
          method: req.method,
          ip,
          userId,
          companyId,
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for ${tier.tier} tier. Please try again in ${retryAfter} seconds.`,
          tier: tier.tier,
          limit: tier.limit,
          retryAfter,
        });
      }
    }

    // Todas as camadas OK
    next();
  };
}

/**
 * Cleanup in-memory store periodicamente
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of inMemoryStore.entries()) {
    if (bucket.resetAt <= now) {
      inMemoryStore.delete(key);
    }
  }
}, 60 * 1000); // Limpa a cada 1 minuto

export default rateLimiter;
