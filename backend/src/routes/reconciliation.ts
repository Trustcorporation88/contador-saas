/**
 * Bank Reconciliation Routes
 * POST   /companies/:companyId/reconciliation/upload           - Upload extrato
 * GET    /companies/:companyId/reconciliation                  - Listar uploads
 * GET    /companies/:companyId/reconciliation/:uploadId        - Detalhes upload
 * GET    /companies/:companyId/reconciliation/:uploadId/suggestions - Sugestões
 * POST   /companies/:companyId/reconciliation/:uploadId/execute - Executar
 */

import { Router } from 'express';
import multer from 'multer';
import { ReconciliationController } from '../controllers/reconciliationController';
import { authenticateToken } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';

/**
 * Configuração do multer para upload de arquivos
 * Limite: 10MB, apenas arquivos CSV/TXT
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
    const allowedExtensions = ['.csv', '.txt'];

    const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são aceitos'));
    }
  },
});

const router = Router({ mergeParams: true });

// Middleware obrigatório
router.use(authenticateToken, validateTenantAccess);

/**
 * GET /companies/:companyId/reconciliation
 * Listar todos os uploads de reconciliação
 * Query: page, limit, status
 */
router.get('/', ReconciliationController.listUploads);

/**
 * POST /companies/:companyId/reconciliation/upload
 * Upload e parsing de extrato bancário
 * Multipart: file (CSV)
 * Response: { id, fileName, bank_name, transaction_count, status }
 */
router.post('/upload', upload.single('file'), ReconciliationController.upload);

/**
 * GET /companies/:companyId/reconciliation/:uploadId
 * Obter detalhes de um upload
 */
router.get('/:uploadId', ReconciliationController.getUploadDetails);

/**
 * GET /companies/:companyId/reconciliation/:uploadId/suggestions
 * Gerar e retornar sugestões de matching
 * Query: min_confidence (0-1, default 0.7)
 * Response: { uploadId, totalTransactions, matchedCount, unmatchedCount, suggestions[] }
 */
router.get('/:uploadId/suggestions', ReconciliationController.getSuggestions);

/**
 * POST /companies/:companyId/reconciliation/:uploadId/execute
 * Executar reconciliação: aceitar sugestões e registrar matches
 * Body: { accepted_suggestions: [{ bank_transaction_id, journal_entry_id }, ...] }
 * Response: { uploadId, total_processed, reconciled_count, unmatched_count }
 */
router.post('/:uploadId/execute', ReconciliationController.executeReconciliation);

export default router;
