/**
 * EFD Routes
 * /api/v1/companies/:companyId/efd
 */

import { Router } from 'express';
import { EFDController } from '../controllers/efdController';
import { authenticateToken, authorize } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';

const router = Router({ mergeParams: true });

// Apply authentication + tenant isolation middleware
router.use(authenticateToken, validateTenantAccess);

/**
 * GET /companies/:companyId/efd/months
 * Get available months for EFD generation
 */
router.get('/months', EFDController.getAvailableMonths);

/**
 * GET /companies/:companyId/efd/status
 * Get EFD generation status summary
 */
router.get('/status', EFDController.getStatus);

/**
 * POST /companies/:companyId/efd/generate
 * Generate EFD for specific month/year
 */
router.post('/generate', authorize('admin', 'accountant'), EFDController.generateEFD);

/**
 * GET /companies/:companyId/efd/list
 * List EFD generations with filters and pagination
 */
router.get('/list', EFDController.listEFD);

/**
 * GET /companies/:companyId/efd/schedule
 * Get automatic EFD scheduling config
 * PUT /companies/:companyId/efd/schedule
 * Create/update automatic EFD scheduling config
 * DEVE vir antes de /:generationId para evitar conflito de rotas
 */
router.get('/schedule', EFDController.getSchedule);
router.put('/schedule', authorize('admin', 'accountant'), EFDController.updateSchedule);
router.post('/schedule/disable', authorize('admin', 'accountant'), EFDController.disableSchedule);

/**
 * GET /companies/:companyId/efd/:generationId
 * Get specific EFD generation details
 */
router.get('/:generationId', EFDController.getEFD);

/**
 * POST /companies/:companyId/efd/:generationId/validate
 * Validate EFD generation
 */
router.post('/:generationId/validate', authorize('admin', 'accountant'), EFDController.validateEFD);

/**
 * GET /companies/:companyId/efd/:generationId/download
 * Download EFD file (.txt format)
 */
router.get('/:generationId/download', EFDController.downloadEFD);

/**
 * GET /companies/:companyId/efd/:generationId/accounts
 * Get account balances for EFD
 */
router.get('/:generationId/accounts', EFDController.getAccountBalances);

/**
 * GET /companies/:companyId/efd/:generationId/journal-entries
 * Get journal entries included in EFD
 */
router.get('/:generationId/journal-entries', EFDController.getJournalEntries);

/**
 * POST /companies/:companyId/efd/:generationId/cancel
 * Cancel EFD generation
 */
router.post('/:generationId/cancel', authorize('admin', 'accountant'), EFDController.cancelEFD);

export default router;
