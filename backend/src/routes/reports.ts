import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { ExportController } from '../controllers/exportController';
import { authenticateToken } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';
import { HTTP_STATUS } from '../config/constants';

/**
 * Financial Reports Routes (via companies sub-router)
 * Registrado como /companies/:companyId/reports em companies.ts
 *
 * GET /companies/:cId/reports/balance-sheet        - Balanço Patrimonial
 * GET /companies/:cId/reports/income-statement     - DRE
 * GET /companies/:cId/reports/trial-balance        - Balancete de Verificação
 * GET /companies/:cId/reports/ledger/:accountId    - Livro Razão
 */
const router = Router({ mergeParams: true });

const REPORT_ROLES = ['admin', 'accountant', 'manager', 'auditor'];
const CLIENT_SUMMARY_ROLES = [...REPORT_ROLES, 'viewer'];

router.use(authenticateToken, validateTenantAccess);

function authorizeTenantRoles(...allowedRoles: string[]) {
	return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
		const role = req.tenant?.role ?? req.user?.role;

		if (!role || !allowedRoles.includes(role)) {
			return res.status(HTTP_STATUS.FORBIDDEN).json({
				error: 'Forbidden',
				message: 'Você não tem permissão para acessar este relatório',
			});
		}

		return next();
	};
}

router.get('/client-summary/monthly', authorizeTenantRoles(...CLIENT_SUMMARY_ROLES), ReportController.clientMonthlySummary);
router.get('/client-summary/annual', authorizeTenantRoles(...CLIENT_SUMMARY_ROLES), ReportController.clientAnnualSummary);

/**
 * GET /companies/:companyId/reports/balance-sheet
 * Balanço Patrimonial (Ativo = Passivo + PL)
 * Query: date_to (YYYY-MM-DD, default hoje)
 */
router.get('/balance-sheet', authorizeTenantRoles(...REPORT_ROLES), ReportController.balanceSheet);

/**
 * GET /companies/:companyId/reports/income-statement
 * DRE - Demonstração do Resultado do Exercício
 * Query: date_from, date_to (obrigatórios)
 */
router.get('/income-statement', authorizeTenantRoles(...REPORT_ROLES), ReportController.incomeStatement);

/**
 * GET /companies/:companyId/reports/executive-summary
 * Query: date_from, date_to (obrigatórios)
 */
router.get('/executive-summary', authorizeTenantRoles(...REPORT_ROLES), ReportController.executiveSummary);

/**
 * GET /companies/:companyId/reports/cash-flow-summary
 * Query: months (opcional, default 12)
 */
router.get('/cash-flow-summary', authorizeTenantRoles(...REPORT_ROLES), ReportController.cashFlowSummary);

/**
 * GET /companies/:companyId/reports/trial-balance
 * Balancete de Verificação
 * Query: date_from, date_to (opcionais)
 */
router.get('/trial-balance', authorizeTenantRoles(...REPORT_ROLES), ReportController.trialBalance);

/**
 * GET /companies/:companyId/reports/ledger/:accountId
 * Livro Razão por conta com saldo acumulado
 * Query: date_from, date_to (opcionais)
 */
router.get('/ledger/:accountId', authorizeTenantRoles(...REPORT_ROLES), ReportController.ledger);

// ─── EXPORTAÇÃO ──────────────────────────────────────────────────────────────
// GET /companies/:companyId/reports/*/export?format=xlsx|pdf

/**
 * GET /companies/:companyId/reports/balance-sheet/export
 * Query: date_to (opcional), format=xlsx|pdf
 */
router.get('/balance-sheet/export', authorizeTenantRoles(...REPORT_ROLES), ExportController.balanceSheet);

/**
 * GET /companies/:companyId/reports/income-statement/export
 * Query: date_from, date_to (obrigatórios), format=xlsx|pdf
 */
router.get('/income-statement/export', authorizeTenantRoles(...REPORT_ROLES), ExportController.incomeStatement);

/**
 * GET /companies/:companyId/reports/trial-balance/export
 * Query: date_from, date_to (opcionais), format=xlsx|pdf
 */
router.get('/trial-balance/export', authorizeTenantRoles(...REPORT_ROLES), ExportController.trialBalance);

/**
 * GET /companies/:companyId/reports/ledger/:accountId/export
 * Query: date_from, date_to (opcionais), format=xlsx|pdf
 */
router.get('/ledger/:accountId/export', authorizeTenantRoles(...REPORT_ROLES), ExportController.ledger);

export default router;
