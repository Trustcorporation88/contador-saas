/**
 * Bank Reconciliation Controller
 * HTTP handlers para upload, sugestões e execução de reconciliação
 */

import { Request, Response, NextFunction } from 'express';
import { BankReconciliationService } from '../services/bankReconciliationService';
import {
  BankReconciliationValidator,
  BankReconciliationUploadDTO,
  ExecuteReconciliationDTO,
} from '../models/dtos/bankReconciliationDTO';
import { logger } from '../middleware/requestLogger';

/**
 * ReconciliationController - Handlers HTTP para reconciliação bancária
 */
export class ReconciliationController {
  /**
   * POST /companies/:companyId/reconciliation/upload
   * Upload e parsing de arquivo de extrato bancário
   *
   * Multipart form-data:
   *   - file: CSV com extrato bancário
   *
   * Response: { id, fileName, transactions, status }
   */
  static async upload(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const userId = (req as Request & { user?: { id: string } }).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Validar arquivo
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
      }

      const file = req.file;

      logger.info('Processing bank statement upload', {
        fileName: file.originalname,
        fileSize: file.size,
        companyId,
      });

      // Parse CSV
      const parseResult = await BankReconciliationService.parseCSVFile(
        file.buffer,
        file.originalname,
      );

      if (parseResult.transactions.length === 0) {
        return res.status(422).json({
          error: 'Nenhuma transação encontrada no arquivo',
          errors: parseResult.errors,
        });
      }

      // Criar DTO
      const uploadDTO: BankReconciliationUploadDTO = {
        file_name: file.originalname,
        bank_name: parseResult.bank_name,
        transaction_count: parseResult.transactions.length,
        transactions: parseResult.transactions,
      };

      // Criar no banco
      const uploadResponse = await BankReconciliationService.createUpload(
        companyId,
        userId,
        uploadDTO,
      );

      logger.info('Bank statement upload successful', {
        uploadId: uploadResponse.id,
        transactions: uploadResponse.transaction_count,
      });

      return res.status(201).json({
        ...uploadResponse,
        warnings: parseResult.errors.length > 0 ? parseResult.errors : undefined,
      });
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 400 || error.status === 422) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error uploading bank statement', { error: error.message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reconciliation/:uploadId/suggestions
   * Gera e retorna sugestões de matching
   *
   * Query params:
   *   - min_confidence: Filtro mínimo de confiança (0-1, default 0.7)
   *
   * Response: { uploadId, totalTransactions, matchedCount, suggestions[] }
   */
  static async getSuggestions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const uploadId = req.params.uploadId;
      const minConfidence = req.query.min_confidence
        ? Math.max(0, Math.min(1, parseFloat(req.query.min_confidence as string)))
        : 0.7;

      logger.info('Getting reconciliation suggestions', {
        uploadId,
        companyId,
        minConfidence,
      });

      // Validar upload existe
      const { upload } = await BankReconciliationService.getUpload(uploadId, companyId);

      if (!upload) {
        return res.status(404).json({ error: 'Upload não encontrado' });
      }

      // Gerar sugestões
      const suggestionsResponse = await BankReconciliationService.generateAndSaveSuggestions(
        uploadId,
        companyId,
      );

      // Filtrar por confiança mínima
      const filtered = {
        ...suggestionsResponse,
        suggestions: suggestionsResponse.suggestions.filter(s => s.confidence >= minConfidence),
      };

      logger.info('Suggestions generated', {
        uploadId,
        totalSuggestions: suggestionsResponse.suggestions.length,
        filteredSuggestions: filtered.suggestions.length,
      });

      return res.status(200).json(filtered);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Error getting suggestions', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/reconciliation/:uploadId/execute
   * Executa reconciliação: aceita sugestões e registra matches
   *
   * Body: { accepted_suggestions: [{ bank_transaction_id, journal_entry_id }, ...] }
   *
   * Response: { uploadId, processed, reconciled, unmatched }
   */
  static async executeReconciliation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const uploadId = req.params.uploadId;
      const userId = (req as Request & { user?: { id: string } }).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Validar DTO
      const validation = BankReconciliationValidator.validateExecuteDTO(req.body);
      if (!validation.isValid) {
        const msg = Object.entries(validation.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        return res.status(400).json({ error: `Validation error: ${msg}` });
      }

      const executeDTO = req.body as ExecuteReconciliationDTO;

      logger.info('Executing bank reconciliation', {
        uploadId,
        companyId,
        suggestionsCount: executeDTO.accepted_suggestions.length,
      });

      // Validar upload existe
      const { upload } = await BankReconciliationService.getUpload(uploadId, companyId);

      if (!upload) {
        return res.status(404).json({ error: 'Upload não encontrado' });
      }

      // Executar reconciliação
      const result = await BankReconciliationService.executeReconciliation(
        uploadId,
        companyId,
        userId,
        executeDTO.accepted_suggestions,
      );

      logger.info('Bank reconciliation executed successfully', {
        uploadId,
        reconciled: result.reconciled_count,
        unmatched: result.unmatched_count,
      });

      return res.status(200).json(result);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 400 || error.status === 404) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error executing reconciliation', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reconciliation
   * Listar uploads de reconciliação com paginação
   *
   * Query params:
   *   - page: Número da página (default 1)
   *   - limit: Itens por página (default 20)
   *   - status: Filtrar por status (uploaded, processed, reconciled, failed)
   *
   * Response: { uploads: [...], pagination: { page, limit, total } }
   */
  static async listUploads(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
      const status = req.query.status as string | undefined;

      logger.info('Listing bank reconciliation uploads', {
        companyId,
        page,
        limit,
        status,
      });

      const db = (await import('../config/database')).getDatabase();
      const database = await db;

      let query = database('bank_reconciliation_uploads').where('company_id', companyId);

      if (status) {
        query = query.where('status', status);
      }

      const total = await query.clone().count('* as count').first();
      const uploads = await query
        .orderBy('uploaded_at', 'desc')
        .limit(limit)
        .offset((page - 1) * limit);

      return res.status(200).json({
        uploads,
        pagination: {
          page,
          limit,
          total: typeof total?.count === 'string' ? parseInt(total.count, 10) : (total?.count || 0),
          pages: Math.ceil((typeof total?.count === 'string' ? parseInt(total.count, 10) : (total?.count || 0)) / limit),
        },
      });
    } catch (err) {
      logger.error('Error listing uploads', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reconciliation/:uploadId
   * Obter detalhes do upload
   */
  static async getUploadDetails(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const uploadId = req.params.uploadId;

      logger.info('Getting upload details', { uploadId, companyId });

      const { upload, transactions } = await BankReconciliationService.getUpload(
        uploadId,
        companyId,
      );

      return res.status(200).json({
        upload,
        transactions,
        summary: {
          total: transactions.length,
          debits: transactions.filter((t: any) => t.type === 'debit').length,
          credits: transactions.filter((t: any) => t.type === 'credit').length,
        },
      });
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Error getting upload details', { error: (err as Error).message });
      return next(err);
    }
  }
}
