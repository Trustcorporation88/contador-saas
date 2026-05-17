import api from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface PaginatedAuditResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditStats {
  total_logs: number;
  today_logs: number;
  failed_actions: number;
  top_actions: Array<{ action: string; count: number }>;
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

// ─── Service ─────────────────────────────────────────────────────────────────

export const AuditService = {
  async getStats(companyId?: string): Promise<AuditStats> {
    const { data } = await api.get<AuditStats>('/audit/stats', {
      params: companyId ? { company_id: companyId } : {},
    });
    return data;
  },

  async listLogs(filters: AuditLogFilters): Promise<PaginatedAuditResponse<AuditLogEntry>> {
    const { data } = await api.get<PaginatedAuditResponse<AuditLogEntry>>('/audit/logs', {
      params: filters,
    });
    return data;
  },

  async listAccessAudit(filters: AuditLogFilters): Promise<PaginatedAuditResponse<AccessAuditEntry>> {
    const { data } = await api.get<PaginatedAuditResponse<AccessAuditEntry>>('/audit/access', {
      params: filters,
    });
    return data;
  },
};
