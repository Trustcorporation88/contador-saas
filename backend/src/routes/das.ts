/**
 * DAS Routes
 * POST/GET /companies/:companyId/das
 */

import { Router } from 'express';
import { DASController } from '../controllers/dasController';
import authMiddleware from '../middleware/auth';
import multiTenantMiddleware from '../middleware/multiTenant';

const router = Router();

// Aplicar middlewares de autenticação e multi-tenant
router.use(authMiddleware);
router.use(multiTenantMiddleware);

/**
 * POST /companies/:companyId/das/generate
 * Gerar DAS manualmente
 */
router.post('/:companyId/das/generate', DASController.generate);

/**
 * POST /companies/:companyId/das/generate-auto
 * Gerar DAS automaticamente a partir de apuração
 */
router.post('/:companyId/das/generate-auto', DASController.generateAuto);

/**
 * GET /companies/:companyId/das
 * Listar DAS com filtros
 */
router.get('/:companyId/das', DASController.list);

/**
 * GET /companies/:companyId/das/:dasId
 * Buscar DAS específico
 */
router.get('/:companyId/das/:dasId', DASController.getById);

/**
 * PATCH /companies/:companyId/das/:dasId
 * Atualizar DAS
 */
router.patch('/:companyId/das/:dasId', DASController.update);

/**
 * POST /companies/:companyId/das/:dasId/pay
 * Registrar pagamento
 */
router.post('/:companyId/das/:dasId/pay', DASController.registrarPagamento);

/**
 * DELETE /companies/:companyId/das/:dasId
 * Cancelar DAS
 */
router.delete('/:companyId/das/:dasId', DASController.cancelar);

/**
 * GET /companies/:companyId/das/agendamento/:regime
 * Obter configuração de agendamento
 */
router.get('/:companyId/das/agendamento/:regime', DASController.obterAgendamento);

/**
 * PUT /companies/:companyId/das/agendamento/:regime
 * Atualizar configuração de agendamento
 */
router.put('/:companyId/das/agendamento/:regime', DASController.atualizarAgendamento);

export default router;
