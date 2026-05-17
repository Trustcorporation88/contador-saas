import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { authenticateToken } from '../middleware/auth';

/**
 * Audit Routes
 * Todos os endpoints requerem autenticação + role admin (exceto /users/:userId)
 *
 * GET /audit/logs                  - Listar audit_logs (Admin)
 * GET /audit/logs/:entityId        - Histórico de entidade (Admin)
 * GET /audit/access                - Listar access_audit (Admin)
 * GET /audit/users/:userId         - Atividade de usuário (Admin ou próprio)
 * GET /audit/stats                 - Estatísticas gerais (Admin)
 */
const router = Router();

router.use(authenticateToken);

/**
 * GET /audit/stats
 * Estatísticas gerais: total logs, hoje, falhas, top ações
 * Query: company_id (opcional)
 */
router.get('/stats', AuditController.getStats);

/**
 * GET /audit/logs
 * Listar audit_logs com paginação e filtros
 * Query: page, limit, user_id, action, entity_type, entity_id, status, date_from, date_to
 */
router.get('/logs', AuditController.listLogs);

/**
 * GET /audit/logs/:entityId
 * Histórico de mudanças de uma entidade
 * Query: entity_type (opcional, ex: JOURNAL_ENTRY, ACCOUNT, COMPANY)
 */
router.get('/logs/:entityId', AuditController.getEntityHistory);

/**
 * GET /audit/access
 * Listar access_audit (tentativas de acesso a tenants)
 * Query: page, limit, user_id, company_id, action, success, date_from, date_to
 */
router.get('/access', AuditController.listAccessAudit);

/**
 * GET /audit/users/:userId
 * Resumo de atividade do usuário (últimos 30 dias)
 * Admin ou próprio usuário
 */
router.get('/users/:userId', AuditController.getUserActivity);

export default router;

