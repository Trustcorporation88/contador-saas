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

interface ParsedPostgresUrl {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

interface ConnectionAttempt {
  name: string;
  hostForLog: string;
  config: Record<string, unknown>;
}

function getRenderPostgresHostSuffix(): string {
  const region = process.env.RENDER_DB_REGION?.trim() || DEFAULT_RENDER_POSTGRES_REGION;
  return `${region}-postgres.render.com`;
}

function isRunningOnRender(): boolean {
  return Boolean(process.env.RENDER);
}

function isIncompleteRenderHost(host: string): boolean {
  return /^dpg-[a-z0-9-]+-a$/i.test(host);
}

function parsePostgresDatabaseUrl(url: string): ParsedPostgresUrl {
  const normalized = url.replace(/^postgres(ql)?:\/\//i, 'http://');
  const parsed = new URL(normalized);

  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
  };
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:[^@]*@/, ':***@');
}

/**
 * Build ordered connection strategies for Render Postgres URLs.
 * Internal URL (private network) is tried before external when running on Render.
 */
function buildConnectionAttempts(rawUrl: string, isProduction: boolean): ConnectionAttempt[] {
  const parsed = parsePostgresDatabaseUrl(rawUrl);
  const suffix = getRenderPostgresHostSuffix();
  const onRender = isRunningOnRender();
  const attempts: ConnectionAttempt[] = [];

  const baseConfig = {
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    connectionTimeoutMillis: envConfig.database.connectionTimeoutMillis,
  };

  if (isIncompleteRenderHost(parsed.host)) {
    if (onRender) {
      attempts.push({
        name: 'render-internal',
        hostForLog: `${parsed.host}:5432`,
        config: {
          ...baseConfig,
          host: parsed.host,
          port: 5432,
          ssl: false,
        },
      });
    }

    attempts.push({
      name: 'render-external',
      hostForLog: `${parsed.host}.${suffix}:5432`,
      config: {
        ...baseConfig,
        host: `${parsed.host}.${suffix}`,
        port: 5432,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      },
    });

    return attempts;
  }

  const useSsl =
    isProduction &&
    parsed.host !== 'localhost' &&
    !parsed.host.endsWith('.internal') &&
    !parsed.host.startsWith('postgres');

  attempts.push({
    name: 'direct',
    hostForLog: `${parsed.host}:${parsed.port}`,
    config: {
      ...baseConfig,
      host: parsed.host,
      port: parsed.port,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    },
  });

  return attempts;
}

function getConnectionErrorSuggestion(errorMsg: string, errorCode: string, onRender: boolean): string {
  if (errorMsg.includes('ENOTFOUND') || errorCode === 'ENOTFOUND') {
    return onRender
      ? 'Database hostname not found. Ensure backend and PostgreSQL are in the same Render region, or remove the manual DATABASE_URL override and link the database via Blueprint (fromDatabase).'
      : 'Database hostname not found. Copy the full External Database URL from Render PostgreSQL → Connect.';
  }

  if (errorMsg.includes('ECONNREFUSED') || errorCode === 'ECONNREFUSED') {
    return 'Connection refused - database service may not be running or is suspended.';
  }

  if (
    errorMsg.includes('Connection terminated unexpectedly') ||
    errorMsg.includes('password authentication failed') ||
    errorMsg.includes('28P01')
  ) {
    return onRender
      ? 'Connection rejected. Delete the manual DATABASE_URL in Render Environment and use the Internal Database URL from PostgreSQL → Connect (or link via fromDatabase in render.yaml).'
      : 'Connection rejected. Verify DATABASE_URL credentials and use the External Database URL from Render.';
  }

  return 'Check DATABASE_URL format and credentials in the Render dashboard.';
}

function createKnexInstance(connectionConfig: Record<string, unknown>): Knex {
  return knex({
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
  const onRender = isRunningOnRender();

  if (!envConfig.database.url) {
    const connectionConfig = {
      host: envConfig.database.host,
      port: envConfig.database.port,
      user: envConfig.database.user,
      password: envConfig.database.password,
      database: envConfig.database.name,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: envConfig.database.connectionTimeoutMillis,
    };

    db = createKnexInstance(connectionConfig);
    extendKnexWithTenant(db);
    await db.raw('SELECT 1');
    return db;
  }

  const attempts = buildConnectionAttempts(envConfig.database.url, isProduction);
  let lastError: unknown;

  for (const attempt of attempts) {
    let candidate: Knex | null = null;

    try {
      logger.info('Attempting database connection', {
        strategy: attempt.name,
        host: attempt.hostForLog,
        url: maskDatabaseUrl(envConfig.database.url),
        isProduction,
        onRender,
      });

      candidate = createKnexInstance(attempt.config);
      extendKnexWithTenant(candidate);
      await candidate.raw('SELECT 1');

      db = candidate;
      logger.info('Database connection pool initialized', {
        strategy: attempt.name,
        host: attempt.hostForLog,
        database: envConfig.database.name,
        poolMin: envConfig.database.poolMin,
        poolMax: envConfig.database.poolMax,
        ssl: Boolean(attempt.config.ssl),
        multiTenantEnabled: true,
      });

      return db;
    } catch (error) {
      lastError = error;

      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string }).code || 'UNKNOWN';

      logger.warn('Database connection attempt failed', {
        strategy: attempt.name,
        host: attempt.hostForLog,
        error: errorMsg,
        code: errorCode,
      });

      if (candidate) {
        await candidate.destroy();
      }
    }
  }

  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  const errorCode = (lastError as { code?: string })?.code || 'UNKNOWN';
  const lastAttempt = attempts[attempts.length - 1];

  logger.error('Failed to connect to database', {
    error: errorMsg,
    code: errorCode,
    host: lastAttempt?.hostForLog,
    isProduction,
    onRender,
    databaseUrl: '***',
    suggestion: getConnectionErrorSuggestion(errorMsg, errorCode, onRender),
  });

  throw lastError instanceof Error ? lastError : new Error(errorMsg);
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
