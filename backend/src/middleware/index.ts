/**
 * Middleware Index
 * Central point for all middleware setup and registration
 * Integrates authentication, multi-tenancy, error handling, and logging
 */

import { Express, Request, Response, NextFunction } from 'express';
import { authenticateToken } from './auth';
import { validateTenantAccess, rateLimitByTenant } from './multiTenant';
import { errorHandler } from './errorHandler';
import { requestLogger } from './requestLogger';
import { logger } from './requestLogger';

/**
 * Setup all middlewares on Express app
 * Order matters: logging → rate limit → auth → tenant validation → error handling
 */
export function setupMiddlewares(app: Express): void {
  // 1. Request logging (first, captures everything)
  app.use(requestLogger);

  // 2. Parse JSON bodies
  app.use((req, res, next) => {
    // Built-in Express middleware configured elsewhere
    next();
  });

  // 3. Rate limiting per tenant (general)
  // 100 requests per minute per company
  app.use(rateLimitByTenant(100, 60000));

  // 4. Authentication (JWT validation)
  // All routes below this require valid JWT
  app.use(authenticateToken);

  logger.info('Global middleware stack configured', {
    middleware: [
      'requestLogger',
      'rateLimitByTenant',
      'authenticateToken',
    ],
  });
}

/**
 * Setup multi-tenant middleware for protected routes
 * Deve ser aplicado a rotas específicas que precisam de tenant scoping
 *
 * Uso em routes:
 * app.use('/api/v1/companies/:companyId', applyMultiTenantMiddleware())
 */
export function applyMultiTenantMiddleware() {
  return [
    // 1. Validar acesso do tenant
    validateTenantAccess,

    // 2. Rate limiting por tenant (mais apertado)
    // 50 requests per minute per company for scoped routes
    rateLimitByTenant(50, 60000),
  ];
}

/**
 * Setup error handling (must be last)
 * Captura todos os erros não tratados
 */
export function setupErrorHandling(app: Express): void {
  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      code: 'NOT_FOUND',
      message: 'The requested resource does not exist',
      path: req.path,
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  logger.info('Error handling middleware configured');
}

/**
 * Middleware factory: validar que request tem tenant context
 * Usado internamente por endpoints protegidos
 */
export function requireTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.tenant) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'TENANT_CONTEXT_MISSING',
      message: 'Tenant context not found. Apply validateTenantAccess middleware.',
    });
    return;
  }

  next();
}

/**
 * Middleware factory: validar que request é de usuário autenticado
 * Mais restritivo que authenticateToken
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    });
    return;
  }

  next();
}

/**
 * Export middleware functions for external use
 */
export {
  authenticateToken,
  validateTenantAccess,
  rateLimitByTenant,
  errorHandler,
  requestLogger,
};
