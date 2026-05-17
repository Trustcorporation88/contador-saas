import { Router } from 'express';
import { TaxController } from '../controllers/taxController';
import { authenticateToken } from '../middleware/auth';

/**
 * Tax Routes — company-scoped via /companies/:companyId/taxes
 *
 * POST /calculate              - Simula cálculo sem salvar
 * POST /appraisal              - Calcula e salva apuração (tax_calculations)
 * GET  /appraisal              - Lista apurações salvas
 * PATCH /appraisal/:id/status  - Atualiza status (PENDING→APPROVED→FILED)
 */
const router = Router({ mergeParams: true });

router.use(authenticateToken);

/** Simular cálculo (sem persistir) */
router.post('/calculate', TaxController.calculate);

/** Calcular e persistir apuração */
router.post('/appraisal', TaxController.appraisal);

/** Listar apurações salvas */
router.get('/appraisal', TaxController.listAppraisals);

/** Atualizar status de apuração */
router.patch('/appraisal/:id/status', TaxController.updateStatus);

export default router;
