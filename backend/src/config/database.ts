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

const DEFAULT_RENDER_POSTGRES_REGION = 'oregon';

function getRenderPostgresHostSuffix(): string {
  const region = process.env.RENDER_DB_REGION?.trim() || DEFAULT_RENDER_POSTGRES_REGION;
  return `${region}-postgres.render.com`;
}

/**
 * Corrige hostnames Render incompletos (ex: dpg-xxxxx-a sem região/postgres.render.com)
 */
function normalizeRenderDatabaseUrl(url: string): string {
  const suffix = getRenderPostgresHostSuffix();

  if (url.includes('.c.postgres.render.com')) {
    const fixed = url.replace('.c.postgres.render.com', suffix);
    logger.warn('DATABASE_URL uses deprecated Render hostname suffix; corrected region hostname', {
      suffix,
    });
    return fixed;
  }

  const incompleteHostMatch = url.match(
    /^(postgresql:\/\/[^@]+@)(dpg-[a-z0-9]+-a)(\/[^?#]*(?:\?[^#]*)?(?:#.*)?)$/i,
  );

  if (!incompleteHostMatch) {
    return url;
  }

  const [, prefix, host, path] = incompleteHostMatch;
  const normalizedHost = `${host}.${suffix}`;
  const normalized = `${prefix}${normalizedHost}:5432${path}`;

  logger.warn('DATABASE_URL hostname incomplete; auto-corrected Render external hostname', {
    originalHost: host,
    normalizedHost,
    suffix,
  });

  return normalized;
}

/**
 * Parse DATABASE_URL and ensure it's properly formatted for the client
 * Handles Render's internal hostname issue by falling back to external URL if needed
 */
function getDatabaseConnectionConfig(url: string, isProduction: boolean): any {
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  const connectionUrl = normalizeRenderDatabaseUrl(url);

  // Log the connection attempt (without password)
  const urlToParse = connectionUrl.replace(/:[^@]*@/, ':***@');
  logger.info('Attempting database connection', { url: urlToParse, isProduction });

  // For Render's internal hostnames (dpg-*), we need to ensure proper SSL handling
  // The connectionString property handles this automatically
  return {
    connectionString: connectionUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
}

/**
 * Get or create database connection pool
 * Aplica extensões multi-tenant automaticamente
 */
export async function getDatabase(): Promise<Knex> {
  if (db) {
    return db;
  }

  const isProduction = envConfig.nodeEnv === 'production';

  const normalizedDatabaseUrl = envConfig.database.url
    ? normalizeRenderDatabaseUrl(envConfig.database.url)
    : null;

  const connectionConfig = normalizedDatabaseUrl
    ? getDatabaseConnectionConfig(normalizedDatabaseUrl, isProduction)
    : {
        host: envConfig.database.host,
        port: envConfig.database.port,
        user: envConfig.database.user,
        password: envConfig.database.password,
        database: envConfig.database.name,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: envConfig.database.connectionTimeoutMillis,
      };

  const hostForLog = normalizedDatabaseUrl
    ? (normalizedDatabaseUrl.split('@')[1] || 'URL').split('/')[0]
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code || (error as any)?.errno || 'UNKNOWN';

    logger.error('Failed to connect to database', {
      error: errorMsg,
      code: errorCode,
      host: hostForLog,
      isProduction,
      databaseUrl: envConfig.database.url ? '***' : 'not-set',
      suggestion:
        errorMsg.includes('ENOTFOUND') || errorCode === 'ENOTFOUND'
          ? `Database hostname not found (${hostForLog}). Copy the full External Database URL from Render PostgreSQL → Connections, or set RENDER_DB_REGION if the database is in another region.`
          : errorMsg.includes('ECONNREFUSED') || errorCode === 'ECONNREFUSED'
            ? 'Connection refused - database service may not be running'
            : 'Unknown error - check DATABASE_URL format',
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
