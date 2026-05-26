/**
 * EFD Routes
 * /api/v1/companies/:companyId/efd
 */

import { Router } from 'express';
import { EFDController } from '../controllers/efdController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Apply authentication middleware
router.use(authenticateToken);

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
router.post('/generate', EFDController.generateEFD);

/**
 * GET /companies/:companyId/efd/list
 * List EFD generations with filters and pagination
 */
router.get('/list', EFDController.listEFD);

/**
 * GET /companies/:companyId/efd/:generationId
 * Get specific EFD generation details
 */
router.get('/:generationId', EFDController.getEFD);

/**
 * POST /companies/:companyId/efd/:generationId/validate
 * Validate EFD generation
 */
router.post('/:generationId/validate', EFDController.validateEFD);

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
router.post('/:generationId/cancel', EFDController.cancelEFD);

export default router;
