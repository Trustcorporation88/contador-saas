import knex, { Knex } from 'knex';
import { envConfig } from './env';
import { logger } from '../middleware/requestLogger';
import { extendKnexWithTenant } from '../utils/queryBuilder';

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

  db = knex({
    client: 'pg',
    connection: {
      host: envConfig.database.host,
      port: envConfig.database.port,
      user: envConfig.database.user,
      password: envConfig.database.password,
      database: envConfig.database.name,
      connectionTimeoutMillis: envConfig.database.connectionTimeoutMillis,
    },
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
      host: envConfig.database.host,
      port: envConfig.database.port,
      database: envConfig.database.name,
      poolMin: envConfig.database.poolMin,
      poolMax: envConfig.database.poolMax,
      multiTenantEnabled: true,
    });
  } catch (error) {
    logger.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : String(error),
      host: envConfig.database.host,
    });
    throw error;
  }

  return db;
}

/**
 * Initialize database (called on server startup)
 */
export async function initializeDatabase(): Promise<void> {
  await getDatabase();
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
