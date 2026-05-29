/**
 * Company Context Middleware
 * Lê o header X-Company-Id, valida acesso e sobrescreve req.user.companyId.
 * Permite que um usuário troque de empresa ativa sem precisar gerar novo token.
 */

import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import { logger } from './requestLogger';

export async function applyCompanyContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next();
      return;
    }

    const raw = req.headers['x-company-id'];
    const headerCompanyId = Array.isArray(raw) ? raw[0] : raw;

    // Sem header: mantém companyId do JWT
    if (!headerCompanyId || typeof headerCompanyId !== 'string') {
      next();
      return;
    }

    // Header igual ao JWT: nada a fazer
    if (headerCompanyId === req.user.companyId) {
      next();
      return;
    }

    // Valida acesso. Por enquanto, exige que a empresa exista e esteja ativa.
    // TODO: validar associação user↔company quando company_users existir.
    const db = await getDatabase();
    const company = await db('companies')
      .where({ id: headerCompanyId, is_active: true })
      .first();

    if (!company) {
      logger.warn('Empresa do header X-Company-Id não encontrada', {
        userId: req.user.id,
        headerCompanyId,
      });
      res.status(403).json({
        success: false,
        error: 'Empresa não acessível',
        code: 'COMPANY_NOT_ACCESSIBLE',
      });
      return;
    }

    req.user.companyId = headerCompanyId;
    next();
  } catch (error) {
    logger.error('applyCompanyContext error', {
      error: (error as Error).message,
    });
    next();
  }
}

export default applyCompanyContext;