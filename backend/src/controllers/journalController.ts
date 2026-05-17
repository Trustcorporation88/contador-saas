/**
 * Journal Entry Controller
 * HTTP handlers para lançamentos contábeis
 * Implementa partidas dobradas (Lei 6.404/76)
 */

import { Request, Response, NextFunction } from 'express';
import { JournalService } from '../services/journalService';
import { JournalFilters } from '../models/dtos/journalDTO';
import { logger } from '../middleware/requestLogger';

/**
 * JournalController - Handlers HTTP para lançamentos contábeis
 */
export class JournalController {

  /**
   * POST /companies/:companyId/journal-entries
   * Criar lançamento contábil (DRAFT)
   * Requer: ACCOUNTANT ou ADMIN
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const userId = (req as Request & { user?: { id: string } }).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const entry = await JournalService.create(companyId, userId, req.body);
      return res.status(201).json(entry);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 400 || error.status === 422) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error creating journal entry', { error: error.message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/journal-entries
   * Listar lançamentos com paginação e filtros
   * Requer: qualquer role autenticado
   * Query params: page, limit, date_from, date_to, is_posted, reference_type, search, account_id
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;

      const filters: JournalFilters = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
        is_posted: req.query.is_posted !== undefined
          ? req.query.is_posted === 'true'
          : undefined,
        reference_type: req.query.reference_type as string | undefined,
        search: req.query.search as string | undefined,
        account_id: req.query.account_id as string | undefined,
      };

      const result = await JournalService.list(companyId, filters);
      return res.status(200).json(result);
    } catch (err: unknown) {
      logger.error('Error listing journal entries', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/journal-entries/:entryId
   * Buscar lançamento por ID (com linhas)
   * Requer: qualquer role autenticado
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, entryId } = req.params;
      const entry = await JournalService.getById(entryId, companyId);
      return res.status(200).json(entry);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Error fetching journal entry', { error: error.message });
      return next(err);
    }
  }

  /**
   * PUT /companies/:companyId/journal-entries/:entryId
   * Atualizar lançamento (apenas DRAFT)
   * Requer: ACCOUNTANT ou ADMIN
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, entryId } = req.params;
      const userId = (req as Request & { user?: { id: string } }).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const entry = await JournalService.update(entryId, companyId, userId, req.body);
      return res.status(200).json(entry);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 400 || error.status === 404 || error.status === 409 || error.status === 422) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error updating journal entry', { error: error.message });
      return next(err);
    }
  }

  /**
   * DELETE /companies/:companyId/journal-entries/:entryId
   * Deletar lançamento (apenas DRAFT)
   * Requer: ADMIN
   */
  static async remove(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, entryId } = req.params;
      await JournalService.delete(entryId, companyId);
      return res.status(204).send();
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404 || error.status === 409) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error deleting journal entry', { error: error.message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/journal-entries/:entryId/post
   * Postar lançamento (DRAFT → POSTED, imutável)
   * Requer: ACCOUNTANT ou ADMIN
   */
  static async post(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, entryId } = req.params;
      const userId = (req as Request & { user?: { id: string } }).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const entry = await JournalService.post(entryId, companyId, userId);
      return res.status(200).json(entry);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404 || error.status === 409 || error.status === 422) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error posting journal entry', { error: error.message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/journal-entries/:entryId/reverse
   * Estornar lançamento postado (cria novo lançamento invertido)
   * Requer: ACCOUNTANT ou ADMIN
   * Body: { reverse_date?: string } (opcional)
   */
  static async reverse(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, entryId } = req.params;
      const userId = (req as Request & { user?: { id: string } }).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const reverseDate = req.body?.reverse_date as string | undefined;
      const entry = await JournalService.reverse(entryId, companyId, userId, reverseDate);
      return res.status(201).json(entry);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404 || error.status === 409 || error.status === 422) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error reversing journal entry', { error: error.message });
      return next(err);
    }
  }
}
