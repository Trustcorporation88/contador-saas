/**
 * DAS Routes
 * /api/v1/companies/:companyId/das
 */

import { Router } from 'express';
import { DASController } from '../controllers/dasController';

const router = Router({ mergeParams: true });

/**
 * POST /companies/:companyId/das/generate
 * Gerar DAS manualmente
 */
router.post('/generate', DASController.generate);

/**
 * POST /companies/:companyId/das/generate-auto
 * Gerar DAS automaticamente a partir de apuracao
 */
router.post('/generate-auto', DASController.generateAuto);

/**
 * GET /companies/:companyId/das
 * Listar DAS com filtros
 */
router.get('/', DASController.list);

/**
 * GET /companies/:companyId/das/:dasId
 * Buscar DAS específico
 */
router.get('/:dasId', DASController.getById);

/**
 * PATCH /companies/:companyId/das/:dasId
 * Atualizar DAS
 */
router.patch('/:dasId', DASController.update);

/**
 * POST /companies/:companyId/das/:dasId/pay
 * Registrar pagamento
 */
router.post('/:dasId/pay', DASController.registrarPagamento);

/**
 * DELETE /companies/:companyId/das/:dasId
 * Cancelar DAS
 */
router.delete('/:dasId', DASController.cancelar);

/**
 * GET /companies/:companyId/das/agendamento/:regime
 * Obter configuração de agendamento
 */
router.get('/agendamento/:regime', DASController.obterAgendamento);

/**
 * PUT /companies/:companyId/das/agendamento/:regime
 * Atualizar configuração de agendamento
 */
router.put('/agendamento/:regime', DASController.atualizarAgendamento);

export default router;
