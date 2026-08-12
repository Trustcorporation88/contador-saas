/**
 * Opções compartilhadas de conexão Redis.
 * Prefere REDIS_URL (Railway/plugins) sobre host/port avulsos.
 */
import type { RedisOptions } from 'ioredis';
import { envConfig } from '../../config/env';

/** Endereços que significam "ninguém configurou Redis", e não "Redis local". */
const HOSTS_PADRAO = ['localhost', '127.0.0.1', '::1'];
const URL_PADRAO = 'redis://localhost:6379';

/**
 * Existe um Redis configurado de propósito?
 *
 * REDIS_URL e REDIS_HOST têm default apontando para localhost, e não há Redis
 * no projeto. O resultado era o rate limiter tentar `::1:6379` na primeira
 * requisição depois de cada deploy e despejar no log:
 *
 *   Redis error in rate limiter — connect ECONNREFUSED ::1:6379   (x4)
 *   Redis max retries exceeded for rate limiter
 *
 * Não derrubava nada — há fallback em memória — mas erro de infraestrutura
 * inexistente no log treina a gente a ignorar erro, e é assim que o erro que
 * importa passa batido.
 *
 * O `buildRedisOptions` já reconhecia a URL default como "não configurado" e
 * então se contradizia caindo em host/port que TAMBÉM são localhost. Esta
 * função é o critério único: quem quer Redis define REDIS_URL ou REDIS_HOST
 * apontando para algum lugar de verdade.
 */
export function redisConfigurado(): boolean {
  const url = (envConfig.redis.url || '').trim();
  if (url && url !== URL_PADRAO) return true;

  const host = (envConfig.redis.host || '').trim();
  return Boolean(host) && !HOSTS_PADRAO.includes(host);
}

export function buildRedisOptions(overrides: RedisOptions = {}): {
  /** Se definido, usar `new Redis(url, options)` */
  url?: string;
  options: RedisOptions;
} {
  const base: RedisOptions = {
    db: envConfig.redis.db,
    maxRetriesPerRequest: envConfig.redis.maxRetries,
    enableOfflineQueue: envConfig.redis.enableOfflineQueue,
    lazyConnect: envConfig.redis.lazyConnect,
    connectTimeout: 10_000,
    keepAlive: 30_000,
    connectionName: 'contador-backend',
    ...overrides,
  };

  const url = (envConfig.redis.url || '').trim();
  // Railway e a maioria dos PaaS injeta REDIS_URL; host/port default (localhost)
  // quebrariam o container se usássemos só REDIS_HOST sem o plugin linkado.
  if (url && url !== 'redis://localhost:6379') {
    return { url, options: base };
  }

  return {
    options: {
      ...base,
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      password: envConfig.redis.password || undefined,
    },
  };
}
