/**
 * CNPJ Controller
 * Endpoints de consulta e validação de CNPJ via Receita Federal
 */

import { Request, Response, NextFunction } from 'express';
import { CnpjService } from '../services/cnpjService';
import { logger } from '../middleware/requestLogger';

export class CnpjController {

  /**
   * GET /cnpj/:cnpj
   * Consulta dados cadastrais completos na Receita Federal
   * Resultado cacheado por 24h
   */
  static async lookup(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { cnpj } = req.params;
      const result = await CnpjService.lookup(cnpj);
      return res.status(200).json(result);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status && error.status < 500) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('CNPJ lookup error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /cnpj/:cnpj/validate
   * Valida dígitos verificadores localmente (sem chamar API externa)
   */
  static validate(req: Request, res: Response): Response {
    const { cnpj } = req.params;
    const result = CnpjService.validate(cnpj);
    return res.status(200).json(result);
  }
}
