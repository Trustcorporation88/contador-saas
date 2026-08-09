/**
 * Company Context Middleware
 * Lê o header X-Company-Id, valida acesso e sobrescreve req.user.companyId.
 * Permite que um usuário troque de empresa ativa sem precisar gerar novo token.
 */

import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import { logger } from './requestLogger';
import { TenantService } from '../services/tenantService';

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

    // Valida que a empresa existe/está ativa E que o usuário tem vínculo
    // real com ela em company_users (admin acessa qualquer empresa).
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

    if (req.user.role !== 'admin') {
      const access = await TenantService.validateUserAccess(req.user.id, headerCompanyId);
      if (!access.isValid) {
        logger.warn('Usuário sem vínculo com a empresa do header X-Company-Id', {
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
    }

    req.user.companyId = headerCompanyId;
    next();
  } catch (error) {
    logger.error('applyCompanyContext error', {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    // Seguir em frente aqui não expõe outra empresa (a troca só acontece na
    // linha acima, depois da validação), mas serve os dados da empresa ANTERIOR
    // como se fossem os da empresa que o usuário pediu. Num sistema contábil
    // isso leva o usuário a lançar na empresa errada acreditando ter trocado.
    res.status(503).json({
      success: false,
      error: 'Não foi possível confirmar a troca de empresa. Tente novamente.',
      code: 'COMPANY_CONTEXT_UNAVAILABLE',
    });
  }
}

export default applyCompanyContext;