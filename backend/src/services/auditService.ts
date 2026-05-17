/**
 * Audit Service
 * Consulta e registro de logs de auditoria
 * Conformidade Lei 6.404/76, LGPD e obrigações fiscais
 */

import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  status: string;
  timestamp: string;
}

export interface AccessAuditEntry {
  id: string;
  user_id: string;
  company_id: string;
  action: string;
  description?: string;
  success: boolean;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export interface AccessAuditFilters {
  page?: number;
  limit?: number;
  user_id?: string;
  company_id?: string;
  action?: string;
  success?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedAuditResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * AuditService
 * Centraliza criação e consulta de logs de auditoria
 */
export class AuditService {

  /**
   * Registrar ação no audit_logs
   * Chamado por serviços internos (create, update, delete, login, etc.)
   */
  static async log(params: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    status?: 'SUCCESS' | 'FAILURE';
  }): Promise<void> {
    try {
      const db = await getDatabase();
      await db('audit_logs').insert({
        user_id: params.userId || null,
        action: params.action,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
        new_value: params.newValue ? JSON.stringify(params.newValue) : null,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
        status: params.status || 'SUCCESS',
        timestamp: new Date(),
      });
    } catch (err) {
      // Falha de auditoria não deve parar a operação principal
      logger.error('Failed to write audit log', { error: (err as Error).message, params });
    }
  }

  /**
   * Registrar acesso a tenant no access_audit
   * Chamado pelo middleware de multi-tenancy
   */
  static async logAccess(params: {
    userId: string;
    companyId: string;
    action: string;
    description?: string;
    success?: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const db = await getDatabase();
      await db('access_audit').insert({
        user_id: params.userId,
        company_id: params.companyId,
        action: params.action,
        description: params.description || null,
        success: params.success !== false,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
        created_at: new Date(),
      });
    } catch (err) {
      logger.error('Failed to write access audit', { error: (err as Error).message });
    }
  }

  /**
   * Listar audit_logs com filtros e paginação
   * Admin only
   */
  static async listLogs(filters: AuditLogFilters): Promise<PaginatedAuditResponse<AuditLogEntry>> {
    const db = await getDatabase();
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
    const offset = (page - 1) * limit;

    let query = db('audit_logs');

    if (filters.user_id) query = query.where('user_id', filters.user_id);
    if (filters.action) query = query.where('action', filters.action);
    if (filters.entity_type) query = query.where('entity_type', filters.entity_type);
    if (filters.entity_id) query = query.where('entity_id', filters.entity_id);
    if (filters.status) query = query.where('status', filters.status);
    if (filters.date_from) query = query.where('timestamp', '>=', new Date(filters.date_from));
    if (filters.date_to) query = query.where('timestamp', '<=', new Date(filters.date_to));

    const [{ count }] = await query.clone().count('* as count');
    const total = Number(count);

    const rows = await query
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    return {
      data: rows.map(this.formatLog),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Buscar histórico de mudanças de uma entidade específica
   */
  static async getEntityHistory(
    entityId: string,
    entityType?: string,
  ): Promise<AuditLogEntry[]> {
    const db = await getDatabase();

    let query = db('audit_logs').where('entity_id', entityId);
    if (entityType) query = query.where('entity_type', entityType);

    const rows = await query
      .orderBy('timestamp', 'desc')
      .limit(500)
      .select('*');

    return rows.map(this.formatLog);
  }

  /**
   * Listar access_audit com filtros e paginação
   */
  static async listAccessAudit(filters: AccessAuditFilters): Promise<PaginatedAuditResponse<AccessAuditEntry>> {
    const db = await getDatabase();
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
    const offset = (page - 1) * limit;

    let query = db('access_audit');

    if (filters.user_id) query = query.where('user_id', filters.user_id);
    if (filters.company_id) query = query.where('company_id', filters.company_id);
    if (filters.action) query = query.where('action', filters.action);
    if (typeof filters.success === 'boolean') query = query.where('success', filters.success);
    if (filters.date_from) query = query.where('created_at', '>=', new Date(filters.date_from));
    if (filters.date_to) query = query.where('created_at', '<=', new Date(filters.date_to));

    const [{ count }] = await query.clone().count('* as count');
    const total = Number(count);

    const rows = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    return {
      data: rows.map(this.formatAccess),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Resumo de atividade de um usuário (últimos 30 dias)
   */
  static async getUserActivity(userId: string): Promise<{
    totalActions: number;
    actionBreakdown: Record<string, number>;
    recentLogs: AuditLogEntry[];
    failedActions: number;
  }> {
    const db = await getDatabase();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const logs = await db('audit_logs')
      .where('user_id', userId)
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'desc')
      .select('*');

    const actionBreakdown: Record<string, number> = {};
    let failedActions = 0;

    for (const log of logs) {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
      if (log.status === 'FAILURE') failedActions++;
    }

    return {
      totalActions: logs.length,
      actionBreakdown,
      recentLogs: logs.slice(0, 20).map(this.formatLog),
      failedActions,
    };
  }

  /**
   * Estatísticas gerais de auditoria (Admin dashboard)
   */
  static async getStats(companyId?: string): Promise<{
    totalLogs: number;
    todayLogs: number;
    failedActions: number;
    topActions: Array<{ action: string; count: number }>;
    topEntities: Array<{ entity_type: string; count: number }>;
  }> {
    const db = await getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let baseQuery = db('audit_logs');

    const [{ count: totalLogs }] = await baseQuery.clone().count('* as count');
    const [{ count: todayLogs }] = await baseQuery.clone()
      .where('timestamp', '>=', today)
      .count('* as count');
    const [{ count: failedActions }] = await baseQuery.clone()
      .where('status', 'FAILURE')
      .count('* as count');

    const topActions = await db('audit_logs')
      .groupBy('action')
      .orderByRaw('COUNT(*) DESC')
      .limit(10)
      .select(db.raw('action, COUNT(*) as count'));

    const topEntities = await db('audit_logs')
      .whereNotNull('entity_type')
      .groupBy('entity_type')
      .orderByRaw('COUNT(*) DESC')
      .limit(10)
      .select(db.raw('entity_type, COUNT(*) as count'));

    return {
      totalLogs: Number(totalLogs),
      todayLogs: Number(todayLogs),
      failedActions: Number(failedActions),
      topActions: topActions.map((r: Record<string, unknown>) => ({
        action: r.action as string,
        count: Number(r.count),
      })),
      topEntities: topEntities.map((r: Record<string, unknown>) => ({
        entity_type: r.entity_type as string,
        count: Number(r.count),
      })),
    };
  }

  private static formatLog(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: row.id as string,
      user_id: row.user_id as string | undefined,
      action: row.action as string,
      entity_type: row.entity_type as string | undefined,
      entity_id: row.entity_id as string | undefined,
      old_value: row.old_value as Record<string, unknown> | undefined,
      new_value: row.new_value as Record<string, unknown> | undefined,
      ip_address: row.ip_address as string | undefined,
      user_agent: row.user_agent as string | undefined,
      status: row.status as string,
      timestamp: row.timestamp as string,
    };
  }

  private static formatAccess(row: Record<string, unknown>): AccessAuditEntry {
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      company_id: row.company_id as string,
      action: row.action as string,
      description: row.description as string | undefined,
      success: Boolean(row.success),
      ip_address: row.ip_address as string | undefined,
      user_agent: row.user_agent as string | undefined,
      created_at: row.created_at as string,
    };
  }
}
