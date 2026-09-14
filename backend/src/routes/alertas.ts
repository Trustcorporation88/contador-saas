/**
 * Alertas Routes: alertas fiscais por empresa
 *
 * GET /companies/:companyId/alertas (lista os alertas abertos: sino/tela)
 *
 * Os alertas são gerados pelo motor no cron diário (ProjetoAlertaService); esta
 * rota é só de leitura.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ProjetoAlertaService } from '../services/projetoAlertaService';
import { authenticateToken } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';
import { logger } from '../middleware/requestLogger';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateTenantAccess);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const data = await ProjetoAlertaService.listarAbertos(companyId);
    return res.status(200).json({ data });
  } catch (err) {
    logger.error('Alertas listar error', { error: (err as Error).message });
    return next(err);
  }
});

export default router;
