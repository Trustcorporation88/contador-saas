/**
 * Cache Service
 * High-level wrapper para operações de cache com Redis
 * Inclui: serialização automática, TTL configurável, tracking de métricas, fail-safe
 */

import redisClient from './redisClient';
import { envConfig } from '../../config/env';
import {
  ICacheService,
  CacheStats,
  RedisHealth,
  CacheMetrics,
  TTLConfig,
} from './types';

/**
 * Logger import
 */
let logger: any;
try {
  const loggerModule = require('../../middleware/requestLogger');
  logger = loggerModule.logger;
} catch {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
}

/**
 * Configuração de TTL por tipo de dados
 */
export const TTL_CONFIG: TTLConfig = {
  REPORTS: envConfig.cache.reportsTtl,
  ACCOUNTS: envConfig.cache.accountsTtl,
  TAXES: envConfig.cache.taxesTtl,
  DASHBOARD: envConfig.cache.dashboardTtl,
  DEFAULT: envConfig.cache.defaultTtl,
};

/**
 * Cache Service Implementation
 */
class CacheService implements ICacheService {
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  /**
   * Verifica se cache está habilitado
   */
  private get isEnabled(): boolean {
    return envConfig.cache.enabled && redisClient.connected;
  }

  /**
   * Recupera valor do cache
   */
  public async get<T>(key: string): Promise<T | null> {
    // Se cache desabilitado ou Redis não conectado, retorna null (fail-safe)
    if (!this.isEnabled) {
      logger.debug('Cache disabled or Redis not connected', { key });
      this.metrics.misses++;
      return null;
    }

    try {
      const startTime = Date.now();
      const client = redisClient.getClient();
      const value = await client.get(key);

      const responseTime = Date.now() - startTime;

      if (value === null) {
        this.metrics.misses++;
        logger.debug('Cache MISS', { key, responseTime });
        return null;
      }

      this.metrics.hits++;
      logger.debug('Cache HIT', { key, responseTime });

      // Deserializar JSON
      try {
        return JSON.parse(value) as T;
      } catch (parseError) {
        logger.error('Cache JSON parse error', {
          key,
          error: (parseError as Error).message,
        });
        return null;
      }
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = error as Error;
      this.metrics.lastErrorTime = new Date();

      logger.error('Cache GET error', {
        key,
        error: (error as Error).message,
      });

      // Fail-safe: retorna null em caso de erro
      return null;
    }
  }

  /**
   * Armazena valor no cache
   */
  public async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    if (!this.isEnabled) {
      logger.debug('Cache disabled, skipping SET', { key });
      return;
    }

    try {
      const startTime = Date.now();
      const client = redisClient.getClient();

      // Serializar para JSON
      const serialized = JSON.stringify(value);

      // Usar TTL fornecido ou default
      const ttl = ttlSeconds ?? TTL_CONFIG.DEFAULT;

      // Armazenar com TTL
      await client.setex(key, ttl, serialized);

      const responseTime = Date.now() - startTime;
      this.metrics.sets++;

      logger.debug('Cache SET', { key, ttl, responseTime, size: serialized.length });
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = error as Error;
      this.metrics.lastErrorTime = new Date();

      logger.error('Cache SET error', {
        key,
        error: (error as Error).message,
      });

      // Fail-safe: não propaga erro
    }
  }

  /**
   * Remove chave específica
   */
  public async del(key: string): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const client = redisClient.getClient();
      const result = await client.del(key);

      this.metrics.deletes++;
      logger.debug('Cache DEL', { key, existed: result > 0 });

      return result > 0;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache DEL error', {
        key,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Remove múltiplas chaves usando pattern
   * Usa SCAN para evitar bloqueio do Redis
   */
  public async delPattern(pattern: string): Promise<number> {
    if (!this.isEnabled) {
      return 0;
    }

    try {
      const client = redisClient.getClient();
      let cursor = '0';
      let deletedCount = 0;

      // SCAN iterativo para não bloquear Redis
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          const result = await client.del(...keys);
          deletedCount += result;
        }
      } while (cursor !== '0');

      this.metrics.deletes += deletedCount;
      logger.info('Cache DEL pattern', { pattern, deletedCount });

      return deletedCount;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache DEL pattern error', {
        pattern,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Invalida múltiplas chaves de uma vez
   */
  public async invalidate(keys: string[]): Promise<number> {
    if (!this.isEnabled || keys.length === 0) {
      return 0;
    }

    try {
      const client = redisClient.getClient();
      const result = await client.del(...keys);

      this.metrics.deletes += result;
      logger.info('Cache INVALIDATE', {
        keysCount: keys.length,
        deletedCount: result,
      });

      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache INVALIDATE error', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Flush todo o cache (CUIDADO!)
   */
  public async flush(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      await redisClient.flushDb();
      logger.warn('Cache FLUSHED - all keys deleted');
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache FLUSH error', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Retorna estatísticas do cache
   */
  public async getStats(): Promise<CacheStats> {
    try {
      const health = await this.healthCheck();
      const total = this.metrics.hits + this.metrics.misses;
      const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

      return {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        hitRate: parseFloat(hitRate.toFixed(2)),
        keys: health.keys,
        memoryUsed: health.memoryUsed,
        uptime: health.uptime,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Cache getStats error', {
        error: (error as Error).message,
      });

      // Retorna métricas básicas em caso de erro
      const total = this.metrics.hits + this.metrics.misses;
      const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

      return {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        hitRate: parseFloat(hitRate.toFixed(2)),
        keys: 0,
        memoryUsed: '0B',
        uptime: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Health check do Redis
   */
  public async healthCheck(): Promise<RedisHealth> {
    return redisClient.healthCheck();
  }

  /**
   * Helpers para invalidação por tipo
   */

  /**
   * Invalida todos os relatórios de uma empresa
   */
  public async invalidateReports(companyId: string): Promise<number> {
    const pattern = `reports:${companyId}:*`;
    return this.delPattern(pattern);
  }

  /**
   * Invalida todas as accounts de uma empresa
   */
  public async invalidateAccounts(companyId: string): Promise<number> {
    const pattern = `accounts:${companyId}:*`;
    return this.delPattern(pattern);
  }

  /**
   * Invalida todos os cálculos de impostos de uma empresa
   */
  public async invalidateTaxes(companyId: string): Promise<number> {
    const pattern = `taxes:${companyId}:*`;
    return this.delPattern(pattern);
  }

  /**
   * Invalida dashboard de uma empresa
   */
  public async invalidateDashboard(companyId: string): Promise<number> {
    const pattern = `dashboard:${companyId}:*`;
    return this.delPattern(pattern);
  }

  /**
   * Invalida TUDO de uma empresa (flush company cache)
   */
  public async invalidateCompany(companyId: string): Promise<number> {
    const pattern = `*:${companyId}:*`;
    return this.delPattern(pattern);
  }

  /**
   * Reset métricas (útil para testes)
   */
  public resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
    logger.info('Cache metrics reset');
  }

  /**
   * Obtém métricas internas
   */
  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }
}

/**
 * Singleton instance
 */
const cacheService = new CacheService();

/**
 * Export singleton
 */
export default cacheService;

/**
 * Export class for testing
 */
export { CacheService };
