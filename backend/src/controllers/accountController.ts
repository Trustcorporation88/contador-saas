/**
 * Account Controller
 * Handlers HTTP para endpoints de plano de contas
 * Implementa autenticação, autorização e manipulação de requisições/respostas
 * Com cache Redis para otimização de performance
 */

import { Request, Response } from 'express';
import { AccountService } from '../services/accountService';
import { logger } from '../middleware/requestLogger';
import {
  CreateAccountDTO,
  UpdateAccountDTO,
  AccountFilters,
  AccountTypeEnum,
  TaxCodeEnum,
} from '../models/dtos/accountDTO';
import cacheService, { TTL_CONFIG } from '../services/cache/cacheService';
import CacheKeys from '../services/cache/cacheKeys';

/**
 * Account Controller - Handlers para endpoints de contas
 * Todos os endpoints são isolados por empresa (multi-tenant)
 */
export class AccountController {
  /**
   * GET /companies/:companyId/accounts
   * Listar contas com filtros, paginação e opção de hierarquia
   * Acesso: Todos os usuários (isolamento por empresa)
   * Cache: 15 minutos
   *
   * Query params:
   * - page: número da página (default: 1)
   * - limit: itens por página (default: 50, max: 500)
   * - search: busca em name ou code
   * - type: filtrar por tipo (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
   * - hierarchy: true retorna tree, false retorna flat list
   * - parent_code: filtrar sub-contas
   * - tax_code: filtrar por imposto
   *
   * Responses:
   * - 200: Lista de contas (flat ou hierárquica)
   * - 400: Validação de filtros falhou
   * - 403: Sem acesso à empresa
   * - 404: Empresa não encontrada
   */
  static async listAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      const { page, limit, search, type, hierarchy, parent_code, tax_code } = req.query;

      // Montar filtros
      const filters: AccountFilters = {};
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);
      if (search) filters.search = search as string;
      if (type) filters.type = type as AccountTypeEnum;
      if (hierarchy === 'true') filters.hierarchy = true;
      if (parent_code) filters.parent_code = parent_code as string;
      if (tax_code) filters.tax_code = tax_code as TaxCodeEnum;

      // Determinar cache key baseado em hierarchy
      const cacheKey = filters.hierarchy
        ? CacheKeys.accountsTree(companyId)
        : CacheKeys.accountsList(companyId, filters);

      // Try cache first
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Cache HIT - Accounts List', {
          companyId,
          hierarchy: filters.hierarchy,
          key: cacheKey,
        });
        res.status(200).json(cached);
        return;
      }

      // Cache MISS - fetch from database
      logger.info('Cache MISS - Accounts List', {
        companyId,
        hierarchy: filters.hierarchy,
        key: cacheKey,
      });
      const result = await AccountService.list(companyId, filters);

      // Store in cache (15 minutos)
      await cacheService.set(cacheKey, result, TTL_CONFIG.ACCOUNTS);

      res.status(200).json(result);
      logger.info(`Listed accounts for company ${companyId}`, {
        filters,
        resultCount: Array.isArray((result as any).data) ? (result as any).data.length : 0,
      });
    } catch (error) {
      const message = (error as Error).message || 'Failed to list accounts';

      if (message.includes('Validation error')) {
        res.status(400).json({ error: 'Invalid filters', details: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ error: 'Company not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
        logger.error('Error listing accounts', error);
      }
    }
  }

  /**
   * POST /companies/:companyId/accounts
   * Criar nova conta contábil
   * Acesso: ACCOUNTANT, ADMIN
   * INVALIDATES CACHE: Invalida todos os caches de accounts da empresa
   *
   * Body:
   * {
   *   code: string (único por empresa, formato: 1.1.1.01),
   *   name: string (1-255 caracteres),
   *   type: ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE,
   *   parent_code?: string (código da conta pai),
   *   tax_code?: IRPJ | CSLL | PIS | COFINS | ICMS | ISS,
   *   is_analytical?: boolean
   * }
   *
   * Responses:
   * - 201: Conta criada com sucesso
   * - 400: Validação falhou
   * - 403: Sem acesso (não é ACCOUNTANT/ADMIN)
   * - 409: Código já existe
   * - 404: Parent code não encontrado
   */
  static async createAccount(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      const data = req.body as CreateAccountDTO;

      const account = await AccountService.create(companyId, data);

      // INVALIDATE CACHE: Remove todos os caches de accounts desta empresa
      const invalidatedCount = await cacheService.invalidateAccounts(companyId);
      logger.info('Cache invalidated after account creation', {
        companyId,
        accountId: account.id,
        invalidatedKeys: invalidatedCount,
      });

      res.status(201).json(account);
      logger.info(`Account created: ${account.id} (${account.code}) in company ${companyId}`);
    } catch (error) {
      const message = (error as Error).message || 'Failed to create account';

      if (message.includes('Validation error')) {
        res.status(400).json({ error: 'Invalid input', details: message });
      } else if (message.includes('already exists')) {
        res.status(409).json({ error: 'Account code already exists', details: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ error: 'Referenced account not found', details: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
        logger.error('Error creating account', error);
      }
    }
  }

  /**
   * GET /companies/:companyId/accounts/:accountId
   * Obter detalhes de uma conta específica
   * Acesso: Todos os usuários (isolamento por empresa)
   *
   * Responses:
   * - 200: Detalhes da conta com saldo
   * - 403: Sem acesso à empresa
   * - 404: Conta não encontrada
   */
  static async getAccount(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, accountId } = req.params;

      const account = await AccountService.getById(accountId, companyId);

      res.status(200).json(account);
      logger.info(`Retrieved account: ${accountId} (${account.code})`);
    } catch (error) {
      const message = (error as Error).message || 'Failed to get account';

      if (message.includes('not found')) {
        res.status(404).json({ error: 'Account not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
        logger.error('Error getting account', error);
      }
    }
  }

  /**
   * PUT /companies/:companyId/accounts/:accountId
   * Atualizar conta contábil
   * Acesso: ACCOUNTANT, ADMIN
   * IMUTÁVEL: code (não pode ser alterado)
   * INVALIDATES CACHE: Invalida todos os caches de accounts da empresa
   *
   * Body:
   * {
   *   name?: string,
   *   type?: ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE,
   *   parent_code?: string,
   *   tax_code?: IRPJ | CSLL | PIS | COFINS | ICMS | ISS,
   *   is_analytical?: boolean
   * }
   *
   * Responses:
   * - 200: Conta atualizada
   * - 400: Validação falhou ou ciclo na hierarquia
   * - 403: Sem acesso (não é ACCOUNTANT/ADMIN)
   * - 404: Conta ou parent não encontrado
   */
  static async updateAccount(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, accountId } = req.params;
      const data = req.body as UpdateAccountDTO;

      const account = await AccountService.update(accountId, companyId, data);

      // INVALIDATE CACHE
      const invalidatedCount = await cacheService.invalidateAccounts(companyId);
      logger.info('Cache invalidated after account update', {
        companyId,
        accountId,
        invalidatedKeys: invalidatedCount,
      });

      res.status(200).json(account);
      logger.info(`Account updated: ${accountId} (${account.code})`);
    } catch (error) {
      const message = (error as Error).message || 'Failed to update account';

      if (message.includes('Validation error')) {
        res.status(400).json({ error: 'Invalid input', details: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ error: 'Account or parent not found', details: message });
      } else if (message.includes('cycle')) {
        res.status(400).json({ error: 'Invalid hierarchy', details: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
        logger.error('Error updating account', error);
      }
    }
  }

  /**
   * DELETE /companies/:companyId/accounts/:accountId
   * Deletar conta (soft delete)
   * Acesso: ADMIN only
   * INVALIDATES CACHE: Invalida todos os caches de accounts da empresa
   *
   * Responses:
   * - 204: Deletado com sucesso (vazio)
   * - 403: Sem acesso (não é ADMIN)
   * - 404: Conta não encontrada
   * - 409: Conta tem lançamentos associados
   */
  static async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, accountId } = req.params;

      await AccountService.delete(accountId, companyId);

      // INVALIDATE CACHE
      const invalidatedCount = await cacheService.invalidateAccounts(companyId);
      logger.info('Cache invalidated after account deletion', {
        companyId,
        accountId,
        invalidatedKeys: invalidatedCount,
      });

      res.status(204).send();
      logger.info(`Account deleted: ${accountId}`);
    } catch (error) {
      const message = (error as Error).message || 'Failed to delete account';

      if (message.includes('not found')) {
        res.status(404).json({ error: 'Account not found' });
      } else if (message.includes('journal entries')) {
        res.status(409).json({ error: 'Cannot delete account with journal entries' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
        logger.error('Error deleting account', error);
      }
    }
  }

  /**
   * GET /companies/:companyId/accounts/:accountId/balance
   * Obter saldo de uma conta
   * Acesso: Todos os usuários
   *
   * Responses:
   * - 200: {accountId, code, name, balance, debit_total, credit_total}
   * - 404: Conta não encontrada
   */
  static async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, accountId } = req.params;

      const balance = await AccountService.getBalance(accountId, companyId);

      res.status(200).json(balance);
      logger.info(`Retrieved balance for account: ${accountId}`, { balance: balance.balance });
    } catch (error) {
      const message = (error as Error).message || 'Failed to get balance';

      if (message.includes('not found')) {
        res.status(404).json({ error: 'Account not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
        logger.error('Error getting account balance', error);
      }
    }
  }

  /**
   * GET /companies/:companyId/accounts/hierarchy
   * Obter hierarquia de contas
   * Acesso: Todos os usuários
   *
   * Query params:
   * - parent_code: filtrar sub-contas de um parent (opcional)
   *
   * Responses:
   * - 200: Árvore de contas
   * - 404: Parent code não encontrado (se informado)
   */
  static async getHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      const { parent_code } = req.query;

      const hierarchy = await AccountService.getHierarchy(
        companyId,
        parent_code as string | undefined,
      );

      res.status(200).json({ data: hierarchy });
      logger.info(`Retrieved hierarchy for company ${companyId}`);
    } catch (error) {
      const message = (error as Error).message || 'Failed to get hierarchy';

      if (message.includes('not found')) {
        res.status(404).json({ error: 'Parent account not found', details: message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
        logger.error('Error getting account hierarchy', error);
      }
    }
  }

  /**
   * POST /companies/:companyId/accounts/import-plano
   * Importar plano de contas padrão
   * Acesso: ADMIN only
   *
   * Body:
   * {
   *   overwrite?: boolean (default: false)
   * }
   * Se overwrite=false, ignora contas que já existem
   * Se overwrite=true, atualiza contas existentes
   *
   * Responses:
   * - 200: {imported, skipped, total, errors?}
   * - 403: Sem acesso (não é ADMIN)
   * - 409: Conflito se overwrite=false
   * - 500: Erro ao processar arquivo
   */
  static async importPlano(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      const { overwrite } = req.body;

      const result = await AccountService.importPadraoPlano(companyId, overwrite ?? false);

      res.status(200).json(result);
      logger.info(
        `Imported plano de contas: ${result.imported} imported, ${result.skipped} skipped`,
        {
          companyId,
        },
      );
    } catch (error) {
      const message = (error as Error).message || 'Failed to import plano de contas';

      if (message.includes('not found')) {
        res.status(500).json({ error: 'File not found', details: message });
      } else if (message.includes('Invalid')) {
        res.status(500).json({ error: 'Invalid file format', details: message });
      } else {
        res.status(500).json({ error: 'Internal server error', details: message });
        logger.error('Error importing plano de contas', error);
      }
    }
  }
}
