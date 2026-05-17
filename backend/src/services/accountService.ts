/**
 * Account Service
 * Lógica de negócio para gerenciamento de plano de contas
 * Implementa CRUD, cálculo de saldos, hierarquia e importação de plano padrão
 */

import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  CreateAccountDTO,
  UpdateAccountDTO,
  AccountResponse,
  PaginatedAccountResponse,
  AccountHierarchy,
  AccountBalanceResponse,
  AccountFilters,
  ImportPlanoResponse,
  AccountDTOValidator,
  AccountTypeEnum,
} from '../models/dtos/accountDTO';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Account Service - Gerencia operações de plano de contas
 * Responsável por criar, atualizar, deletar e listar contas contábeis
 * Implementa validações, cálculo de saldos, hierarquia e importação
 */
export class AccountService {
  /**
   * Criar nova conta contábil
   * Valida código único por empresa, parent_code, e impede ciclos
   *
   * @param companyId - ID da empresa (isolamento multi-tenant)
   * @param data - CreateAccountDTO com dados da conta
   * @returns Promise<AccountResponse>
   * @throws Error se validação falhar, código duplicado, ou parent inválido
   */
  static async create(companyId: string, data: CreateAccountDTO): Promise<AccountResponse> {
    const db = await getDatabase();

    // Validar DTO
    const validation = AccountDTOValidator.validateCreateDTO(data);
    if (!validation.isValid) {
      const errorMsg = Object.entries(validation.errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join('; ');
      throw new Error(`Validation error: ${errorMsg}`);
    }

    // Verificar código duplicado na empresa
    const existingCode = await db('accounts')
      .where('company_id', companyId)
      .where('code', data.code)
      .first();

    if (existingCode) {
      throw new Error(`Account code ${data.code} already exists in this company`);
    }

    // Se parent_code foi informado, validar que existe e evitar ciclos
    let parentId: string | null = null;
    if (data.parent_code) {
      const parentAccount = await db('accounts')
        .where('company_id', companyId)
        .where('code', data.parent_code)
        .first();

      if (!parentAccount) {
        throw new Error(`Parent account with code ${data.parent_code} not found`);
      }

      parentId = parentAccount.id;

      // Validar se criaria ciclo (parent não pode ser descendente desta conta)
      // Isso será feito após inserir e verificar a hierarquia
    }

    // Inserir nova conta
    const [account] = await db('accounts')
      .insert({
        company_id: companyId,
        code: data.code,
        name: data.name,
        type: data.type,
        parent_id: parentId,
        tax_code: data.tax_code || null,
        is_analytical: data.is_analytical ?? false,
        is_active: true,
      })
      .returning('*');

    logger.info(`Account created: ${account.id} (${data.code}) in company ${companyId}`);

    // Retornar com saldo calculado
    return this.formatAccountResponse(account, companyId);
  }

  /**
   * Listar contas com filtros, paginação e opção de hierarquia
   *
   * @param companyId - ID da empresa
   * @param filters - Filtros e opções de paginação
   * @returns Promise com lista ou árvore de contas
   */
  static async list(
    companyId: string,
    filters: AccountFilters = {},
  ): Promise<PaginatedAccountResponse | { data: AccountHierarchy[] }> {
    const db = await getDatabase();

    // Validar filtros
    const validation = AccountDTOValidator.validateFilters(filters);
    if (!validation.isValid) {
      const errorMsg = Object.entries(validation.errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join('; ');
      throw new Error(`Validation error: ${errorMsg}`);
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const hierarchy = filters.hierarchy ?? false;

    // Query base
    let query = db('accounts')
      .where('company_id', companyId)
      .where('is_active', true);

    // Aplicar filtros
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.where((q) => q.whereLike('name', searchTerm).orWhereLike('code', searchTerm));
    }

    if (filters.type) {
      query = query.where('type', filters.type);
    }

    if (filters.tax_code) {
      query = query.where('tax_code', filters.tax_code);
    }

    if (filters.parent_code) {
      const parent = await db('accounts')
        .where('company_id', companyId)
        .where('code', filters.parent_code)
        .first();
      if (parent) {
        query = query.where('parent_id', parent.id);
      } else {
        throw new Error(`Parent account with code ${filters.parent_code} not found`);
      }
    }

    // Se solicitar hierarquia, construir árvore
    if (hierarchy) {
      const accounts = await query.orderBy('code', 'asc');
      const tree = this.buildHierarchyTree(accounts, companyId);
      return { data: tree };
    }

    // Retornar lista paginada (flat)
    const total = await query.clone().count('* as count').first();
    const totalCount = Number(total?.count || 0);
    const totalPages = Math.ceil(totalCount / limit);

    const accounts = await query
      .offset((page - 1) * limit)
      .limit(limit)
      .orderBy('code', 'asc');

    // Formatar respostas com saldos
    const data = await Promise.all(
      accounts.map((acc) => this.formatAccountResponse(acc, companyId)),
    );

    return {
      data,
      total: totalCount,
      page,
      limit,
      total_pages: totalPages,
    };
  }

  /**
   * Obter detalhes de uma conta específica
   *
   * @param accountId - ID da conta
   * @param companyId - ID da empresa (validação multi-tenant)
   * @returns Promise<AccountResponse>
   * @throws Error se conta não encontrada ou não pertence à empresa
   */
  static async getById(accountId: string, companyId: string): Promise<AccountResponse> {
    const db = await getDatabase();

    const account = await db('accounts')
      .where('id', accountId)
      .where('company_id', companyId)
      .where('is_active', true)
      .first();

    if (!account) {
      throw new Error('Account not found');
    }

    return this.formatAccountResponse(account, companyId);
  }

  /**
   * Atualizar conta contábil
   * Não permite alterar: code, company_id
   * Valida parent_code e evita ciclos
   *
   * @param accountId - ID da conta
   * @param companyId - ID da empresa
   * @param data - UpdateAccountDTO
   * @returns Promise<AccountResponse>
   */
  static async update(
    accountId: string,
    companyId: string,
    data: UpdateAccountDTO,
  ): Promise<AccountResponse> {
    const db = await getDatabase();

    // Validar DTO
    const validation = AccountDTOValidator.validateUpdateDTO(data);
    if (!validation.isValid) {
      const errorMsg = Object.entries(validation.errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join('; ');
      throw new Error(`Validation error: ${errorMsg}`);
    }

    // Buscar conta atual
    const currentAccount = await db('accounts')
      .where('id', accountId)
      .where('company_id', companyId)
      .first();

    if (!currentAccount) {
      throw new Error('Account not found');
    }

    // Se parent_code foi informado, validar
    let parentId = currentAccount.parent_id;
    if (data.parent_code !== undefined) {
      if (data.parent_code) {
        const parentAccount = await db('accounts')
          .where('company_id', companyId)
          .where('code', data.parent_code)
          .first();

        if (!parentAccount) {
          throw new Error(`Parent account with code ${data.parent_code} not found`);
        }

        // Validar ciclo: parent não pode ser descendente desta conta
        if (await this.wouldCreateCycle(accountId, parentAccount.id, db)) {
          throw new Error('Cannot set parent: would create a cycle in hierarchy');
        }

        parentId = parentAccount.id;
      } else {
        parentId = null;
      }
    }

    // Montar objeto de atualização
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.tax_code !== undefined) updateData.tax_code = data.tax_code || null;
    if (data.is_analytical !== undefined) updateData.is_analytical = data.is_analytical;
    if (parentId !== currentAccount.parent_id) updateData.parent_id = parentId;

    if (Object.keys(updateData).length === 0) {
      return this.formatAccountResponse(currentAccount, companyId);
    }

    updateData.updated_at = new Date();

    // Atualizar
    const [updated] = await db('accounts')
      .where('id', accountId)
      .where('company_id', companyId)
      .update(updateData)
      .returning('*');

    logger.info(`Account updated: ${accountId} (${currentAccount.code})`);

    return this.formatAccountResponse(updated, companyId);
  }

  /**
   * Deletar conta (soft delete)
   * Valida que não existem journal_lines associadas
   *
   * @param accountId - ID da conta
   * @param companyId - ID da empresa
   * @throws Error se conta tem lançamentos ou não encontrada
   */
  static async delete(accountId: string, companyId: string): Promise<void> {
    const db = await getDatabase();

    // Verificar conta existe
    const account = await db('accounts')
      .where('id', accountId)
      .where('company_id', companyId)
      .first();

    if (!account) {
      throw new Error('Account not found');
    }

    // Verificar se há lançamentos (journal_lines)
    const hasEntries = await db('journal_lines')
      .where('account_id', accountId)
      .first();

    if (hasEntries) {
      throw new Error('Cannot delete account with journal entries');
    }

    // Soft delete: marcar como inativa
    await db('accounts')
      .where('id', accountId)
      .where('company_id', companyId)
      .update({
        is_active: false,
        updated_at: new Date(),
      });

    logger.info(`Account soft-deleted: ${accountId} (${account.code})`);
  }

  /**
   * Obter saldo de uma conta
   * Calcula: debit_total - credit_total
   *
   * @param accountId - ID da conta
   * @param companyId - ID da empresa
   * @returns Promise<AccountBalanceResponse>
   */
  static async getBalance(
    accountId: string,
    companyId: string,
  ): Promise<AccountBalanceResponse> {
    const db = await getDatabase();

    // Buscar conta
    const account = await db('accounts')
      .where('id', accountId)
      .where('company_id', companyId)
      .where('is_active', true)
      .first();

    if (!account) {
      throw new Error('Account not found');
    }

    // Calcular saldo: SUM(debit) - SUM(credit)
    const balanceData = await db('journal_lines')
      .join('journal_entries', 'journal_lines.journal_entry_id', 'journal_entries.id')
      .where('journal_lines.account_id', accountId)
      .where('journal_entries.company_id', companyId)
      .sum('journal_lines.debit as debit_total')
      .sum('journal_lines.credit as credit_total')
      .first();

    const debitTotal = Number(balanceData?.debit_total || 0);
    const creditTotal = Number(balanceData?.credit_total || 0);
    const balance = debitTotal - creditTotal;

    return {
      account_id: accountId,
      code: account.code,
      name: account.name,
      balance,
      debit_total: debitTotal,
      credit_total: creditTotal,
    };
  }

  /**
   * Obter hierarquia completa de contas
   * Retorna estrutura de árvore com parent-child relationships
   *
   * @param companyId - ID da empresa
   * @param parentCode - Filtrar por conta pai (opcional)
   * @returns Promise<AccountHierarchy[]>
   */
  static async getHierarchy(
    companyId: string,
    parentCode?: string,
  ): Promise<AccountHierarchy[]> {
    const db = await getDatabase();

    let query = db('accounts')
      .where('company_id', companyId)
      .where('is_active', true)
      .orderBy('code', 'asc');

    // Se parent_code especificado, filtrar
    if (parentCode) {
      const parent = await db('accounts')
        .where('company_id', companyId)
        .where('code', parentCode)
        .first();

      if (!parent) {
        throw new Error(`Parent account with code ${parentCode} not found`);
      }

      query = query.where('parent_id', parent.id);
    } else {
      // Começar apenas com raízes (sem parent)
      query = query.where('parent_id', null);
    }

    const accounts = await query;
    return this.buildHierarchyTree(accounts, companyId);
  }

  /**
   * Importar plano de contas padrão
   * Lê plano-contas-padrao.json e importa para a empresa
   *
   * @param companyId - ID da empresa
   * @param overwrite - Se true, sobrescreve contas existentes
   * @returns Promise<ImportPlanoResponse>
   */
  static async importPadraoPlano(
    companyId: string,
    overwrite: boolean = false,
  ): Promise<ImportPlanoResponse> {
    const db = await getDatabase();

    // Ler arquivo padrão
    const planoPath = path.join(process.cwd(), 'plano-contas-padrao.json');

    if (!fs.existsSync(planoPath)) {
      throw new Error('plano-contas-padrao.json file not found');
    }

    const fileContent = fs.readFileSync(planoPath, 'utf-8');
    const planoData = JSON.parse(fileContent);

    if (!planoData.accounts || !Array.isArray(planoData.accounts)) {
      throw new Error('Invalid plano-contas-padrao.json structure');
    }

    const accounts = planoData.accounts;
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Usar transação para atomicidade
    const trx = await db.transaction();

    try {
      for (const accountData of accounts) {
        try {
          // Verificar se código já existe
          const existing = await trx('accounts')
            .where('company_id', companyId)
            .where('code', accountData.code)
            .first();

          if (existing) {
            if (!overwrite) {
              skipped++;
              continue;
            } else {
              // Atualizar conta existente
              await trx('accounts')
                .where('id', existing.id)
                .update({
                  name: accountData.name,
                  type: accountData.type,
                  tax_code: accountData.tax_code || null,
                  is_analytical: accountData.is_analytical ?? false,
                  updated_at: new Date(),
                });
              imported++;
              continue;
            }
          }

          // Buscar parent se existe
          let parentId = null;
          if (accountData.parent_code) {
            const parent = await trx('accounts')
              .where('company_id', companyId)
              .where('code', accountData.parent_code)
              .first();
            if (parent) {
              parentId = parent.id;
            }
          }

          // Inserir nova conta
          await trx('accounts').insert({
            company_id: companyId,
            code: accountData.code,
            name: accountData.name,
            type: accountData.type,
            parent_id: parentId,
            tax_code: accountData.tax_code || null,
            is_analytical: accountData.is_analytical ?? false,
            is_active: true,
          });

          imported++;
        } catch (error) {
          errors.push(`Error importing ${accountData.code}: ${(error as Error).message}`);
        }
      }

      await trx.commit();
      logger.info(
        `Plano de contas imported: ${imported} imported, ${skipped} skipped for company ${companyId}`,
      );
    } catch (error) {
      await trx.rollback();
      throw error;
    }

    return {
      imported,
      skipped,
      total: accounts.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Privado: Formatar resposta de conta com saldo calculado
   */
  private static async formatAccountResponse(
    account: any,
    companyId: string,
  ): Promise<AccountResponse> {
    const balance = await this.getBalance(account.id, companyId);

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      parent_code: undefined, // Será preenchido abaixo se necessário
      parent_id: account.parent_id,
      tax_code: account.tax_code,
      is_analytical: account.is_analytical,
      balance: balance.balance,
      debit_total: balance.debit_total,
      credit_total: balance.credit_total,
      is_active: account.is_active,
      created_at: account.created_at?.toISOString?.() || account.created_at,
      updated_at: account.updated_at?.toISOString?.() || account.updated_at,
    };
  }

  /**
   * Privado: Construir árvore hierárquica de contas
   */
  private static buildHierarchyTree(accounts: any[], _companyId: string): AccountHierarchy[] {
    const map = new Map<string, AccountHierarchy & { children?: AccountHierarchy[] }>();

    // Primeiro passe: criar nós
    for (const account of accounts) {
      map.set(account.id, {
        code: account.code,
        name: account.name,
        type: account.type,
        is_analytical: account.is_analytical,
        children: [],
      });
    }

    // Segundo passe: montar hierarquia
    const roots: AccountHierarchy[] = [];
    for (const account of accounts) {
      const node = map.get(account.id)!;

      if (account.parent_id) {
        const parent = map.get(account.parent_id);
        if (parent) {
          parent.children!.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Privado: Validar se criar parent causaria ciclo na hierarquia
   */
  private static async wouldCreateCycle(
    accountId: string,
    potentialParentId: string,
    db: any,
  ): Promise<boolean> {
    if (accountId === potentialParentId) {
      return true;
    }

    // Buscar todos os ancestrais do potencial parent
    let currentId = potentialParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        return true; // Ciclo detectado
      }

      visited.add(currentId);

      if (currentId === accountId) {
        return true; // accountId é ancestral de potentialParentId
      }

      const parent = await db('accounts').where('id', currentId).first();
      currentId = parent?.parent_id;
    }

    return false;
  }
}
