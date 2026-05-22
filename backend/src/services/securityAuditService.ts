/**
 * Security Audit Service
 * 
 * Registra eventos críticos de segurança no database para auditoria e análise.
 * Complementa o audit_logs existente com foco em segurança.
 * 
 * @module services/securityAuditService
 */

import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';

/**
 * Tipos de eventos de segurança
 */
export enum SecurityEventType {
  FAILED_LOGIN = 'FAILED_LOGIN',
  SUCCESSFUL_LOGIN = 'SUCCESSFUL_LOGIN',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  RATE_LIMIT_HIT = 'RATE_LIMIT_HIT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
}

/**
 * Níveis de severidade
 */
export enum SecuritySeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Interface para evento de segurança
 */
export interface SecurityAuditEvent {
  eventType: SecurityEventType;
  userId?: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: SecuritySeverity;
}

/**
 * Registra evento de segurança
 */
export async function logSecurityEvent(event: SecurityAuditEvent): Promise<void> {
  try {
    const db = getDatabase();

    // Verifica se tabela existe
    const tableExists = await db.schema.hasTable('security_audit_log');
    
    if (!tableExists) {
      logger.warn('security_audit_log table does not exist, skipping security audit');
      return;
    }

    await db('security_audit_log').insert({
      event_type: event.eventType,
      user_id: event.userId || null,
      company_id: event.companyId || null,
      ip_address: event.ipAddress || null,
      user_agent: event.userAgent || null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      severity: event.severity,
      created_at: new Date(),
    });

    // Log também no Winston para observabilidade imediata
    const logLevel = event.severity === SecuritySeverity.CRITICAL ? 'error' : 
                     event.severity === SecuritySeverity.WARNING ? 'warn' : 'info';
    
    logger[logLevel]('Security event', {
      event: event.eventType,
      userId: event.userId,
      companyId: event.companyId,
      ip: event.ipAddress,
      severity: event.severity,
      metadata: event.metadata,
    });
  } catch (error) {
    logger.error('Failed to log security event', {
      event: event.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    // Não lança erro para não quebrar fluxo principal
  }
}

/**
 * Registra tentativa de login falhada
 */
export async function logFailedLogin(
  email: string,
  ipAddress: string,
  userAgent: string,
  reason: string = 'Invalid credentials',
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.FAILED_LOGIN,
    ipAddress,
    userAgent,
    metadata: { email, reason },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Registra login bem-sucedido
 */
export async function logSuccessfulLogin(
  userId: string,
  email: string,
  companyId: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.SUCCESSFUL_LOGIN,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: { email },
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Registra mudança de senha
 */
export async function logPasswordChanged(
  userId: string,
  companyId: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.PASSWORD_CHANGED,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: {},
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Registra ativação de MFA
 */
export async function logMFAEnabled(
  userId: string,
  companyId: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.MFA_ENABLED,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: {},
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Registra desativação de MFA (CRÍTICO)
 */
export async function logMFADisabled(
  userId: string,
  companyId: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.MFA_DISABLED,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: {},
    severity: SecuritySeverity.CRITICAL,
  });
}

/**
 * Registra mudança de permissões
 */
export async function logPermissionChanged(
  userId: string,
  companyId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.PERMISSION_CHANGED,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: { targetUserId, oldRole, newRole },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Registra rate limit atingido
 */
export async function logRateLimitHit(
  tier: string,
  identifier: string,
  path: string,
  method: string,
  ipAddress: string,
  userId?: string,
  companyId?: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.RATE_LIMIT_HIT,
    userId,
    companyId,
    ipAddress,
    metadata: { tier, identifier, path, method },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Registra atividade suspeita
 */
export async function logSuspiciousActivity(
  reason: string,
  userId: string | undefined,
  companyId: string | undefined,
  ipAddress: string,
  userAgent: string,
  metadata?: Record<string, any>,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: { reason, ...metadata },
    severity: SecuritySeverity.CRITICAL,
  });
}

/**
 * Registra revogação de token
 */
export async function logTokenRevoked(
  userId: string,
  companyId: string,
  reason: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.TOKEN_REVOKED,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: { reason },
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Registra bloqueio de conta
 */
export async function logAccountLocked(
  userId: string,
  companyId: string,
  reason: string,
  ipAddress: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.ACCOUNT_LOCKED,
    userId,
    companyId,
    ipAddress,
    metadata: { reason },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Registra tentativa de acesso não autorizado
 */
export async function logUnauthorizedAccessAttempt(
  resource: string,
  userId: string | undefined,
  companyId: string | undefined,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logSecurityEvent({
    eventType: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
    userId,
    companyId,
    ipAddress,
    userAgent,
    metadata: { resource },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Busca eventos de segurança recentes para um usuário
 */
export async function getRecentSecurityEvents(
  userId: string,
  limit: number = 50,
): Promise<any[]> {
  try {
    const db = getDatabase();
    
    const tableExists = await db.schema.hasTable('security_audit_log');
    if (!tableExists) {
      return [];
    }

    const events = await db('security_audit_log')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select('*');

    return events;
  } catch (error) {
    logger.error('Failed to fetch security events', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Busca eventos de segurança críticos recentes
 */
export async function getCriticalSecurityEvents(
  limit: number = 100,
): Promise<any[]> {
  try {
    const db = getDatabase();
    
    const tableExists = await db.schema.hasTable('security_audit_log');
    if (!tableExists) {
      return [];
    }

    const events = await db('security_audit_log')
      .where('severity', SecuritySeverity.CRITICAL)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select('*');

    return events;
  } catch (error) {
    logger.error('Failed to fetch critical security events', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Conta falhas de login para um email nas últimas N horas
 */
export async function countFailedLogins(
  email: string,
  hoursAgo: number = 1,
): Promise<number> {
  try {
    const db = getDatabase();
    
    const tableExists = await db.schema.hasTable('security_audit_log');
    if (!tableExists) {
      return 0;
    }

    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const result = await db('security_audit_log')
      .where('event_type', SecurityEventType.FAILED_LOGIN)
      .where('created_at', '>=', since)
      .whereRaw("metadata->>'email' = ?", [email])
      .count('* as count')
      .first();

    return parseInt(result?.count as string) || 0;
  } catch (error) {
    logger.error('Failed to count failed logins', {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

export default {
  logSecurityEvent,
  logFailedLogin,
  logSuccessfulLogin,
  logPasswordChanged,
  logMFAEnabled,
  logMFADisabled,
  logPermissionChanged,
  logRateLimitHit,
  logSuspiciousActivity,
  logTokenRevoked,
  logAccountLocked,
  logUnauthorizedAccessAttempt,
  getRecentSecurityEvents,
  getCriticalSecurityEvents,
  countFailedLogins,
};
