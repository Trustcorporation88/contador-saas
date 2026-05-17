/**
 * Audit Middleware
 * Intercepta requests para logar automaticamente em audit_logs
 * Extrai contexto (userId, IP, userAgent) e delega ao AuditService
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';

type AuthRequest = Request & { user?: { id: string; role?: string }; tenant?: { companyId: string } };

/**
 * Mapeia método HTTP + path pattern para action do audit_log
 */
function resolveAction(method: string, path: string): string {
  const m = method.toUpperCase();
  if (path.includes('/post')) return 'APPROVE';
  if (path.includes('/reverse')) return 'RECONCILE';
  if (path.includes('/import')) return 'IMPORT';
  if (path.includes('/export')) return 'EXPORT';
  if (m === 'POST') return 'CREATE';
  if (m === 'PUT' || m === 'PATCH') return 'UPDATE';
  if (m === 'DELETE') return 'DELETE';
  if (m === 'GET') return 'READ';
  return 'READ';
}

/**
 * Resolve entity_type a partir do path da URL
 */
function resolveEntityType(path: string): string {
  if (path.includes('/journal-entries') || path.includes('/journals')) return 'JOURNAL_ENTRY';
  if (path.includes('/accounts')) return 'ACCOUNT';
  if (path.includes('/companies')) return 'COMPANY';
  if (path.includes('/auth')) return 'AUTH';
  if (path.includes('/taxes')) return 'TAX';
  if (path.includes('/reports')) return 'REPORT';
  return 'UNKNOWN';
}

/**
 * Middleware de auditoria automática
 * Captura respostas de sucesso (2xx) e grava no audit_logs
 * Configurável: apenas para métodos que modificam dados (POST, PUT, DELETE)
 */
export function auditMiddleware(options?: {
  methods?: string[];
  skipPaths?: RegExp[];
}) {
  const methods = options?.methods || ['POST', 'PUT', 'PATCH', 'DELETE'];
  const skipPaths = options?.skipPaths || [/\/auth\/refresh/, /\/status/, /\/audit/];

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();

    // Pular métodos não configurados
    if (!methods.includes(method)) return next();

    // Pular paths excluídos
    if (skipPaths.some(p => p.test(req.path))) return next();

    // Interceptar fim do response
    const originalSend = res.send.bind(res);
    res.send = function (body: unknown) {
      const statusCode = res.statusCode;

      // Apenas logar operações bem-sucedidas (2xx)
      if (statusCode >= 200 && statusCode < 300) {
        const userId = req.user?.id;
        const path = req.path;
        const action = resolveAction(method, path);
        const entityType = resolveEntityType(path);

        // Extrair entity_id dos params
        const entityId = req.params?.entryId || req.params?.id || req.params?.accountId || undefined;

        // Log assíncrono (não bloqueia resposta)
        AuditService.log({
          userId,
          action,
          entityType,
          entityId,
          newValue: method !== 'DELETE' && req.body ? req.body : undefined,
          ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
            req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          status: 'SUCCESS',
        }).catch(() => { /* silencioso */ });
      }

      return originalSend(body);
    };

    next();
  };
}

/**
 * Helper para logar manualmente (usado em serviços)
 * Sintaxe simplificada
 */
export async function logAudit(
  req: AuthRequest,
  action: string,
  entityType: string,
  entityId?: string,
  extra?: { oldValue?: Record<string, unknown>; newValue?: Record<string, unknown> },
): Promise<void> {
  await AuditService.log({
    userId: req.user?.id,
    action,
    entityType,
    entityId,
    oldValue: extra?.oldValue,
    newValue: extra?.newValue,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    status: 'SUCCESS',
  });
}
