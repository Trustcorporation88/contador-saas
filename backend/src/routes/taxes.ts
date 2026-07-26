import { Router } from 'express';
import { TaxController } from '../controllers/taxController';
import { authenticateToken, authorize } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';

/**
 * Tax Routes — company-scoped via /companies/:companyId/taxes
 *
 * POST /calculate              - Simula cálculo sem salvar
 * POST /appraisal              - Calcula e salva apuração (tax_calculations)
 * GET  /appraisal              - Lista apurações salvas (aceita ?tax_type=CBS|IBS)
 * PATCH /appraisal/:id/status  - Atualiza status (PENDING→APPROVED→FILED)
 *
 * Reforma Tributária (CBS/IBS):
 * POST /reforma/calculate      - Calcula CBS/IBS de um ano
 * POST /reforma/projecao       - Projeta CBS/IBS ano a ano (ex.: 2026-2033)
 * POST /reforma/appraisal      - Calcula e persiste (reaproveita tax_calculations)
 * PUT  /reforma/aliquotas      - Cadastra/atualiza alíquota de um ano (admin only)
 */
const router = Router({ mergeParams: true });

router.use(authenticateToken, validateTenantAccess);

/** Simular cálculo (sem persistir) */
router.post('/calculate', TaxController.calculate);

/** Calcular e persistir apuração */
router.post('/appraisal', TaxController.appraisal);

/** Listar apurações salvas */
router.get('/appraisal', TaxController.listAppraisals);

/** Atualizar status de apuração */
router.patch('/appraisal/:id/status', TaxController.updateStatus);

/** Reforma Tributária — calcular CBS/IBS de um ano */
router.post('/reforma/calculate', TaxController.calculateReforma);

/** Reforma Tributária — projeção multi-ano (2026-2033) */
router.post('/reforma/projecao', TaxController.projetarReforma);

/** Reforma Tributária — calcular e persistir apuração */
router.post('/reforma/appraisal', TaxController.appraisalReforma);

/** Reforma Tributária — cadastrar/atualizar alíquota de referência do ano (admin) */
router.put('/reforma/aliquotas', authorize('admin'), TaxController.upsertAliquotaReforma);

export default router;
