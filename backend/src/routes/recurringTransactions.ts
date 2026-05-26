/**
 * Recurring Transactions Routes
 * Endpoints para gerenciar lançamentos recorrentes automáticos
 * Base: /api/v1/companies/:companyId/recurring-transactions
 */

import express, { Router } from 'express';
import { RecurringTransactionController } from '../controllers/recurringTransactionController';

/**
 * Criar e configurar router de lançamentos recorrentes
 */
export const createRecurringTransactionsRouter = (): Router => {
  const router = express.Router({ mergeParams: true });

  /**
   * POST /companies/:companyId/recurring-transactions
   * Criar novo template de lançamento recorrente
   */
  router.post('/', RecurringTransactionController.create);

  /**
   * GET /companies/:companyId/recurring-transactions
   * Listar templates com paginação e filtros
   */
  router.get('/', RecurringTransactionController.list);

  /**
   * GET /companies/:companyId/recurring-transactions/executions/all
   * Listar execuções de todos os templates (últimos 30 dias)
   * NOTA: Deve vir ANTES de /:templateId para evitar conflito de rotas
   */
  router.get('/executions/all', RecurringTransactionController.listAllExecutions);

  /**
   * GET /companies/:companyId/recurring-transactions/:templateId
   * Buscar template específico por ID
   */
  router.get('/:templateId', RecurringTransactionController.getById);

  /**
   * PATCH /companies/:companyId/recurring-transactions/:templateId
   * Atualizar template (ativar/desativar ou modificar)
   */
  router.patch('/:templateId', RecurringTransactionController.update);

  /**
   * DELETE /companies/:companyId/recurring-transactions/:templateId
   * Deletar template (soft delete)
   */
  router.delete('/:templateId', RecurringTransactionController.delete);

  /**
   * GET /companies/:companyId/recurring-transactions/:templateId/executions
   * Listar execuções de um template específico
   */
  router.get('/:templateId/executions', RecurringTransactionController.listExecutions);

  return router;
};

export default createRecurringTransactionsRouter;
