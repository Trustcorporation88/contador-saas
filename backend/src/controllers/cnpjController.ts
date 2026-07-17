/**
 * Documento Controller
 * Endpoints de consulta e validação de CNPJ/CPF
 */

import { Request, Response, NextFunction } from 'express';
import { CnpjService } from '../services/cnpjService';
import { logger } from '../middleware/requestLogger';

export class CnpjController {
  /**
   * GET /cnpj/:cnpj
   * Consulta dados cadastrais de CNPJ
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
   * GET /cnpj/cpf/:cpf
   * Consulta CPF no provedor de documentos
   */
  static async lookupCpf(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { cpf } = req.params;
      const result = await CnpjService.lookupCpf(cpf);
      return res.status(200).json(result);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status && error.status < 500) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('CPF lookup error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /cnpj/documento/:documento
   * Consulta automática por documento (11=CPF, 14=CNPJ)
   */
  static async lookupDocumento(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { documento } = req.params;
      const result = await CnpjService.lookupDocumento(documento);
      return res.status(200).json(result);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status && error.status < 500) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Documento lookup error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /cnpj/:cnpj/validate
   * Valida CNPJ localmente
   */
  static validate(req: Request, res: Response): Response {
    const { cnpj } = req.params;
    const result = CnpjService.validate(cnpj);
    return res.status(200).json(result);
  }

  /**
   * GET /cnpj/cpf/:cpf/validate
   * Valida CPF localmente
   */
  static validateCpf(req: Request, res: Response): Response {
    const { cpf } = req.params;
    const result = CnpjService.validateCpf(cpf);
    return res.status(200).json(result);
  }
}

