/**
 * Company Service
 * Lógica de negócio para gerenciamento de empresas
 * Implementa validações, isolamento por tenant e auditoria
 */

import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  CreateCompanyDTO,
  UpdateCompanyDTO,
  CompanyResponse,
  PaginatedCompanyResponse,
  CompanyFilters,
  CompanyDTOValidator,
} from '../models/dtos/companyDTO';
import { TenantService } from './tenantService';

/**
 * Company Service - Gerencia operações de empresas
 * Responsável por criar, atualizar, deletar e listar empresas
 * Implementa validações, verificações de CNPJ duplicado e auditoria
 */
export class CompanyService {
  /**
   * Criar nova empresa
   * Adiciona empresa ao banco de dados e cria associação em company_users
   * Auto-associa o admin ao criar (se passado userId)
   *
   * @param data - CreateCompanyDTO com dados da empresa
   * @param adminUserId - ID do usuário que está criando (para associação)
   * @returns Promise<CompanyResponse>
   * @throws Error se CNPJ duplicado ou validação falhar
   */
  static async create(
    data: CreateCompanyDTO,
    adminUserId?: string,
  ): Promise<CompanyResponse> {
    const db = await getDatabase();

    // Validar DTO
    const validation = CompanyDTOValidator.validateCreateDTO(data);
    if (!validation.isValid) {
      const errorMsg = Object.entries(validation.errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join('; ');
      throw new Error(`Validation error: ${errorMsg}`);
    }

    // Verificar CNPJ duplicado
    const existingCNPJ = await this.checkCNPJExists(data.cnpj);
    if (existingCNPJ) {
      throw new Error('CNPJ already registered');
    }

    // Iniciar transação
    return db.transaction(async (trx) => {
      const companyId = `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      // Preparar dados da empresa
      const companyData = {
        id: companyId,
        cnpj: data.cnpj.replace(/[^\d]/g, ''), // Remover formatação
        name: data.name,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        tax_regime: data.tax_regime,
        fiscal_year_start: data.fiscal_year_start ? JSON.stringify(data.fiscal_year_start) : null,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      // Inserir empresa
      await trx('companies').insert(companyData);

      logger.info('Company created', {
        companyId,
        cnpj: data.cnpj,
        name: data.name,
        createdBy: adminUserId,
      });

      // Auto-associar admin se fornecido
      if (adminUserId) {
        const companyUserId = `cu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await trx('company_users').insert({
          id: companyUserId,
          user_id: adminUserId,
          company_id: companyId,
          role: 'admin', // Primeiro a criar é admin
          permissions: JSON.stringify(['*']), // Full permissions
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        // Auditar criação
        await this.auditAction(adminUserId, companyId, 'CREATE', 'Company created', true, trx);
      }

      // Retornar empresa criada
      return this.formatCompanyResponse(companyData);
    });
  }

  /**
   * Listar empresas com paginação e filtros
   * Admin vê todas as empresas
   * Users veem apenas suas próprias empresas
   *
   * @param adminMode - Se true, listar todas; se false, apenas do usuário
   * @param userId - ID do usuário (se não admin)
   * @param filters - Filtros de busca e paginação
   * @returns Promise<PaginatedCompanyResponse>
   */
  static async list(
    adminMode: boolean,
    userId?: string,
    filters?: CompanyFilters,
  ): Promise<PaginatedCompanyResponse> {
    const db = await getDatabase();

    // Validar e aplicar paginação
    const limit = Math.min(filters?.limit || 10, 100); // Max 100
    const page = Math.max(filters?.page || 1, 1);
    const offset = (page - 1) * limit;

    // Construir query base com filtros comuns
    const buildQuery = () => {
      let q = db('companies').where('is_active', true);

      // Se não é admin, filtrar apenas empresas do usuário
      if (!adminMode && userId) {
        q = q
          .join('company_users', 'companies.id', '=', 'company_users.company_id')
          .where('company_users.user_id', userId)
          .where('company_users.is_active', true)
          .select('companies.*');
      }

      // Aplicar filtros de busca
      if (filters?.search) {
        q = q.whereRaw('LOWER(name) LIKE LOWER(?)', [`%${filters.search}%`]);
      }

      if (filters?.tax_regime) {
        q = q.where('tax_regime', filters.tax_regime);
      }

      if (filters?.created_from) {
        q = q.where('created_at', '>=', filters.created_from);
      }

      if (filters?.created_to) {
        q = q.where('created_at', '<=', filters.created_to);
      }

      return q;
    };

    // Contar total de registros com query separada
    const countResult = (await buildQuery().count('id as total').first()) as any;
    const total = parseInt(countResult?.total || 0, 10);

    // Paginar e ordenar com query separada
    const companies = (await buildQuery().orderBy('created_at', 'desc').limit(limit).offset(offset)) as any[];

    // Formatar resposta
    return {
      data: companies.map((c) => this.formatCompanyResponse(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Obter empresa por ID
   * Valida que usuário tem acesso (se tenancy ativa)
   *
   * @param id - ID da empresa
   * @param companyId - ID da empresa do tenant (para validação)
   * @param userId - ID do usuário (para validação de acesso)
   * @returns Promise<CompanyResponse>
   * @throws Error se empresa não encontrada ou acesso negado
   */
  static async getById(id: string, companyId?: string, userId?: string): Promise<CompanyResponse> {
    const db = await getDatabase();

    let query = db('companies').where('id', id).where('is_active', true);

    // Se há companyId de tenant, validar que é a mesma
    if (companyId && companyId !== id) {
      query = query.orWhere('id', companyId);
    }

    const company = (await query.first()) as any;

    if (!company) {
      throw new Error('Company not found');
    }

    // Se há userId, validar acesso
    if (userId) {
      const hasAccess = await TenantService.validateUserAccess(userId, id);
      if (!hasAccess) {
        throw new Error('Access denied');
      }
    }

    return this.formatCompanyResponse(company);
  }

  /**
   * Atualizar empresa
   * CNPJ não pode ser alterado
   *
   * @param id - ID da empresa
   * @param data - UpdateCompanyDTO com dados a atualizar
   * @param userId - ID do usuário que está atualizando (para auditoria)
   * @param companyId - ID da empresa do tenant (para validação)
   * @returns Promise<CompanyResponse>
   * @throws Error se empresa não encontrada ou validação falhar
   */
  static async update(
    id: string,
    data: UpdateCompanyDTO,
    userId?: string,
    companyId?: string,
  ): Promise<CompanyResponse> {
    const db = await getDatabase();

    // Validar DTO
    const validation = CompanyDTOValidator.validateUpdateDTO(data);
    if (!validation.isValid) {
      const errorMsg = Object.entries(validation.errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join('; ');
      throw new Error(`Validation error: ${errorMsg}`);
    }

    // Obter empresa existente
    const existingCompany = (await db('companies').where('id', id).first()) as any;

    if (!existingCompany) {
      throw new Error('Company not found');
    }

    if (!existingCompany.is_active) {
      throw new Error('Cannot update inactive company');
    }

    // Preparar dados de atualização
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name) {
      updateData.name = data.name;
    }
    if (data.address) {
      updateData.address = data.address;
    }
    if (data.phone) {
      updateData.phone = data.phone;
    }
    if (data.email) {
      updateData.email = data.email;
    }
    if (data.tax_regime) {
      updateData.tax_regime = data.tax_regime;
    }
    if (data.fiscal_year_start) {
      updateData.fiscal_year_start = JSON.stringify(data.fiscal_year_start);
    }

    // Atualizar no banco
    await db('companies').where('id', id).update(updateData);

    logger.info('Company updated', {
      companyId: id,
      cnpj: existingCompany.cnpj,
      updatedBy: userId,
    });

    // Auditar atualização
    if (userId) {
      await this.auditAction(userId, id, 'UPDATE', 'Company updated', true);
    }

    // Retornar empresa atualizada
    const updated = (await db('companies').where('id', id).first()) as any;
    return this.formatCompanyResponse(updated);
  }

  /**
   * Deletar empresa (soft delete)
   * Define is_active = false
   *
   * @param id - ID da empresa
   * @param userId - ID do usuário que está deletando (para auditoria)
   * @returns Promise<void>
   * @throws Error se empresa não encontrada
   */
  static async delete(id: string, userId?: string): Promise<void> {
    const db = await getDatabase();

    const company = (await db('companies').where('id', id).first()) as any;

    if (!company) {
      throw new Error('Company not found');
    }

    if (!company.is_active) {
      throw new Error('Company is already deleted');
    }

    // Soft delete
    await db('companies').where('id', id).update({
      is_active: false,
      updated_at: new Date().toISOString(),
    });

    logger.info('Company deleted (soft)', {
      companyId: id,
      cnpj: company.cnpj,
      deletedBy: userId,
    });

    // Auditar deleção
    if (userId) {
      await this.auditAction(userId, id, 'DELETE', 'Company deleted', true);
    }
  }

  /**
   * Validar formato de CNPJ
   * @param cnpj - String com CNPJ
   * @returns boolean
   */
  static validateCNPJ(cnpj: string): boolean {
    return CompanyDTOValidator.validateCNPJFormat(cnpj);
  }

  /**
   * Verificar se CNPJ já existe (ativo)
   * @param cnpj - String com CNPJ
   * @returns Promise<boolean>
   */
  static async checkCNPJExists(cnpj: string): Promise<boolean> {
    const db = await getDatabase();

    const cleaned = cnpj.replace(/[^\d]/g, '');
    const existing = await db('companies')
      .where('cnpj', cleaned)
      .where('is_active', true)
      .first();

    return !!existing;
  }

  /**
   * Formatar resposta de empresa
   * Converte dados do DB para o formato de resposta da API
   */
  private static formatCompanyResponse(company: any): CompanyResponse {
    return {
      id: company.id,
      cnpj: company.cnpj,
      name: company.name,
      address: company.address,
      phone: company.phone,
      email: company.email,
      tax_regime: company.tax_regime,
      fiscal_year_start: company.fiscal_year_start ? JSON.parse(company.fiscal_year_start) : undefined,
      is_active: company.is_active,
      created_at: new Date(company.created_at).toISOString(),
      updated_at: new Date(company.updated_at).toISOString(),
    };
  }

  /**
   * Registrar auditoria de ações na empresa
   */
  private static async auditAction(
    userId: string,
    companyId: string,
    action: string,
    description: string,
    success: boolean,
    trx?: any,
  ): Promise<void> {
    try {
      const db = trx || (await getDatabase());

      await db('access_audit').insert({
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        company_id: companyId,
        action,
        description,
        success,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to audit action', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        companyId,
        action,
      });
    }
  }

  /**
   * Obter estatísticas de uma empresa
   * Total de usuários, journals, contas, etc.
   */
  static async getCompanyStats(companyId: string): Promise<Record<string, any>> {
    const db = await getDatabase();

    const [
      userCount,
      journalCount,
      accountCount,
    ] = await Promise.all([
      db('company_users').where('company_id', companyId).where('is_active', true).count('id as count').first(),
      db('journal_entries').where('company_id', companyId).count('id as count').first(),
      db('accounts').where('company_id', companyId).where('is_active', true).count('id as count').first(),
    ]);

    return {
      users: parseInt((userCount as any)?.count || 0),
      journals: parseInt((journalCount as any)?.count || 0),
      accounts: parseInt((accountCount as any)?.count || 0),
    };
  }
}
// Force rebuild
