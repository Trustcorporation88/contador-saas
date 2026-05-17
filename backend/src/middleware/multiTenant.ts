/**
 * Multi-Tenancy Middleware
 * Valida company_id do JWT, acesso do usuário à empresa e injeta tenant context
 * Implementa row-level security para isolamento de dados por tenant
 */

import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import { logger } from './requestLogger';
import { ERROR_CODES, HTTP_STATUS } from '../config/constants';

/**
 * Tenant Context - Informações de tenancy injetadas em req.tenant
 */
export interface TenantContext {
  companyId: string;
  userId: string;
  role: string;
  permissions: string[];
  issuedAt: number;
  expiresAt: number;
}

/**
 * Extend Express Request com tenant context
 */
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Valida que usuário tem acesso à empresa (company_users)
 * Checa role/permissions da associação
 * Injeta tenant context em req.tenant
 *
 * FLOW:
 * 1. Valida que JWT contém company_id
 * 2. Valida que :companyId path param existe
 * 3. Valida que :companyId === JWT.company_id OU user está em company_users
 * 4. Checa permissões do user para a empresa
 * 5. Injeta req.tenant com context completo
 *
 * Returns 403 Forbidden se:
 * - User não está em company_users
 * - User não tem permissão
 * - JWT.company_id ≠ path.company_id (sem fallback em company_users)
 */
export async function validateTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Validar que user foi autenticado anteriormente por validateAuth middleware
    if (!req.user) {
      logger.warn('Multi-tenant middleware called without authenticated user');
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'User authentication required',
      });
      return;
    }

    // Extrair company_id do path parameter (:companyId)
    const pathCompanyId = req.params.companyId;

    // Se houver um companyId no path, é uma requisição específica de tenant
    if (pathCompanyId) {
      await validatePathCompanyAccess(req, res, next, pathCompanyId);
    } else {
      // Se não houver companyId no path, usar o company_id do JWT
      await validateJWTCompanyAccess(req, res, next);
    }
  } catch (error) {
    logger.error('Error in validateTenantAccess middleware', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      companyId: req.params.companyId,
    });

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal Server Error',
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An error occurred while validating tenant access',
    });
  }
}

/**
 * Valida acesso quando há um companyId específico no path
 * Regra: user pode acessar se:
 * 1. JWT.company_id === path.companyId, OU
 * 2. user está em company_users com essa empresa
 */
async function validatePathCompanyAccess(
  req: Request,
  res: Response,
  next: NextFunction,
  pathCompanyId: string,
): Promise<void> {
  const db = await getDatabase();
  const userId = req.user!.id;
  const jwtCompanyId = req.user!.companyId;

  // Validar formato do company_id
  if (!pathCompanyId || typeof pathCompanyId !== 'string') {
    logger.warn('Invalid company ID format in path', {
      pathCompanyId,
      userId,
    });
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Invalid Request',
      code: ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid company ID format',
    });
    return;
  }

  // Primeiro check: JWT company_id corresponde?
  if (jwtCompanyId === pathCompanyId) {
    // Validar que user realmente está em company_users (dupla verificação)
    const userCompany = await db('company_users')
      .select('id', 'user_id', 'company_id', 'role', 'permissions')
      .where('user_id', userId)
      .where('company_id', pathCompanyId)
      .first();

    if (!userCompany) {
      logger.warn('User not found in company_users', {
        userId,
        companyId: pathCompanyId,
      });
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Forbidden',
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have access to this company',
      });
      return;
    }

    // Parse permissions (stored as JSON in DB)
    let permissions: string[] = [];
    try {
      permissions = typeof userCompany.permissions === 'string'
        ? JSON.parse(userCompany.permissions)
        : userCompany.permissions || [];
    } catch (e) {
      permissions = [];
    }

    // Injetar tenant context
    req.tenant = {
      companyId: pathCompanyId,
      userId,
      role: userCompany.role,
      permissions,
      issuedAt: req.tokenMetadata?.issuedAt || Math.floor(Date.now() / 1000),
      expiresAt: req.tokenMetadata?.expiresAt || Math.floor(Date.now() / 1000) + 3600,
    };

    logger.info('Tenant access validated (JWT company match)', {
      userId,
      companyId: pathCompanyId,
      role: userCompany.role,
    });

    next();
    return;
  }

  // Segundo check: user está em company_users com essa empresa?
  const userCompany = await db('company_users')
    .select('id', 'user_id', 'company_id', 'role', 'permissions')
    .where('user_id', userId)
    .where('company_id', pathCompanyId)
    .first();

  if (!userCompany) {
    logger.warn('User access denied - not in company_users', {
      userId,
      jwtCompanyId,
      pathCompanyId,
    });

    // Audit: log tentativa de acesso negada
    await auditAccessDenial(db, userId, pathCompanyId, 'NOT_IN_COMPANY_USERS');

    res.status(HTTP_STATUS.FORBIDDEN).json({
      error: 'Forbidden',
      code: ERROR_CODES.FORBIDDEN,
      message: 'You do not have access to this company',
    });
    return;
  }

  // Parse permissions
  let permissions: string[] = [];
  try {
    permissions = typeof userCompany.permissions === 'string'
      ? JSON.parse(userCompany.permissions)
      : userCompany.permissions || [];
  } catch (e) {
    permissions = [];
  }

  // Injetar tenant context
  req.tenant = {
    companyId: pathCompanyId,
    userId,
    role: userCompany.role,
    permissions,
    issuedAt: req.tokenMetadata?.issuedAt || Math.floor(Date.now() / 1000),
    expiresAt: req.tokenMetadata?.expiresAt || Math.floor(Date.now() / 1000) + 3600,
  };

  logger.info('Tenant access validated (company_users fallback)', {
    userId,
    companyId: pathCompanyId,
    role: userCompany.role,
  });

  next();
}

/**
 * Valida acesso usando apenas o company_id do JWT
 * Usado quando não há companyId específico no path
 */
async function validateJWTCompanyAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const db = await getDatabase();
  const userId = req.user!.id;
  const jwtCompanyId = req.user!.companyId;

  // Validar que JWT contém company_id válido
  if (!jwtCompanyId || typeof jwtCompanyId !== 'string') {
    logger.warn('Invalid company ID in JWT', {
      userId,
      jwtCompanyId,
    });
    res.status(HTTP_STATUS.FORBIDDEN).json({
      error: 'Forbidden',
      code: ERROR_CODES.FORBIDDEN,
      message: 'Your JWT token does not contain a valid company ID',
    });
    return;
  }

  // Verificar que user está em company_users com essa empresa
  const userCompany = await db('company_users')
    .select('id', 'user_id', 'company_id', 'role', 'permissions')
    .where('user_id', userId)
    .where('company_id', jwtCompanyId)
    .first();

  if (!userCompany) {
    logger.warn('User not in company_users (JWT company)', {
      userId,
      companyId: jwtCompanyId,
    });

    // Audit
    await auditAccessDenial(db, userId, jwtCompanyId, 'NOT_IN_COMPANY_USERS');

    res.status(HTTP_STATUS.FORBIDDEN).json({
      error: 'Forbidden',
      code: ERROR_CODES.FORBIDDEN,
      message: 'You do not have access to this company',
    });
    return;
  }

  // Parse permissions
  let permissions: string[] = [];
  try {
    permissions = typeof userCompany.permissions === 'string'
      ? JSON.parse(userCompany.permissions)
      : userCompany.permissions || [];
  } catch (e) {
    permissions = [];
  }

  // Injetar tenant context
  req.tenant = {
    companyId: jwtCompanyId,
    userId,
    role: userCompany.role,
    permissions,
    issuedAt: req.tokenMetadata?.issuedAt || Math.floor(Date.now() / 1000),
    expiresAt: req.tokenMetadata?.expiresAt || Math.floor(Date.now() / 1000) + 3600,
  };

  logger.info('Tenant access validated (JWT)', {
    userId,
    companyId: jwtCompanyId,
    role: userCompany.role,
  });

  next();
}

/**
 * Checa se user tem permissão específica na empresa
 * Pode ser usado em middleware mais específico
 */
export async function checkPermission(
  userId: string,
  companyId: string,
  action: string,
): Promise<boolean> {
  try {
    const db = await getDatabase();

    const userCompany = await db('company_users')
      .select('permissions')
      .where('user_id', userId)
      .where('company_id', companyId)
      .first();

    if (!userCompany) {
      return false;
    }

    let permissions: string[] = [];
    try {
      permissions = typeof userCompany.permissions === 'string'
        ? JSON.parse(userCompany.permissions)
        : userCompany.permissions || [];
    } catch (e) {
      return false;
    }

    return permissions.includes(action);
  } catch (error) {
    logger.error('Error checking permission', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      companyId,
      action,
    });
    return false;
  }
}

/**
 * Middleware para validar permissão específica
 * Uso: app.get('/endpoint', validatePermission('write'))
 */
export function requirePermission(requiredPermission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenant) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Tenant context not found',
      });
      return;
    }

    if (!req.tenant.permissions.includes(requiredPermission)) {
      logger.warn('Permission denied', {
        userId: req.tenant.userId,
        companyId: req.tenant.companyId,
        requiredPermission,
        userPermissions: req.tenant.permissions,
      });

      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Forbidden',
        code: ERROR_CODES.FORBIDDEN,
        message: `You do not have the '${requiredPermission}' permission for this company`,
      });
      return;
    }

    next();
  };
}

/**
 * Audit logging para tentativas de acesso negadas
 * Detecta atividade suspeita (múltiplas tentativas, acesso a empresas diferentes, etc)
 */
async function auditAccessDenial(
  db: any,
  userId: string,
  companyId: string,
  reason: string,
): Promise<void> {
  try {
    // Log em tabela de audit
    await db('access_audit').insert({
      user_id: userId,
      company_id: companyId,
      action: 'ACCESS_DENIED',
      reason,
      timestamp: new Date(),
      ip_address: process.env.CLIENT_IP || 'unknown',
    });

    // Detectar padrões suspeitos
    // Múltiplas negações na mesma empresa em curto tempo = ataque potencial
    const recentDenials = await db('access_audit')
      .count('* as count')
      .where('user_id', userId)
      .where('company_id', companyId)
      .where('action', 'ACCESS_DENIED')
      .where('timestamp', '>', new Date(Date.now() - 5 * 60000)) // últimos 5 min
      .first();

    if (recentDenials?.count > 5) {
      logger.warn('SUSPICIOUS ACTIVITY: Multiple access denials detected', {
        userId,
        companyId,
        denialCount: recentDenials.count,
      });

      // Trigger alerta (pode ser integrado com sistema de notificações)
    }
  } catch (error) {
    // Não falhar a requisição por erro em audit
    logger.error('Error recording access audit', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      companyId,
    });
  }
}

/**
 * Rate limiting por tenant
 * Evita DoS attacks focados em um tenant específico
 *
 * Pode ser usado como middleware separado:
 * app.use(rateLimitByTenant(100, '1m')) // 100 req por minuto por tenant
 */
const tenantRateLimits = new Map<string, { count: number; resetTime: Date }>();

export function rateLimitByTenant(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next();
      return;
    }

    const key = `${req.tenant.companyId}:${req.tenant.userId}`;
    const now = new Date();
    const limit = tenantRateLimits.get(key);

    // Se limite não existe ou expirou, criar novo
    if (!limit || limit.resetTime < now) {
      tenantRateLimits.set(key, {
        count: 1,
        resetTime: new Date(now.getTime() + windowMs),
      });
      next();
      return;
    }

    // Incrementar contador
    limit.count++;

    // Se excedeu limite
    if (limit.count > maxRequests) {
      logger.warn('Rate limit exceeded for tenant', {
        companyId: req.tenant.companyId,
        userId: req.tenant.userId,
        requestCount: limit.count,
        maxRequests,
      });

      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'You have exceeded the rate limit for this company',
        retryAfter: Math.ceil((limit.resetTime.getTime() - now.getTime()) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Logging de acesso bem-sucedido
 * Chamado após validação bem-sucedida de tenant
 */
export async function logTenantAccess(
  userId: string,
  companyId: string,
  action: string,
  details?: any,
): Promise<void> {
  try {
    const db = await getDatabase();

    await db('access_audit').insert({
      user_id: userId,
      company_id: companyId,
      action,
      reason: 'ACCESS_GRANTED',
      details: details ? JSON.stringify(details) : null,
      timestamp: new Date(),
      ip_address: process.env.CLIENT_IP || 'unknown',
    });
  } catch (error) {
    logger.error('Error logging tenant access', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      companyId,
    });
  }
}
