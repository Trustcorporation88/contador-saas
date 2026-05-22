/**
 * Health Controller
 * Health check endpoints para monitoring e observability
 */

import { Request, Response } from 'express';
import cacheService from '../services/cache/cacheService';
import redisClient from '../services/cache/redisClient';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import { getBlacklistStats } from '../services/cache/tokenBlacklist';

/**
 * API metrics (in-memory tracking)
 */
const apiMetrics = {
  totalRequests: 0,
  errorRequests: 0,
  startTime: Date.now(),
  lastRequest: Date.now(),
};

export function trackRequest(isError: boolean = false) {
  apiMetrics.totalRequests++;
  if (isError) apiMetrics.errorRequests++;
  apiMetrics.lastRequest = Date.now();
}

export class HealthController {
  /**
   * GET /api/v1/health
   * Health check completo da aplicação
   */
  static async health(req: Request, res: Response): Promise<void> {
    try {
      const checks = await Promise.allSettled([
        HealthController.checkDatabase(),
        HealthController.checkRedis(),
        HealthController.checkAPI(),
      ]);

      const databaseCheck = checks[0].status === 'fulfilled' ? checks[0].value : { status: 'fail', error: (checks[0] as PromiseRejectedResult).reason };
      const redisCheck = checks[1].status === 'fulfilled' ? checks[1].value : { status: 'fail', error: (checks[1] as PromiseRejectedResult).reason };
      const apiCheck = checks[2].status === 'fulfilled' ? checks[2].value : { status: 'fail', error: (checks[2] as PromiseRejectedResult).reason };

      // Determina status geral
      const allHealthy = databaseCheck.status === 'pass' && redisCheck.status === 'pass' && apiCheck.status === 'pass';
      const anyUnhealthy = databaseCheck.status === 'fail' || redisCheck.status === 'fail';
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      let httpStatus: number;

      if (allHealthy) {
        overallStatus = 'healthy';
        httpStatus = 200;
      } else if (anyUnhealthy) {
        overallStatus = 'unhealthy';
        httpStatus = 503;
      } else {
        overallStatus = 'degraded';
        httpStatus = 200;
      }

      res.status(httpStatus).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: {
            status: databaseCheck.status,
            latency: databaseCheck.latency,
            connections: databaseCheck.connections,
            error: databaseCheck.error,
          },
          redis: {
            status: redisCheck.status,
            latency: redisCheck.latency,
            memory: redisCheck.memory,
            error: redisCheck.error,
          },
          api: {
            status: apiCheck.status,
            requests: apiCheck.requests,
            error: apiCheck.error,
          },
        },
        checks: [
          {
            name: 'database_connection',
            status: databaseCheck.status,
            duration: databaseCheck.latency,
          },
          {
            name: 'redis_connection',
            status: redisCheck.status,
            duration: redisCheck.latency,
          },
          {
            name: 'api_health',
            status: apiCheck.status,
            value: apiCheck.requests?.errorRate || '0%',
          },
        ],
      });
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  }

  /**
   * Checa saúde do database (PostgreSQL)
   */
  private static async checkDatabase(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const db = getDatabase();
      
      // Simple query para testar conexão
      await db.raw('SELECT 1 as health_check');
      
      // Pool info
      const pool = (db.client as any).pool;
      const connections = {
        active: pool?.numUsed() || 0,
        idle: pool?.numFree() || 0,
        max: pool?.max || 10,
      };

      const latency = Date.now() - startTime;

      return {
        status: 'pass',
        latency,
        connections,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('Database health check failed', { error: (error as Error).message });
      
      return {
        status: 'fail',
        latency,
        error: (error as Error).message,
        connections: { active: 0, idle: 0, max: 0 },
      };
    }
  }

  /**
   * Checa saúde do Redis
   */
  private static async checkRedis(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const health = await redisClient.healthCheck();
      const latency = Date.now() - startTime;

      if (!health.connected) {
        return {
          status: 'fail',
          latency,
          error: health.error || 'Not connected',
          memory: null,
        };
      }

      // Busca stats do blacklist
      const blacklistStats = await getBlacklistStats();

      return {
        status: 'pass',
        latency,
        memory: {
          used: health.memoryUsed,
          peak: health.memoryUsedPeak || health.memoryUsed,
        },
        blacklist: {
          tokens: blacklistStats.tokenCount,
          users: blacklistStats.userCount,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('Redis health check failed', { error: (error as Error).message });
      
      return {
        status: 'fail',
        latency,
        error: (error as Error).message,
        memory: null,
      };
    }
  }

  /**
   * Checa saúde da API
   */
  private static async checkAPI(): Promise<any> {
    try {
      const { totalRequests, errorRequests, startTime, lastRequest } = apiMetrics;
      const uptime = Date.now() - startTime;
      const requestRate = totalRequests / (uptime / 1000); // req/s
      const errorRate = totalRequests > 0 ? ((errorRequests / totalRequests) * 100).toFixed(2) : '0.00';

      // API é unhealthy se error rate > 5%
      const status = parseFloat(errorRate) > 5 ? 'warn' : 'pass';

      return {
        status,
        requests: {
          total: totalRequests,
          errors: errorRequests,
          rate: parseFloat(requestRate.toFixed(2)),
          errorRate: `${errorRate}%`,
        },
      };
    } catch (error) {
      return {
        status: 'fail',
        error: (error as Error).message,
        requests: null,
      };
    }
  }

  /**
   * GET /api/v1/health/cache
   * Health check detalhado do sistema de cache Redis
   */
  static async cacheHealth(req: Request, res: Response): Promise<void> {
    try {
      // Get Redis health
      const redisHealth = await redisClient.healthCheck();
      
      // Get cache statistics
      const stats = await cacheService.getStats();
      
      // Get internal metrics
      const metrics = cacheService.getMetrics();

      // Determine overall status
      const status = redisHealth.connected ? 'healthy' : 'unhealthy';
      const httpStatus = redisHealth.connected ? 200 : 503;

      // Build response
      const response = {
        status,
        timestamp: new Date().toISOString(),
        redis: {
          connected: redisHealth.connected,
          uptime: redisHealth.uptime,
          uptimeHuman: formatUptime(redisHealth.uptime),
          memoryUsed: redisHealth.memoryUsed,
          keys: redisHealth.keys,
          error: redisHealth.error,
        },
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          hitRate: stats.hitRate,
          hitRateFormatted: `${stats.hitRate.toFixed(2)}%`,
        },
        metrics: {
          sets: metrics.sets,
          deletes: metrics.deletes,
          errors: metrics.errors,
          lastError: metrics.lastError?.message,
          lastErrorTime: metrics.lastErrorTime,
        },
        health: {
          cacheEnabled: redisHealth.connected,
          hitRateHealthy: stats.hitRate >= 50,
          noRecentErrors: !metrics.lastErrorTime || 
            (Date.now() - metrics.lastErrorTime.getTime() > 300000),
        },
      };

      // Log warning if hit rate is low
      if (stats.hitRate < 50 && stats.hits + stats.misses > 100) {
        logger.warn('Cache hit rate below threshold', {
          hitRate: stats.hitRate,
          hits: stats.hits,
          misses: stats.misses,
          threshold: 50,
        });
      }

      res.status(httpStatus).json(response);
    } catch (error) {
      logger.error('Cache health check failed', { error: (error as Error).message });
      
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/health/database
   * Health check do banco de dados (PostgreSQL)
   */
  static async databaseHealth(req: Request, res: Response): Promise<void> {
    try {
      const check = await HealthController.checkDatabase();
      const httpStatus = check.status === 'pass' ? 200 : 503;

      res.status(httpStatus).json({
        status: check.status === 'pass' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        latency: check.latency,
        connections: check.connections,
        error: check.error,
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Helper: Formata uptime de segundos para formato legível
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}
