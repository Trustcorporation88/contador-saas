/**
 * Rotas para Documentos Fiscais
 * GET/POST /api/v1/documentos
 */

import { Router } from 'express';
import { DocumentoFiscalController } from '../controllers/documentoFiscalController';
import { authenticateToken } from '../middleware/auth';
import { applyCompanyContext } from '../middleware/companyContext';

const router = Router();

/**
 * Middleware de autenticação para todas as rotas
 */
router.use(authenticateToken);
router.use(applyCompanyContext);

/**
 * GET /api/v1/documentos
 * Listar documentos com filtros
 */
router.get('/', DocumentoFiscalController.listar);

/**
 * POST /api/v1/documentos
 * Criar novo documento
 */
router.post('/', DocumentoFiscalController.criar);

/**
 * GET /api/v1/documentos/stats/estatisticas
 * Obter estatísticas (deve vir ANTES do /:id)
 */
router.get('/stats/estatisticas', DocumentoFiscalController.getEstatisticas);

/**
 * GET /api/v1/documentos/:id
 * Obter documento específico
 */
router.get('/:id', DocumentoFiscalController.obter);

/**
 * PUT /api/v1/documentos/:id
 * Atualizar documento (rascunho)
 */
router.put('/:id', DocumentoFiscalController.atualizar);

/**
 * POST /api/v1/documentos/:id/registrar
 * Registrar documento (rascunho -> registrado)
 */
router.post('/:id/registrar', DocumentoFiscalController.registrar);

/**
 * DELETE /api/v1/documentos/:id
 * Cancelar documento
 */
router.delete('/:id', DocumentoFiscalController.cancelar);

export default router;
