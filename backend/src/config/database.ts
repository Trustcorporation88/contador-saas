import knex, { Knex } from 'knex';
import { envConfig } from './env';
import { logger } from '../middleware/requestLogger';
import { extendKnexWithTenant } from '../utils/queryBuilder';
import { runMigrationsIfNeeded } from '../utils/migrationRunner';

/**
 * PostgreSQL connection pool configuration
 * Uses Knex.js for query building and connection management
 * Includes multi-tenancy extensions via queryBuilder
 */

let db: Knex | null = null;

/**
 * Get or create database connection pool
 * Aplica extensões multi-tenant automaticamente
 */
export async function getDatabase(): Promise<Knex> {
  if (db) {
    return db;
  }

  const isProduction = envConfig.nodeEnv === 'production';

  const connectionConfig = envConfig.database.url
    ? {
        connectionString: envConfig.database.url,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      }
    : {
        host: envConfig.database.host,
        port: envConfig.database.port,
        user: envConfig.database.user,
        password: envConfig.database.password,
        database: envConfig.database.name,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: envConfig.database.connectionTimeoutMillis,
      };

  const hostForLog = envConfig.database.url
    ? (envConfig.database.url.split('@')[1] || 'URL').split('/')[0]
    : envConfig.database.host;

  db = knex({
    client: 'pg',
    connection: connectionConfig,
    pool: {
      min: envConfig.database.poolMin,
      max: envConfig.database.poolMax,
      idleTimeoutMillis: envConfig.database.idleTimeoutMillis,
      acquireTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
    },
    acquireConnectionTimeout: 30000,
  });

  // Apply multi-tenant extensions
  extendKnexWithTenant(db);

  // Test connection
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection pool initialized', {
      host: hostForLog,
      database: envConfig.database.name,
      poolMin: envConfig.database.poolMin,
      poolMax: envConfig.database.poolMax,
      ssl: !!isProduction,
      multiTenantEnabled: true,
    });
  } catch (error) {
    logger.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : String(error),
      host: hostForLog,
      isProduction,
    });
    throw error;
  }

  return db;
}

/**
 * Initialize database (called on server startup)
 */
export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();
  console.log('[DATABASE] Running migrations...');
  await runMigrationsIfNeeded(database);
  console.log('[DATABASE] Migrations completed');
}

/**
 * Close database connections (for graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database connections closed');
  }
}

export default getDatabase;
