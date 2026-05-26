/**
 * EFD Controller
 * Handles HTTP requests for EFD operations
 */

import { Request, Response, NextFunction } from 'express';
import { EFDBuilderService } from '../services/efdBuilderService';
import { CreateEFDGenerationDTO, ListEFDFilters, EFDDownloadOptions } from '../models/dtos/efdDTO';
import { getDatabase } from '../config/database';

export class EFDController {
  /**
   * POST /api/v1/companies/:companyId/efd/generate
   * Generate EFD for specific month/year
   */
  static async generateEFD(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const { month, year, includeOperations, includeInventory, includeAdjustments } =
        req.body as CreateEFDGenerationDTO;

      // Validate input
      if (!month || !year) {
        res.status(400).json({
          error: 'Missing required fields: month, year',
          code: 'INVALID_REQUEST',
        });
        return;
      }

      if (month < 1 || month > 12) {
        res.status(400).json({
          error: 'Month must be between 1 and 12',
          code: 'INVALID_MONTH',
        });
        return;
      }

      // Check if EFD already exists for this period
      const db = await getDatabase();
      const existing = await db('efd_generations')
        .where({
          company_id: companyId,
          month,
          year,
        })
        .whereIn('status', ['pending', 'generating', 'generated', 'validated']);

      if (existing.length > 0) {
        res.status(409).json({
          error: 'EFD already exists for this period',
          code: 'EFD_EXISTS',
          existing_id: existing[0].id,
        });
        return;
      }

      // Generate EFD
      const generation = await EFDBuilderService.generateEFD(companyId, {
        month,
        year,
        includeOperations: includeOperations !== false,
        includeInventory: includeInventory === true,
        includeAdjustments: includeAdjustments !== false,
      });

      res.status(201).json({
        success: true,
        data: generation,
        message: `EFD gerada com sucesso para ${month}/${year}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/companies/:companyId/efd/list
   * List EFD generations with filters and pagination
   */
  static async listEFD(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const { status, month, year, page = 1, limit = 20 } = req.query;

      const filters: ListEFDFilters = {
        status: status as string,
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
      };

      const result = await EFDBuilderService.listGenerations(
        companyId,
        filters,
        parseInt(page as string),
        parseInt(limit as string),
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total_pages: Math.ceil(result.total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/companies/:companyId/efd/:generationId
   * Get specific EFD generation details
   */
  static async getEFD(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { generationId } = req.params;

      const generation = await EFDBuilderService.getGenerationById(generationId);

      res.status(200).json({
        success: true,
        data: generation,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        res.status(404).json({
          error: 'EFD generation not found',
          code: 'NOT_FOUND',
        });
        return;
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/companies/:companyId/efd/:generationId/validate
   * Validate EFD generation
   */
  static async validateEFD(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { generationId } = req.params;

      const validation = await EFDBuilderService.validateEFD(generationId);

      res.status(200).json({
        success: true,
        data: validation,
        message: validation.is_valid
          ? 'EFD validada com sucesso'
          : `EFD com ${validation.errors.length} erros encontrados`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/companies/:companyId/efd/:generationId/download
   * Download EFD file (.txt format)
   */
  static async downloadEFD(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { generationId, companyId } = req.params;
      const { format = 'txt' } = req.query;

      const db = await getDatabase();
      const generation = await db('efd_generations').where({ id: generationId }).first();

      if (!generation) {
        res.status(404).json({
          error: 'EFD generation not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      // Get file content
      const fileBuffer = await EFDBuilderService.downloadEFD(generationId);

      // Set response headers for download
      const cnpj = generation.metadata?.cnpj || 'UNKNOWN';
      const fileName = `EFD_${cnpj}_${generation.year}${String(generation.month).padStart(2, '0')}.txt`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', fileBuffer.length);

      res.status(200).send(fileBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/companies/:companyId/efd/:generationId/accounts
   * Get account balances for EFD
   */
  static async getAccountBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { generationId } = req.params;

      const balances = await EFDBuilderService.getAccountBalances(generationId);

      res.status(200).json({
        success: true,
        data: balances,
        count: balances.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/companies/:companyId/efd/:generationId/journal-entries
   * Get journal entries included in EFD
   */
  static async getJournalEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { generationId } = req.params;

      const entries = await EFDBuilderService.getJournalEntries(generationId);

      res.status(200).json({
        success: true,
        data: entries,
        count: entries.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/companies/:companyId/efd/:generationId/cancel
   * Cancel EFD generation (soft delete)
   */
  static async cancelEFD(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { generationId } = req.params;
      const db = await getDatabase();

      const generation = await db('efd_generations').where({ id: generationId }).first();

      if (!generation) {
        res.status(404).json({
          error: 'EFD generation not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      if (['sent', 'rejected'].includes(generation.status)) {
        res.status(400).json({
          error: `Cannot cancel EFD with status ${generation.status}`,
          code: 'INVALID_STATUS',
        });
        return;
      }

      await db('efd_generations').where({ id: generationId }).update({
        status: 'cancelled',
        deleted_at: new Date(),
        updated_at: new Date(),
      });

      res.status(200).json({
        success: true,
        message: 'EFD generation cancelled',
        data: await EFDBuilderService.getGenerationById(generationId),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/companies/:companyId/efd/months
   * Get available months for EFD generation (months with journal entries)
   */
  static async getAvailableMonths(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const db = await getDatabase();

      // Get distinct months/years from journal entries
      const entries = await db('journal_entries')
        .where({ company_id: companyId })
        .select(
          db.raw("EXTRACT(MONTH FROM entry_date)::int as month"),
          db.raw("EXTRACT(YEAR FROM entry_date)::int as year"),
        )
        .distinct()
        .orderBy('year', 'month');

      // Get existing EFD generations
      const existing = await db('efd_generations')
        .where({ company_id: companyId })
        .select('month', 'year', 'status');

      // Map months with EFD status
      const months = entries.map((entry: any) => {
        const efd = existing.find((e: any) => e.month === entry.month && e.year === entry.year);
        return {
          month: entry.month,
          year: entry.year,
          has_entries: true,
          efd_status: efd?.status || null,
          efd_exists: !!efd,
        };
      });

      res.status(200).json({
        success: true,
        data: months,
        count: months.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/companies/:companyId/efd/status
   * Get EFD generation status summary
   */
  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const db = await getDatabase();

      const generations = await db('efd_generations')
        .where({ company_id: companyId })
        .select('status')
        .count('id as count')
        .groupBy('status');

      const stats = {
        total: 0,
        pending: 0,
        generating: 0,
        generated: 0,
        validated: 0,
        validation_failed: 0,
        sent: 0,
        rejected: 0,
        cancelled: 0,
      };

      for (const gen of generations) {
        stats[gen.status as keyof typeof stats] = parseInt(gen.count);
        stats.total += parseInt(gen.count);
      }

      const latest = await db('efd_generations')
        .where({ company_id: companyId })
        .orderBy('created_at', 'desc')
        .first();

      res.status(200).json({
        success: true,
        data: {
          stats,
          latest: latest || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default EFDController;
