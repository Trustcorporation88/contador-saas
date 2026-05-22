import 'dotenv/config';
import * as joi from 'joi';

/**
 * Environment variables validation and configuration
 * Ensures all required env vars are set and properly typed
 */

interface EnvConfig {
  // Server
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  apiVersion: string;

  // Database
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    url: string;
    poolMin: number;
    poolMax: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };

  // JWT
  jwt: {
    secret: string;
    refreshSecret: string;
    expiry: string;
    refreshExpiry: string;
    algorithm: 'HS256' | 'HS512';
  };

  // CORS
  corsOrigin: string;
  corsCredentials: boolean;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFormat: 'json' | 'simple';

  // Security
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockTimeMinutes: number;
  passwordResetTtlMinutes: number;

  // Bootstrap admin
  adminBootstrapEmail: string;
  adminBootstrapPassword: string;
  adminBootstrapForceReset: boolean;

  // Redis
  redis: {
    url: string;
    host: string;
    port: number;
    password: string;
    db: number;
    maxRetries: number;
    retryDelay: number;
    enableOfflineQueue: boolean;
    lazyConnect: boolean;
  };

  // Cache
  cache: {
    enabled: boolean;
    defaultTtl: number;
    reportsTtl: number;
    accountsTtl: number;
    taxesTtl: number;
    dashboardTtl: number;
  };
  // Legacy cache config (deprecated, use cache.*)
  cacheDefaultTtl: number;
  cacheMaxKeys: number;

  // API
  apiTimeout: number;

  // TOTP (2FA)
  totpWindow: number;
  totpIssuer: string;

  // Feature flags
  enable2FA: boolean;
  enableAuditLog: boolean;
  enableApiDocs: boolean;
  enableObservabilityDashboard: boolean;
  observabilityApiKey: string;
  enableRateLimiting: boolean;
  rateLimitRequests: number;
  rateLimitWindowMs: number;

  // AI
  deepseekApiKey: string;
  deepseekModel: string;
}

/**
 * Validate environment variables using Joi schema
 */
const envSchema = joi.object({
  NODE_ENV: joi
    .string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: joi.number().default(3000),
  HOST: joi.string().default('0.0.0.0'),
  DATABASE_URL: joi.string().required(),
  DATABASE_HOST: joi.string().default('localhost'),
  DATABASE_PORT: joi.number().default(5432),
  DATABASE_NAME: joi.string().default('contador_db'),
  DATABASE_USER: joi.string().default('contador_user'),
  DATABASE_PASSWORD: joi.string().required(),
  DATABASE_POOL_MIN: joi.number().default(2),
  DATABASE_POOL_MAX: joi.number().default(10),
  DATABASE_IDLE_TIMEOUT_MILLIS: joi.number().default(30000),
  DATABASE_CONNECTION_TIMEOUT_MILLIS: joi.number().default(2000),
  JWT_SECRET: joi.string().required(),
  JWT_REFRESH_SECRET: joi.string().default(joi.ref('JWT_SECRET')),
  JWT_EXPIRY: joi.string().default('1h'),
  JWT_REFRESH_EXPIRY: joi.string().default('7d'),
  JWT_ALGORITHM: joi.string().valid('HS256', 'HS512').default('HS256'),
  CORS_ORIGIN: joi.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: joi.boolean().default(true),
  LOG_LEVEL: joi
    .string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),
  LOG_FORMAT: joi.string().valid('json', 'simple').default('json'),
  BCRYPT_ROUNDS: joi.number().default(12),
  MAX_LOGIN_ATTEMPTS: joi.number().default(5),
  LOCK_TIME_MINUTES: joi.number().default(15),
  PASSWORD_RESET_TTL_MINUTES: joi.number().default(30),
  ADMIN_BOOTSTRAP_EMAIL: joi.string().email().default('admin@contador.dev'),
  ADMIN_BOOTSTRAP_PASSWORD: joi.string().allow('').default(''),
  ADMIN_BOOTSTRAP_FORCE_RESET: joi.boolean().default(false),
  // Redis Configuration
  REDIS_URL: joi.string().default('redis://localhost:6379'),
  REDIS_HOST: joi.string().default('localhost'),
  REDIS_PORT: joi.number().default(6379),
  REDIS_PASSWORD: joi.string().allow('').default(''),
  REDIS_DB: joi.number().default(0),
  REDIS_MAX_RETRIES: joi.number().default(3),
  REDIS_RETRY_DELAY: joi.number().default(500),
  REDIS_ENABLE_OFFLINE_QUEUE: joi.boolean().default(true),
  REDIS_LAZY_CONNECT: joi.boolean().default(false),

  // Cache Configuration
  CACHE_ENABLED: joi.boolean().default(true),
  CACHE_DEFAULT_TTL: joi.number().default(600),  // 10 minutos
  CACHE_REPORTS_TTL: joi.number().default(300),  // 5 minutos
  CACHE_ACCOUNTS_TTL: joi.number().default(900),  // 15 minutos
  CACHE_TAXES_TTL: joi.number().default(3600),  // 1 hora
  CACHE_DASHBOARD_TTL: joi.number().default(120),  // 2 minutos
  CACHE_MAX_KEYS: joi.number().default(1000),  // Legacy

  API_TIMEOUT: joi.number().default(30000),
  API_VERSION: joi.string().default('v1'),
  TOTP_WINDOW: joi.number().default(2),
  TOTP_ISSUER: joi.string().default('Contador App'),
  ENABLE_2FA: joi.boolean().default(true),
  ENABLE_AUDIT_LOG: joi.boolean().default(true),
  ENABLE_API_DOCS: joi.boolean().default(false),
  ENABLE_OBSERVABILITY_DASHBOARD: joi.boolean().default(false),
  OBSERVABILITY_API_KEY: joi.string().allow('').default(''),
  ENABLE_RATE_LIMITING: joi.boolean().default(true),
  RATE_LIMIT_REQUESTS: joi.number().default(100),
  RATE_LIMIT_WINDOW_MS: joi.number().default(900000),

  // AI — opcional, sem ela o copiloto usa motor local
  DEEPSEEK_API_KEY: joi.string().allow('').default(''),
  DEEPSEEK_MODEL: joi.string().default('deepseek-chat'),
});

/**
 * Validate and parse environment variables
 */
const { value: envVars, error } = envSchema.validate(process.env, {
  stripUnknown: true,
  convert: true,
});

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

/**
 * Export validated configuration object
 */
export const envConfig: EnvConfig = {
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  host: envVars.HOST,
  apiVersion: envVars.API_VERSION,

  database: {
    host: envVars.DATABASE_HOST,
    port: envVars.DATABASE_PORT,
    name: envVars.DATABASE_NAME,
    user: envVars.DATABASE_USER,
    password: envVars.DATABASE_PASSWORD,
    url: envVars.DATABASE_URL,
    poolMin: envVars.DATABASE_POOL_MIN,
    poolMax: envVars.DATABASE_POOL_MAX,
    idleTimeoutMillis: envVars.DATABASE_IDLE_TIMEOUT_MILLIS,
    connectionTimeoutMillis: envVars.DATABASE_CONNECTION_TIMEOUT_MILLIS,
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    expiry: envVars.JWT_EXPIRY,
    refreshExpiry: envVars.JWT_REFRESH_EXPIRY,
    algorithm: envVars.JWT_ALGORITHM,
  },

  corsOrigin: envVars.CORS_ORIGIN,
  corsCredentials: envVars.CORS_CREDENTIALS,

  logLevel: envVars.LOG_LEVEL,
  logFormat: envVars.LOG_FORMAT,

  bcryptRounds: envVars.BCRYPT_ROUNDS,
  maxLoginAttempts: envVars.MAX_LOGIN_ATTEMPTS,
  lockTimeMinutes: envVars.LOCK_TIME_MINUTES,
  passwordResetTtlMinutes: envVars.PASSWORD_RESET_TTL_MINUTES,
  adminBootstrapEmail: envVars.ADMIN_BOOTSTRAP_EMAIL,
  adminBootstrapPassword: envVars.ADMIN_BOOTSTRAP_PASSWORD,
  adminBootstrapForceReset: envVars.ADMIN_BOOTSTRAP_FORCE_RESET,

  redis: {
    url: envVars.REDIS_URL,
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
    maxRetries: envVars.REDIS_MAX_RETRIES,
    retryDelay: envVars.REDIS_RETRY_DELAY,
    enableOfflineQueue: envVars.REDIS_ENABLE_OFFLINE_QUEUE,
    lazyConnect: envVars.REDIS_LAZY_CONNECT,
  },

  cache: {
    enabled: envVars.CACHE_ENABLED,
    defaultTtl: envVars.CACHE_DEFAULT_TTL,
    reportsTtl: envVars.CACHE_REPORTS_TTL,
    accountsTtl: envVars.CACHE_ACCOUNTS_TTL,
    taxesTtl: envVars.CACHE_TAXES_TTL,
    dashboardTtl: envVars.CACHE_DASHBOARD_TTL,
  },

  cacheDefaultTtl: envVars.CACHE_DEFAULT_TTL,
  cacheMaxKeys: envVars.CACHE_MAX_KEYS,

  apiTimeout: envVars.API_TIMEOUT,

  totpWindow: envVars.TOTP_WINDOW,
  totpIssuer: envVars.TOTP_ISSUER,

  enable2FA: envVars.ENABLE_2FA,
  enableAuditLog: envVars.ENABLE_AUDIT_LOG,
  enableApiDocs: envVars.ENABLE_API_DOCS,
  enableObservabilityDashboard: envVars.ENABLE_OBSERVABILITY_DASHBOARD,
  observabilityApiKey: envVars.OBSERVABILITY_API_KEY,
  enableRateLimiting: envVars.ENABLE_RATE_LIMITING,
  rateLimitRequests: envVars.RATE_LIMIT_REQUESTS,
  rateLimitWindowMs: envVars.RATE_LIMIT_WINDOW_MS,

  deepseekApiKey: envVars.DEEPSEEK_API_KEY,
  deepseekModel: envVars.DEEPSEEK_MODEL,
};

export default envConfig;
