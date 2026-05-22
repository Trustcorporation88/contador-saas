/**
 * Environment Variables Security Validation
 * 
 * Valida configurações sensíveis de segurança no startup.
 * Fail fast se configurações inseguras em produção.
 * 
 * @module config/validateEnv
 */

import { envConfig } from './env';
import { logger } from '../middleware/requestLogger';

/**
 * Validação de segurança do ambiente
 */
export function validateEnvironmentSecurity(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = envConfig.nodeEnv === 'production';

  logger.info('Validating environment security...', {
    environment: envConfig.nodeEnv,
  });

  // CRÍTICO: JWT_SECRET não pode ser valor padrão em produção
  if (isProd && (
    envConfig.jwt.secret === 'change-me-in-prod' ||
    envConfig.jwt.secret === 'your_super_secret_jwt_key_change_in_production' ||
    envConfig.jwt.secret.length < 32
  )) {
    errors.push(
      'JWT_SECRET is using default or weak value in production. ' +
      'Set a strong random secret (min 32 characters).'
    );
  }

  // CRÍTICO: REFRESH_TOKEN_SECRET deve ser diferente do JWT_SECRET
  if (envConfig.jwt.refreshSecret === envConfig.jwt.secret) {
    warnings.push(
      'JWT_REFRESH_SECRET is same as JWT_SECRET. ' +
      'Use different secrets for better security.'
    );
  }

  // CRÍTICO: CORS não pode incluir "*" em produção
  if (isProd && envConfig.corsOrigin.includes('*')) {
    errors.push(
      'CORS_ORIGIN contains wildcard (*) in production. ' +
      'Specify exact allowed origins.'
    );
  }

  // CRÍTICO: CORS não pode incluir "localhost" em produção
  if (isProd && envConfig.corsOrigin.toLowerCase().includes('localhost')) {
    warnings.push(
      'CORS_ORIGIN contains localhost in production. ' +
      'Remove development origins.'
    );
  }

  // AVISO: ADMIN_BOOTSTRAP_PASSWORD não deve estar vazio em produção
  if (isProd && !envConfig.adminBootstrapPassword) {
    warnings.push(
      'ADMIN_BOOTSTRAP_PASSWORD is empty in production. ' +
      'Set a strong admin password or disable bootstrap.'
    );
  }

  // AVISO: bcrypt rounds deve ser >= 12
  if (envConfig.bcryptRounds < 12) {
    warnings.push(
      `BCRYPT_ROUNDS is ${envConfig.bcryptRounds} (recommended: >= 12). ` +
      'Low rounds may allow brute force attacks.'
    );
  }

  // AVISO: Rate limiting deve estar habilitado em produção
  if (isProd && !envConfig.enableRateLimiting) {
    warnings.push(
      'ENABLE_RATE_LIMITING is false in production. ' +
      'Enable rate limiting to prevent abuse.'
    );
  }

  // AVISO: Audit logging deve estar habilitado em produção
  if (isProd && !envConfig.enableAuditLog) {
    warnings.push(
      'ENABLE_AUDIT_LOG is false in production. ' +
      'Enable audit logging for compliance and security.'
    );
  }

  // AVISO: 2FA deve estar habilitado em produção
  if (isProd && !envConfig.enable2FA) {
    warnings.push(
      'ENABLE_2FA is false in production. ' +
      'Enable 2FA for enhanced security.'
    );
  }

  // AVISO: Database password não deve ser valor padrão
  if (
    envConfig.database.password === 'contador_password' ||
    envConfig.database.password === 'password' ||
    envConfig.database.password === 'postgres'
  ) {
    warnings.push(
      'DATABASE_PASSWORD is using default value. ' +
      'Set a strong random password.'
    );
  }

  // AVISO: Redis password deve estar configurado em produção
  if (isProd && !envConfig.redis.password) {
    warnings.push(
      'REDIS_PASSWORD is empty in production. ' +
      'Secure Redis with a password.'
    );
  }

  // INFORMATIVO: API docs devem estar desabilitados em produção
  if (isProd && envConfig.enableApiDocs) {
    warnings.push(
      'ENABLE_API_DOCS is true in production. ' +
      'Consider disabling API docs or protecting with authentication.'
    );
  }

  // INFORMATIVO: Observability dashboard deve ter API key em produção
  if (isProd && envConfig.enableObservabilityDashboard && !envConfig.observabilityApiKey) {
    warnings.push(
      'ENABLE_OBSERVABILITY_DASHBOARD is true but OBSERVABILITY_API_KEY is empty. ' +
      'Set an API key to protect observability endpoint.'
    );
  }

  // Exibe warnings
  if (warnings.length > 0) {
    logger.warn('Environment security warnings:', { count: warnings.length });
    warnings.forEach((warning, index) => {
      logger.warn(`Warning ${index + 1}/${warnings.length}:`, { message: warning });
    });
  }

  // Exibe errors e fail fast
  if (errors.length > 0) {
    logger.error('Environment security validation FAILED:', { count: errors.length });
    errors.forEach((error, index) => {
      logger.error(`Error ${index + 1}/${errors.length}:`, { message: error });
    });

    // Fail fast em produção
    if (isProd) {
      throw new Error(
        `Environment security validation failed with ${errors.length} critical errors. ` +
        'See logs for details. Server will not start.'
      );
    } else {
      // Em dev, apenas warning
      logger.warn(
        'Environment security validation found errors but continuing in development mode.',
        { errors: errors.length }
      );
    }
  }

  // Sucesso
  const summary = {
    errors: errors.length,
    warnings: warnings.length,
    status: errors.length === 0 ? 'PASS' : (isProd ? 'FAIL' : 'PASS_WITH_ERRORS'),
  };

  logger.info('Environment security validation completed', summary);

  if (errors.length === 0 && warnings.length === 0) {
    logger.info('✓ All security checks passed');
  }
}

/**
 * Valida que todas variáveis obrigatórias estão presentes
 * (Joi já faz isso no env.ts, mas duplicamos para segurança)
 */
export function validateRequiredEnvVars(): void {
  const required = [
    'DATABASE_URL',
    'DATABASE_PASSWORD',
    'JWT_SECRET',
  ];

  const missing: string[] = [];

  for (const varName of required) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(message);
    throw new Error(message);
  }
}

/**
 * Valida configurações de produção
 */
export function validateProductionConfig(): void {
  if (envConfig.nodeEnv !== 'production') {
    return; // Skip em dev/test
  }

  const checks: Array<{ condition: boolean; message: string }> = [
    {
      condition: envConfig.jwt.secret.length >= 32,
      message: 'JWT_SECRET must be at least 32 characters in production',
    },
    {
      condition: !envConfig.corsOrigin.includes('*'),
      message: 'CORS_ORIGIN cannot include wildcard in production',
    },
    {
      condition: envConfig.enableRateLimiting,
      message: 'ENABLE_RATE_LIMITING must be true in production',
    },
    {
      condition: envConfig.bcryptRounds >= 12,
      message: 'BCRYPT_ROUNDS must be >= 12 in production',
    },
  ];

  const failed = checks.filter((check) => !check.condition);

  if (failed.length > 0) {
    logger.error('Production configuration validation failed:', {
      failures: failed.map((f) => f.message),
    });

    throw new Error(
      `Production configuration invalid: ${failed.length} checks failed. See logs for details.`
    );
  }

  logger.info('✓ Production configuration validated successfully');
}

/**
 * Executa todas validações
 */
export function validateEnvironment(): void {
  logger.info('Starting environment validation...');

  try {
    validateRequiredEnvVars();
    validateEnvironmentSecurity();
    validateProductionConfig();

    logger.info('✓ Environment validation completed successfully');
  } catch (error) {
    logger.error('Environment validation failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export default {
  validateEnvironment,
  validateEnvironmentSecurity,
  validateRequiredEnvVars,
  validateProductionConfig,
};
