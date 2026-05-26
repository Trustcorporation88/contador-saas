/**
 * Recurring Transaction Controller
 * HTTP handlers para lançamentos recorrentes automáticos
 */

import { Request, Response, NextFunction } from 'express';
import { RecurringTransactionService } from '../services/recurringTransactionService';
import { ListRecurringTransactionsDTO } from '../models/dtos/recurringTransactionDTO';
import { logger } from '../middleware/requestLogger';

/**
 * RecurringTransactionController
 * Handlers HTTP para gerenciar templates e visualizar execuções
 */
export class RecurringTransactionController {
  /**
   * POST /companies/:companyId/recurring-transactions
   * Criar novo template de lançamento recorrente
   * Body: { description, amount, debitAccount, creditAccount, frequency, startDate, endDate? }
   * Response: RecurringTransactionResponse
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const userId = (req as Request & { user?: { id: string } }).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const template = await RecurringTransactionService.createTemplate(
        companyId,
        userId,
        req.body,
      );

      return res.status(201).json(template);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 400 || error.status === 422) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error('Error creating recurring transaction template', {
        error: error.message,
      });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/recurring-transactions
   * Listar templates de lançamentos recorrentes
   * Query params: page, limit, status (active/inactive), frequency
   * Response: PaginatedRecurringTransactionsResponse
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;

      const filters: ListRecurringTransactionsDTO = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        status: req.query.status as 'active' | 'inactive' | undefined,
        frequency: req.query.frequency as any,
      };

      const result = await RecurringTransactionService.listTemplates(companyId, filters);
      return res.status(200).json(result);
    } catch (err: unknown) {
      logger.error('Error listing recurring transaction templates', {
        error: (err as Error).message,
      });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/recurring-transactions/:templateId
   * Buscar um template específico
   * Response: RecurringTransactionResponse
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const templateId = req.params.templateId;

      const { getDatabase } = await import('../config/database');
      const db = await getDatabase();

      const template = await db('recurring_transactions')
        .where('id', templateId)
        .where('company_id', companyId)
        .first();

      if (!template) {
        return res.status(404).json({ error: 'Template não encontrado' });
      }

      // Buscar contas
      const accounts = await db('accounts')
        .whereIn('id', [template.debit_account_id, template.credit_account_id])
        .select('id', 'code', 'name');

      const { RecurringTransactionService: Service } = await import(
        '../services/recurringTransactionService'
      );

      // Acessar método privado via type assertion (para testes)
      const formatted = (Service as any).formatResponse
        ? (Service as any).formatResponse(template, accounts)
        : this.formatTemplateResponse(template, accounts);

      return res.status(200).json(formatted);
    } catch (err: unknown) {
      logger.error('Error fetching recurring transaction template', {
        error: (err as Error).message,
      });
      return next(err);
    }
  }

  /**
   * PATCH /companies/:companyId/recurring-transactions/:templateId
   * Atualizar template (ativar/desativar ou modificar dados)
   * Body: { isActive?, description?, amount?, endDate? }
   * Response: RecurringTransactionResponse
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const templateId = req.params.templateId;

      const updated = await RecurringTransactionService.updateTemplate(
        companyId,
        templateId,
        req.body,
      );

      return res.status(200).json(updated);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 400 || error.status === 404 || error.status === 422) {
        return res.status(error.status || 400).json({ error: error.message });
      }
      logger.error('Error updating recurring transaction template', {
        error: error.message,
      });
      return next(err);
    }
  }

  /**
   * DELETE /companies/:companyId/recurring-transactions/:templateId
   * Deletar template (soft delete - apenas marca como inativo)
   * Response: { message: 'Template deletado com sucesso' }
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const templateId = req.params.templateId;

      const { getDatabase } = await import('../config/database');
      const db = await getDatabase();

      const template = await db('recurring_transactions')
        .where('id', templateId)
        .where('company_id', companyId)
        .first();

      if (!template) {
        return res.status(404).json({ error: 'Template não encontrado' });
      }

      // Soft delete - apenas marcar como inativo
      await db('recurring_transactions')
        .where('id', templateId)
        .update({ is_active: false });

      logger.info('Recurring transaction template deleted', {
        templateId,
        companyId,
      });

      return res.status(200).json({ message: 'Template deletado com sucesso' });
    } catch (err: unknown) {
      logger.error('Error deleting recurring transaction template', {
        error: (err as Error).message,
      });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/recurring-transactions/:templateId/executions
   * Listar histórico de execuções para um template
   * Query params: page, limit, status
   * Response: PaginatedExecutionsResponse
   */
  static async listExecutions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const templateId = req.params.templateId;

      const filters = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 30,
        status: req.query.status as string | undefined,
      };

      const result = await RecurringTransactionService.listExecutions(
        companyId,
        templateId,
        filters,
      );

      return res.status(200).json(result);
    } catch (err: unknown) {
      logger.error('Error listing recurring transaction executions', {
        error: (err as Error).message,
      });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/recurring-transactions/executions/all
   * Listar execuções de TODOS os templates da empresa (últimos 30 dias)
   * Query params: page, limit, status
   * Response: PaginatedExecutionsResponse
   */
  static async listAllExecutions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;

      const filters = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 30,
        status: req.query.status as string | undefined,
      };

      const result = await RecurringTransactionService.listExecutions(
        companyId,
        undefined,
        filters,
      );

      return res.status(200).json(result);
    } catch (err: unknown) {
      logger.error('Error listing all recurring transaction executions', {
        error: (err as Error).message,
      });
      return next(err);
    }
  }

  /**
   * Helper para formatar resposta de template
   * Usado quando acesso privado não está disponível
   */
  private static formatTemplateResponse(template: any, accounts: any[]): any {
    const debitAccount = accounts.find(a => a.id === template.debit_account_id);
    const creditAccount = accounts.find(a => a.id === template.credit_account_id);

    return {
      id: template.id,
      companyId: template.company_id,
      description: template.description,
      amount: Number(template.amount),
      debitAccount: {
        id: debitAccount?.id || '',
        code: debitAccount?.code || '',
        name: debitAccount?.name || '',
      },
      creditAccount: {
        id: creditAccount?.id || '',
        code: creditAccount?.code || '',
        name: creditAccount?.name || '',
      },
      frequency: template.frequency,
      startDate: template.start_date,
      endDate: template.end_date,
      isActive: template.is_active,
      nextExecutionDate: template.next_execution_date,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };
  }
}
