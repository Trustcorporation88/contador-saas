import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { authenticateToken } from '../middleware/auth';

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

router.use(authenticateToken);

/**
 * GET /companies/:companyId/reports/balance-sheet
 * Balanço Patrimonial (Ativo = Passivo + PL)
 * Query: date_to (YYYY-MM-DD, default hoje)
 */
router.get('/balance-sheet', ReportController.balanceSheet);

/**
 * GET /companies/:companyId/reports/income-statement
 * DRE - Demonstração do Resultado do Exercício
 * Query: date_from, date_to (obrigatórios)
 */
router.get('/income-statement', ReportController.incomeStatement);

/**
 * GET /companies/:companyId/reports/trial-balance
 * Balancete de Verificação
 * Query: date_from, date_to (opcionais)
 */
router.get('/trial-balance', ReportController.trialBalance);

/**
 * GET /companies/:companyId/reports/ledger/:accountId
 * Livro Razão por conta com saldo acumulado
 * Query: date_from, date_to (opcionais)
 */
router.get('/ledger/:accountId', ReportController.ledger);

export default router;
