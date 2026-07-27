/**
 * Opções compartilhadas de conexão Redis.
 * Prefere REDIS_URL (Railway/plugins) sobre host/port avulsos.
 */
import type { RedisOptions } from 'ioredis';
import { envConfig } from '../../config/env';

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
