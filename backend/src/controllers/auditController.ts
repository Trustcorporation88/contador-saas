/**
 * Audit Controller
 * HTTP handlers para consulta de logs de auditoria
 * Admin only para maioria dos endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService, AuditLogFilters, AccessAuditFilters } from '../services/auditService';
import { logger } from '../middleware/requestLogger';

type AuthRequest = Request & { user?: { id: string; role?: string } };

export class AuditController {

  /**
   * GET /audit/logs
   * Listar audit_logs com filtros
   * Admin only
   * Query: page, limit, user_id, action, entity_type, entity_id, status, date_from, date_to
   */
  static async listLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const filters: AuditLogFilters = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        user_id: req.query.user_id as string | undefined,
        action: req.query.action as string | undefined,
        entity_type: req.query.entity_type as string | undefined,
        entity_id: req.query.entity_id as string | undefined,
        status: req.query.status as string | undefined,
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
      };

      const result = await AuditService.listLogs(filters);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error listing audit logs', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /audit/logs/:entityId
   * Histórico de mudanças de uma entidade
   * Admin only
   * Query: entity_type (opcional)
   */
  static async getEntityHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { entityId } = req.params;
      const entityType = req.query.entity_type as string | undefined;

      const history = await AuditService.getEntityHistory(entityId, entityType);
      return res.status(200).json({ data: history, total: history.length });
    } catch (err) {
      logger.error('Error fetching entity history', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /audit/access
   * Listar access_audit com filtros
   * Admin only
   * Query: page, limit, user_id, company_id, action, success, date_from, date_to
   */
  static async listAccessAudit(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const filters: AccessAuditFilters = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        user_id: req.query.user_id as string | undefined,
        company_id: req.query.company_id as string | undefined,
        action: req.query.action as string | undefined,
        success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
      };

      const result = await AuditService.listAccessAudit(filters);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error listing access audit', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /audit/users/:userId
   * Resumo de atividade de um usuário (últimos 30 dias)
   * Admin ou próprio usuário
   */
  static async getUserActivity(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      // Apenas admin pode ver de outros usuários
      if (!isAdmin && requestingUserId !== userId) {
        return res.status(403).json({ error: 'Acesso negado: apenas admin pode ver atividade de outros usuários' });
      }

      const activity = await AuditService.getUserActivity(userId);
      return res.status(200).json(activity);
    } catch (err) {
      logger.error('Error fetching user activity', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /audit/stats
   * Estatísticas gerais de auditoria
   * Admin only
   */
  static async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.query.company_id as string | undefined;
      const stats = await AuditService.getStats(companyId);
      return res.status(200).json(stats);
    } catch (err) {
      logger.error('Error fetching audit stats', { error: (err as Error).message });
      return next(err);
    }
  }
}
