/**
 * Recurring Transaction Service
 * Lógica de negócio para lançamentos recorrentes automáticos
 * Responsável por: criar templates, executar, rastrear execuções, validar contas
 */

import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  CreateRecurringTransactionDTO,
  UpdateRecurringTransactionDTO,
  RecurringTransactionResponse,
  RecurringTransactionExecutionResponse,
  PaginatedRecurringTransactionsResponse,
  PaginatedExecutionsResponse,
  ListRecurringTransactionsDTO,
  RecurringTransactionFrequency,
  ExecutionStatus,
  RecurringTransactionDTOValidator,
} from '../models/dtos/recurringTransactionDTO';
import { JournalService } from './journalService';

/**
 * RecurringTransactionService
 * Gerencia templates e execuções de lançamentos recorrentes
 */
export class RecurringTransactionService {
  /**
   * Criar novo template de lançamento recorrente
   * @param companyId ID da empresa (isolamento multi-tenant)
   * @param userId ID do usuário criador
   * @param data CreateRecurringTransactionDTO
   * @returns RecurringTransactionResponse
   */
  static async createTemplate(
    companyId: string,
    userId: string,
    data: CreateRecurringTransactionDTO,
  ): Promise<RecurringTransactionResponse> {
    const db = await getDatabase();

    // 1. Validar DTO
    const validation = RecurringTransactionDTOValidator.validateCreateDTO(data);
    if (!validation.isValid) {
      const msg = Object.entries(validation.errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      throw Object.assign(new Error(`Validation error: ${msg}`), { status: 400 });
    }

    // 2. Verificar que as contas existem e pertencem à empresa
    const accounts = await db('accounts')
      .whereIn('id', [data.debitAccount, data.creditAccount])
      .where('company_id', companyId)
      .where('is_active', true)
      .select('id', 'code', 'name');

    if (accounts.length !== 2) {
      throw Object.assign(
        new Error('Uma ou ambas as contas não foram encontradas ou estão inativas'),
        { status: 422 },
      );
    }

    // 3. Calcular próxima data de execução
    const nextExecutionDate = this.calculateNextExecutionDate(data.frequency, new Date(data.startDate));

    // 4. Inserir template
    const trx = await db.transaction();
    try {
      const [id] = await trx('recurring_transactions').insert({
        company_id: companyId,
        description: data.description,
        amount: data.amount,
        debit_account_id: data.debitAccount,
        credit_account_id: data.creditAccount,
        frequency: data.frequency,
        start_date: data.startDate,
        end_date: data.endDate || null,
        is_active: true,
        next_execution_date: nextExecutionDate,
        created_by_id: userId,
      });

      await trx.commit();

      logger.info('Recurring transaction template created', {
        id,
        companyId,
        frequency: data.frequency,
      });

      return this.formatResponse(
        {
          id,
          company_id: companyId,
          description: data.description,
          amount: data.amount,
          debit_account_id: data.debitAccount,
          credit_account_id: data.creditAccount,
          frequency: data.frequency,
          start_date: data.startDate,
          end_date: data.endDate || null,
          is_active: true,
          next_execution_date: nextExecutionDate,
          created_by_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        accounts,
      );
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Listar templates de lançamentos recorrentes
   * @param companyId ID da empresa
   * @param filters Filtros opcionais (page, limit, status, frequency)
   * @returns PaginatedRecurringTransactionsResponse
   */
  static async listTemplates(
    companyId: string,
    filters: ListRecurringTransactionsDTO = {},
  ): Promise<PaginatedRecurringTransactionsResponse> {
    const db = await getDatabase();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Construir query base
    let query = db('recurring_transactions').where('company_id', companyId);

    if (filters.status === 'active') {
      query = query.where('is_active', true);
    } else if (filters.status === 'inactive') {
      query = query.where('is_active', false);
    }

    if (filters.frequency) {
      query = query.where('frequency', filters.frequency);
    }

    // Contar total
    const countQuery = query.clone().count('id as count');
    const [{ count }] = await countQuery;
    const total = Number(count);

    // Buscar registros
    const records = await query
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Buscar contas para cada template
    const accountIds = new Set<string>();
    records.forEach(r => {
      accountIds.add(r.debit_account_id);
      accountIds.add(r.credit_account_id);
    });

    let accounts: any[] = [];
    if (accountIds.size > 0) {
      accounts = await db('accounts')
        .whereIn('id', Array.from(accountIds))
        .select('id', 'code', 'name');
    }

    const formattedData = records.map(r => this.formatResponse(r, accounts));

    const totalPages = Math.ceil(total / limit);

    return {
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Atualizar template (ativar/desativar ou modificar)
   * @param companyId ID da empresa
   * @param templateId ID do template
   * @param data Dados para atualizar
   * @returns RecurringTransactionResponse
   */
  static async updateTemplate(
    companyId: string,
    templateId: string,
    data: UpdateRecurringTransactionDTO,
  ): Promise<RecurringTransactionResponse> {
    const db = await getDatabase();

    // 1. Validar DTO
    const validation = RecurringTransactionDTOValidator.validateUpdateDTO(data);
    if (!validation.isValid) {
      const msg = Object.entries(validation.errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      throw Object.assign(new Error(`Validation error: ${msg}`), { status: 400 });
    }

    // 2. Buscar template existente
    const template = await db('recurring_transactions')
      .where('id', templateId)
      .where('company_id', companyId)
      .first();

    if (!template) {
      throw Object.assign(new Error('Template não encontrado'), { status: 404 });
    }

    // 3. Preparar dados para atualização
    const updateData: Record<string, any> = {
      updated_at: new Date(),
    };

    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.amount !== undefined) {
      updateData.amount = data.amount;
    }

    if (data.endDate !== undefined) {
      updateData.end_date = data.endDate;
    }

    // 4. Atualizar
    await db('recurring_transactions')
      .where('id', templateId)
      .update(updateData);

    // 5. Buscar template atualizado
    const updated = await db('recurring_transactions')
      .where('id', templateId)
      .first();

    // 6. Buscar contas
    const accounts = await db('accounts')
      .whereIn('id', [updated.debit_account_id, updated.credit_account_id])
      .select('id', 'code', 'name');

    logger.info('Recurring transaction template updated', { templateId, companyId });

    return this.formatResponse(updated, accounts);
  }

  /**
   * Executar todos os lançamentos recorrentes vencidos
   * Chamado pelo cron job diariamente
   * @returns Relatório de execução
   */
  static async executeRecurringTransactions(): Promise<{
    total: number;
    success: number;
    failed: number;
    errors: Array<{ templateId: string; error: string }>;
  }> {
    const db = await getDatabase();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const report = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as Array<{ templateId: string; error: string }>,
    };

    try {
      // 1. Buscar todos os templates ativos vencidos para hoje
      const templates = await db('recurring_transactions')
        .where('is_active', true)
        .where('next_execution_date', '<=', today)
        .whereRaw('(end_date IS NULL OR end_date >= ?)', [today])
        .select('*');

      report.total = templates.length;

      for (const template of templates) {
        const trx = await db.transaction();
        try {
          // 2. Criar lançamento contábil usando JournalService
          const journalEntry = await this.createJournalEntryFromTemplate(
            template,
            today,
            trx,
          );

          // 3. Registrar execução bem-sucedida
          await trx('recurring_transaction_executions').insert({
            recurring_transaction_id: template.id,
            execution_date: today,
            journal_entry_id: journalEntry.id,
            status: ExecutionStatus.SUCCESS,
            error_message: null,
            retry_count: 0,
            executed_at: new Date(),
          });

          // 4. Calcular próxima execução
          const nextDate = this.calculateNextExecutionDate(
            template.frequency,
            new Date(today),
          );

          await trx('recurring_transactions')
            .where('id', template.id)
            .update({
              next_execution_date: nextDate,
            });

          await trx.commit();
          report.success++;

          logger.info('Recurring transaction executed successfully', {
            templateId: template.id,
            journalEntryId: journalEntry.id,
          });
        } catch (error) {
          await trx.rollback();
          report.failed++;

          const errorMsg = error instanceof Error ? error.message : String(error);
          report.errors.push({
            templateId: template.id,
            error: errorMsg,
          });

          // Registrar falha no BD (fora de transação)
          try {
            await db('recurring_transaction_executions').insert({
              recurring_transaction_id: template.id,
              execution_date: today,
              journal_entry_id: null,
              status: ExecutionStatus.FAILED,
              error_message: errorMsg,
              retry_count: 0,
              executed_at: new Date(),
            });
          } catch (logError) {
            logger.error('Failed to log execution error', { logError });
          }

          logger.error('Recurring transaction execution failed', {
            templateId: template.id,
            error: errorMsg,
          });
        }
      }

      logger.info('Recurring transactions execution cycle completed', report);
      return report;
    } catch (error) {
      logger.error('Error in executeRecurringTransactions', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Listar histórico de execuções
   * @param companyId ID da empresa
   * @param templateId ID do template (opcional - se não informado, lista todas)
   * @param filters Filtros opcionais
   * @returns PaginatedExecutionsResponse
   */
  static async listExecutions(
    companyId: string,
    templateId?: string,
    filters: { page?: number; limit?: number; status?: string } = {},
  ): Promise<PaginatedExecutionsResponse> {
    const db = await getDatabase();
    const page = filters.page || 1;
    const limit = filters.limit || 30;
    const offset = (page - 1) * limit;

    // Construir query
    let query = db('recurring_transaction_executions as e')
      .join(
        'recurring_transactions as rt',
        'e.recurring_transaction_id',
        'rt.id',
      )
      .where('rt.company_id', companyId);

    if (templateId) {
      query = query.where('e.recurring_transaction_id', templateId);
    }

    if (filters.status) {
      query = query.where('e.status', filters.status);
    }

    // Contar total
    const countQuery = query.clone().count('e.id as count');
    const [{ count }] = await countQuery;
    const total = Number(count);

    // Buscar registros
    const records = await query
      .select(
        'e.id',
        'e.recurring_transaction_id',
        'e.execution_date',
        'e.journal_entry_id',
        'e.status',
        'e.error_message',
        'e.retry_count',
        'e.executed_at',
        'e.created_at',
      )
      .orderBy('e.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const formattedData = records.map(r => this.formatExecutionResponse(r));
    const totalPages = Math.ceil(total / limit);

    return {
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Criar lançamento contábil a partir de template
   * Método privado - não expõe detalhes internos
   */
  private static async createJournalEntryFromTemplate(
    template: any,
    executionDate: string,
    trx: any,
  ): Promise<{ id: string }> {
    // Preparar DTO para JournalService
    const journalDTO = {
      entry_date: executionDate,
      description: `${template.description} (Automático - Recorrência)`,
      reference_type: 'RECURRING_TRANSACTION',
      reference_number: template.id,
      lines: [
        {
          account_id: template.debit_account_id,
          debit: template.amount,
          credit: 0,
        },
        {
          account_id: template.credit_account_id,
          debit: 0,
          credit: template.amount,
        },
      ],
    };

    // Usar transação existente para inserir
    const [id] = await trx('journal_entries').insert({
      company_id: template.company_id,
      created_by: template.created_by_id,
      entry_date: journalDTO.entry_date,
      description: journalDTO.description,
      reference_type: journalDTO.reference_type,
      reference_number: journalDTO.reference_number,
      total_debit: template.amount,
      total_credit: template.amount,
      is_posted: false,
    });

    // Inserir linhas
    for (const line of journalDTO.lines) {
      await trx('journal_lines').insert({
        journal_entry_id: id,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
      });
    }

    return { id };
  }

  /**
   * Calcular próxima data de execução baseado na frequência
   */
  private static calculateNextExecutionDate(
    frequency: RecurringTransactionFrequency,
    currentDate: Date,
  ): string {
    const next = new Date(currentDate);

    switch (frequency) {
      case RecurringTransactionFrequency.DIARIO:
        next.setDate(next.getDate() + 1);
        break;
      case RecurringTransactionFrequency.MENSAL:
        next.setMonth(next.getMonth() + 1);
        break;
      case RecurringTransactionFrequency.ANUAL:
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next.toISOString().split('T')[0]; // Retornar como YYYY-MM-DD
  }

  /**
   * Formatar resposta de template
   */
  private static formatResponse(template: any, accounts: any[]): RecurringTransactionResponse {
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

  /**
   * Formatar resposta de execução
   */
  private static formatExecutionResponse(execution: any): RecurringTransactionExecutionResponse {
    return {
      id: execution.id,
      recurringTransactionId: execution.recurring_transaction_id,
      executionDate: execution.execution_date,
      journalEntryId: execution.journal_entry_id,
      status: execution.status,
      errorMessage: execution.error_message,
      retryCount: execution.retry_count,
      executedAt: execution.executed_at,
      createdAt: execution.created_at,
    };
  }
}
