/**
 * Redis Client
 * Gerencia conexão com Redis com retry logic, health checks e graceful shutdown
 */

import Redis, { RedisOptions } from 'ioredis';
import { envConfig } from '../../config/env';
import { RedisHealth } from './types';

/**
 * Logger import - assume Winston logger exists
 * Se não existir, criamos um fallback console
 */
let logger: any;
try {
  const loggerModule = require('../../middleware/requestLogger');
  logger = loggerModule.logger;
} catch {
  // Fallback para console se logger não existir
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
}

/**
 * Classe RedisClient
 * Singleton que gerencia conexão com Redis
 */
class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;

  /**
   * Construtor privado (singleton pattern)
   */
  constructor() {
    // Não conecta automaticamente - usa lazy connect
  }

  /**
   * Obtém ou cria instância do cliente Redis
   */
  public getClient(): Redis {
    if (!this.client) {
      this.connect();
    }
    return this.client!;
  }

  /**
   * Conecta ao Redis com retry logic exponencial
   */
  public connect(): void {
    if (this.client) {
      logger.warn('Redis client already exists, skipping connection');
      return;
    }

    const options: RedisOptions = {
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      password: envConfig.redis.password || undefined,
      db: envConfig.redis.db,
      lazyConnect: envConfig.redis.lazyConnect,
      enableOfflineQueue: envConfig.redis.enableOfflineQueue,
      
      // Retry strategy com exponential backoff
      retryStrategy: (times: number) => {
        if (times > envConfig.redis.maxRetries) {
          logger.error('Redis max retries exceeded', { attempts: times });
          return null; // Stop retrying
        }

        const delay = Math.min(times * envConfig.redis.retryDelay, 5000);
        logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },

      // Reconnect on error
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect only on READONLY errors
          return true;
        }
        return false;
      },

      // Connection timeout
      connectTimeout: 10000,

      // Keep alive
      keepAlive: 30000,

      // Name for debugging
      connectionName: 'contador-backend',
    };

    logger.info('Connecting to Redis...', {
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      db: envConfig.redis.db,
    });

    this.client = new Redis(options);

    // Event listeners
    this.setupEventListeners();
  }

  /**
   * Configura event listeners do Redis
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.connectionAttempts = 0;
      logger.info('Redis connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis connection ready', {
        host: envConfig.redis.host,
        port: envConfig.redis.port,
      });
    });

    this.client.on('error', (err: Error) => {
      logger.error('Redis error', {
        error: err.message,
        stack: err.stack,
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', (delay: number) => {
      this.connectionAttempts++;
      logger.info('Redis reconnecting...', {
        attempt: this.connectionAttempts,
        delay,
      });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis connection ended');
    });
  }

  /**
   * Verifica se Redis está conectado
   */
  public get connected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Health check completo do Redis
   */
  public async healthCheck(): Promise<RedisHealth> {
    try {
      if (!this.client) {
        return {
          connected: false,
          uptime: 0,
          memoryUsed: '0B',
          keys: 0,
          timestamp: new Date(),
          error: 'Redis client not initialized',
        };
      }

      // Ping test
      const pingStart = Date.now();
      await this.client.ping();
      const pingTime = Date.now() - pingStart;

      // Get server info
      const info = await this.client.info('server');
      const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
      const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0;

      // Get memory info
      const memoryInfo = await this.client.info('memory');
      const memoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1].trim() : '0B';

      // Get key count
      const dbSize = await this.client.dbsize();

      return {
        connected: true,
        uptime,
        memoryUsed,
        keys: dbSize,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Redis health check failed', {
        error: (error as Error).message,
      });

      return {
        connected: false,
        uptime: 0,
        memoryUsed: '0B',
        keys: 0,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  /**
   * Graceful shutdown
   * Fecha conexão com Redis de forma limpa
   */
  public async disconnect(): Promise<void> {
    if (!this.client) {
      logger.warn('Redis client not connected, nothing to disconnect');
      return;
    }

    try {
      logger.info('Disconnecting from Redis...');
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from Redis', {
        error: (error as Error).message,
      });
      // Force disconnect
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  /**
   * Flush database (CUIDADO: remove TODAS as keys)
   * Apenas para testes ou manutenção
   */
  public async flushDb(): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    if (envConfig.nodeEnv === 'production') {
      throw new Error('Cannot flush database in production environment');
    }

    logger.warn('Flushing Redis database...');
    await this.client.flushdb();
    logger.info('Redis database flushed');
  }
}

/**
 * Singleton instance
 */
const redisClient = new RedisClient();

/**
 * Graceful shutdown handler
 */
const handleShutdown = async () => {
  logger.info('Received shutdown signal, closing Redis connection...');
  await redisClient.disconnect();
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

/**
 * Export singleton instance
 */
export default redisClient;

/**
 * Export class for testing
 */
export { RedisClient };
