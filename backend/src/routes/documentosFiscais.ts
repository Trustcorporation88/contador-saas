/**
 * Rotas para Documentos Fiscais
 * GET/POST /api/v1/documentos
 */

import { Router, Request, Response } from 'express';
import { DocumentoFiscalController } from '../controllers/documentoFiscalController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * Middleware de autenticação para todas as rotas
 */
router.use(authenticateToken);

/**
 * GET /api/v1/documentos
 * Listar documentos com filtros
 */
router.get('/', (req: Request, res: Response) => {
  DocumentoFiscalController.listar(req, res);
});

/**
 * POST /api/v1/documentos
 * Criar novo documento
 */
router.post('/', (req: Request, res: Response) => {
  DocumentoFiscalController.criar(req, res);
});

/**
 * GET /api/v1/documentos/stats/estatisticas
 * Obter estatísticas (deve vir ANTES do /:id)
 */
router.get('/stats/estatisticas', (req: Request, res: Response) => {
  DocumentoFiscalController.getEstatisticas(req, res);
});

/**
 * GET /api/v1/documentos/:id
 * Obter documento específico
 */
router.get('/:id', (req: Request, res: Response) => {
  DocumentoFiscalController.obter(req, res);
});

/**
 * PUT /api/v1/documentos/:id
 * Atualizar documento (rascunho)
 */
router.put('/:id', (req: Request, res: Response) => {
  DocumentoFiscalController.atualizar(req, res);
});

/**
 * POST /api/v1/documentos/:id/registrar
 * Registrar documento (rascunho -> registrado)
 */
router.post('/:id/registrar', (req: Request, res: Response) => {
  DocumentoFiscalController.registrar(req, res);
});

/**
 * DELETE /api/v1/documentos/:id
 * Cancelar documento
 */
router.delete('/:id', (req: Request, res: Response) => {
  DocumentoFiscalController.cancelar(req, res);
});

export default router;
