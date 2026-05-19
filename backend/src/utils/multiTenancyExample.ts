/**
 * Multi-Tenancy Integration Example
 * Como integrar o multi-tenancy middleware em suas rotas e controllers
 */

import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { applyMultiTenantMiddleware, requirePermission } from '../middleware';
import { TenantService } from '../services/tenantService';
import { insertScoped, updateScoped, deleteScoped } from '../utils/queryBuilder';

/**
 * EXEMPLO 1: Rotas com Multi-Tenancy
 * 
 * Aplicar middleware multi-tenant para proteger rotas por company_id
 */
export function createCompanyRoutes(): Router {
  const router = Router();

  // Aplicar middleware multi-tenant a TODAS as rotas com :companyId
  router.use('/:companyId', ...applyMultiTenantMiddleware());

  /**
   * GET /api/v1/companies/:companyId/accounts
   * Lista contas da empresa
   * 
   * FLOW:
   * 1. authenticateToken: valida JWT
   * 2. validateTenantAccess: valida acesso à empresa
   * 3. Controller: executa com req.tenant injetado
   */
  router.get('/:companyId/accounts', async (req: Request, res: Response) => {
    try {
      const db = await getDatabase();
      const { companyId } = req.tenant!;

      // Query automaticamente scoped por company_id
      const accounts = await db('accounts')
        .withTenant(companyId)
        .select('id', 'code', 'name', 'balance', 'type')
        .orderBy('code', 'asc');

      res.json({
        success: true,
        data: accounts,
        meta: {
          companyId,
          count: accounts.length,
        },
      });

      // Log audit
      await TenantService.auditAccess(
        req.tenant.userId,
        companyId,
        'VIEW_ACCOUNTS'
      );
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch accounts',
      });
    }
  });

  /**
   * POST /api/v1/companies/:companyId/accounts
   * Cria conta (requer permissão 'write')
   */
  router.post(
    '/:companyId/accounts',
    requirePermission('write'),
    async (req: Request, res: Response) => {
      try {
        const db = await getDatabase();
        const { companyId, userId } = req.tenant!;
        const { code, name, type, parentCode } = req.body;

        // Validar entrada
        if (!code || !name || !type) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Missing required fields: code, name, type',
          });
          return;
        }

        // Inserir conta com company_id automaticamente adicionado
        const [accountId] = await insertScoped(db, companyId, 'accounts', {
          code,
          name,
          type,
          parent_code: parentCode || null,
          is_active: true,
          created_by: userId,
          created_at: new Date(),
        });

        res.status(201).json({
          success: true,
          data: { id: accountId, code, name, type },
          message: 'Account created successfully',
        });

        // Log audit
        await TenantService.auditAccess(
          userId,
          companyId,
          'CREATE_ACCOUNT',
          { accountId, code }
        );
      } catch (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create account',
        });
      }
    }
  );

  /**
   * PUT /api/v1/companies/:companyId/accounts/:accountId
   * Atualiza conta (requer permissão 'write')
   */
  router.put(
    '/:companyId/accounts/:accountId',
    requirePermission('write'),
    async (req: Request, res: Response) => {
      try {
        const db = await getDatabase();
        const { companyId, userId } = req.tenant!;
        const { accountId } = req.params;
        const { name, type, isActive } = req.body;

        // UPDATE automaticamente scoped
        await updateScoped(db, companyId, 'accounts')
          .update({
            name,
            type,
            is_active: isActive,
            updated_by: userId,
            updated_at: new Date(),
          })
          .where('id', accountId);

        res.json({
          success: true,
          message: 'Account updated successfully',
        });

        // Log audit
        await TenantService.auditAccess(
          userId,
          companyId,
          'UPDATE_ACCOUNT',
          { accountId }
        );
      } catch (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to update account',
        });
      }
    }
  );

  /**
   * DELETE /api/v1/companies/:companyId/accounts/:accountId
   * Deleta conta (requer permissão 'delete')
   */
  router.delete(
    '/:companyId/accounts/:accountId',
    requirePermission('delete'),
    async (req: Request, res: Response) => {
      try {
        const db = await getDatabase();
        const { companyId, userId } = req.tenant!;
        const { accountId } = req.params;

        // DELETE automaticamente scoped - só pode deletar conta da própria empresa
        const deleted = await deleteScoped(db, companyId, 'accounts')
          .where('id', accountId);

        if (deleted === 0) {
          res.status(404).json({
            error: 'Not Found',
            message: 'Account not found',
          });
          return;
        }

        res.json({
          success: true,
          message: 'Account deleted successfully',
        });

        // Log audit
        await TenantService.auditAccess(
          userId,
          companyId,
          'DELETE_ACCOUNT',
          { accountId }
        );
      } catch (error) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to delete account',
        });
      }
    }
  );

  return router;
}

/**
 * EXEMPLO 2: Serviço com Multi-Tenancy
 * Como usar TenantService em lógica de negócio
 */
export class AccountService {
  /**
   * Cria conta com validações de tenant
   */
  static async createAccount(
    companyId: string,
    userId: string,
    data: {
      code: string;
      name: string;
      type: string;
      parentCode?: string;
    }
  ): Promise<any> {
    // 1. Validar que user tem acesso
    const access = await TenantService.validateUserAccess(userId, companyId);
    if (!access.isValid) {
      throw new Error(`User does not have access to company ${companyId}`);
    }

    // 2. Validar que user tem permissão 'write'
    const hasPermission = await TenantService.checkPermission(
      userId,
      companyId,
      'write'
    );
    if (!hasPermission) {
      throw new Error('User does not have write permission');
    }

    // 3. Inserir com tenant scoping
    const db = await getDatabase();
    const [accountId] = await insertScoped(db, companyId, 'accounts', {
      code: data.code,
      name: data.name,
      type: data.type,
      parent_code: data.parentCode || null,
      is_active: true,
      created_by: userId,
      created_at: new Date(),
    });

    // 4. Audit
    await TenantService.auditAccess(
      userId,
      companyId,
      'CREATE_ACCOUNT',
      { accountId, code: data.code }
    );

    return { id: accountId, ...data };
  }

  /**
   * Obtém contas com filtros opcionais
   */
  static async getAccounts(
    companyId: string,
    userId: string,
    filters?: {
      type?: string;
      isActive?: boolean;
    }
  ): Promise<any[]> {
    // Validar acesso
    const access = await TenantService.validateUserAccess(userId, companyId);
    if (!access.isValid) {
      throw new Error(`User does not have access to company ${companyId}`);
    }

    // Query com tenant scoping
    const db = await getDatabase();
    let query = db('accounts').withTenant(companyId);

    if (filters?.type) {
      query = query.where('type', filters.type);
    }

    if (filters?.isActive !== undefined) {
      query = query.where('is_active', filters.isActive);
    }

    const accounts = await query.select('*').orderBy('code', 'asc');

    // Audit
    await TenantService.auditAccess(userId, companyId, 'VIEW_ACCOUNTS');

    return accounts;
  }
}

/**
 * EXEMPLO 3: Transação com Multi-Tenancy
 */
export async function createAccountsWithTransation(
  companyId: string,
  userId: string,
  accountsData: Array<{ code: string; name: string; type: string }>
): Promise<any[]> {
  const db = await getDatabase();

  // Use tenantTransaction para queries automáticas com scoping
  const result = await db.transaction(async (trx) => {
    const createdAccounts = [];

    for (const data of accountsData) {
      // Cada query na transação é automaticamente scoped
      const [accountId] = await trx('accounts')
        .withTenant(companyId)
        .insert({
          code: data.code,
          name: data.name,
          type: data.type,
          created_by: userId,
          created_at: new Date(),
        });

      createdAccounts.push({ id: accountId, ...data });
    }

    // Audit da transação inteira
    await TenantService.auditAccess(
      userId,
      companyId,
      'BATCH_CREATE_ACCOUNTS',
      { count: createdAccounts.length }
    );

    return createdAccounts;
  });

  return result;
}

/**
 * EXEMPLO 4: Company Switching
 * Usuário muda de empresa (context switching)
 */
export async function switchUserCompany(
  userId: string,
  newCompanyId: string
): Promise<{ success: boolean; token?: string }> {
  // Validar que user tem acesso à nova empresa
  const access = await TenantService.validateUserAccess(userId, newCompanyId);
  if (!access.isValid) {
    return {
      success: false,
    };
  }

  // Gerar novo token com novo company_id
  const result = await TenantService.switchCompany(userId, newCompanyId);
  return {
    success: result.success,
    token: result.newToken,
  };
}

/**
 * EXEMPLO 5: Validação de Permissões Avançada
 */
export async function checkUserActions(
  userId: string,
  companyId: string,
  actions: string[]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};

  for (const action of actions) {
    result[action] = await TenantService.checkPermission(
      userId,
      companyId,
      action
    );
  }

  return result;
}

/**
 * EXEMPLO 6: Relatórios de Audit
 */
export async function getCompanyAuditReport(
  companyId: string,
  days: number = 30
): Promise<any> {
  return TenantService.getAccessReportByCompany(companyId, days);
}

export default {
  createCompanyRoutes,
  AccountService,
  createAccountsWithTransation,
  switchUserCompany,
  checkUserActions,
  getCompanyAuditReport,
};
