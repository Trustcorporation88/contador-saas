/**
 * Company Service
 * Lógica de negócio para gerenciamento de empresas
 * Implementa validações, isolamento por tenant e auditoria
 */

import { randomUUID } from 'crypto';
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

function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function clip(value: string | undefined | null, max: number): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizeFiscalYearMonth(
  value: CreateCompanyDTO['fiscal_year_start'] | number | string | undefined,
): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n >= 1 && n <= 12) return n;
  }
  if (typeof value === 'object' && value && typeof (value as { month?: number }).month === 'number') {
    const m = (value as { month: number }).month;
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}

async function pickExistingCompanyColumns(
  trx: { schema: { hasColumn: (table: string, col: string) => Promise<boolean> } },
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    // Colunas core sempre tentam inserir; extras só se existirem
    const optional = [
      'inscricao_estadual',
      'endereco_numero',
      'endereco_bairro',
      'codigo_municipio',
      'crt',
      'trade_name',
    ];
    if (optional.includes(key)) {
      const exists = await trx.schema.hasColumn('companies', key);
      if (!exists) continue;
    }
    out[key] = val;
  }
  return out;
}

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
  static async create(data: CreateCompanyDTO, adminUserId?: string): Promise<CompanyResponse> {
    const db = await getDatabase();

    // Normaliza fiscal_year_start: frontend envia mês (1–12); DTO legado usa {month,day}
    const fiscalMonth = normalizeFiscalYearMonth(data.fiscal_year_start);
    const normalized: CreateCompanyDTO = {
      ...data,
      fiscal_year_start: fiscalMonth
        ? { month: fiscalMonth, day: 1 }
        : undefined,
    };

    // Validar DTO
    const validation = CompanyDTOValidator.validateCreateDTO(normalized);
    if (!validation.isValid) {
      const errorMsg = Object.entries(validation.errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join('; ');
      throw new Error(`Validation error: ${errorMsg}`);
    }

    // Verificar CNPJ duplicado
    const existingCNPJ = await this.checkCNPJExists(normalized.cnpj);
    if (existingCNPJ) {
      throw new Error('CNPJ already registered');
    }

    // Iniciar transação
    return db.transaction(async (trx) => {
      const companyId = randomUUID();
      const now = new Date().toISOString();

      // Sanitiza tamanhos para as colunas do banco (evita 500 "value too long")
      const companyData = {
        id: companyId,
        cnpj: onlyDigits(normalized.cnpj).slice(0, 14),
        legal_name: String(normalized.name || '').trim().slice(0, 255),
        address: clip(normalized.address, 255),
        phone: clip(onlyDigits(normalized.phone || '') || normalized.phone, 20),
        email: clip(normalized.email, 255),
        tax_regime: String(normalized.tax_regime).slice(0, 50),
        fiscal_year_start: fiscalMonth ?? 1,
        inscricao_estadual: clip(normalized.inscricao_estadual, 30),
        city: clip(normalized.city, 100),
        state: clip(normalized.state, 2)?.toUpperCase() || null,
        postal_code: clip(onlyDigits(normalized.postal_code || '') || normalized.postal_code, 10),
        endereco_numero: clip(normalized.endereco_numero, 20),
        endereco_bairro: clip(normalized.endereco_bairro, 120),
        codigo_municipio: clip(onlyDigits(normalized.codigo_municipio || ''), 7),
        crt: clip(normalized.crt, 1),
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      // Inserir apenas colunas existentes (ambientes sem migration completa)
      const row = await pickExistingCompanyColumns(trx, companyData);
      await trx('companies').insert(row);

      logger.info('Company created', {
        companyId,
        cnpj: companyData.cnpj,
        legal_name: companyData.legal_name,
        createdBy: adminUserId,
      });

      // Auto-associar admin se fornecido
      if (adminUserId) {
        const companyUserId = randomUUID();
        try {
          await trx('company_users').insert({
            id: companyUserId,
            user_id: adminUserId,
            company_id: companyId,
            role: 'admin',
            permissions: JSON.stringify(['*']),
            is_active: true,
            created_at: now,
            updated_at: now,
          });
        } catch (assocErr) {
          // Sem permissions column / schema legado: tenta mínimo
          logger.warn('company_users insert com permissions falhou; tentando sem permissions', {
            error: assocErr instanceof Error ? assocErr.message : String(assocErr),
          });
          await trx('company_users').insert({
            id: companyUserId,
            user_id: adminUserId,
            company_id: companyId,
            role: 'admin',
            is_active: true,
            created_at: now,
            updated_at: now,
          });
        }

        await this.auditAction(adminUserId, companyId, 'CREATE', 'Company created', true, trx);
      }

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

    console.log('[COMPANY_SERVICE_LIST] Pagination:', { limit, page, offset });

    let query = db('companies').where('is_active', true);
    console.log('[COMPANY_SERVICE_LIST] Initial query created');

    // Se não é admin, filtrar apenas empresas do usuário
    if (!adminMode && userId) {
      console.log('[COMPANY_SERVICE_LIST] User mode - applying join with company_users');
      query = query
        .join('company_users', 'companies.id', '=', 'company_users.company_id')
        .where('company_users.user_id', userId)
        .where('company_users.is_active', true)
        .select('companies.*');
      console.log('[COMPANY_SERVICE_LIST] Join applied successfully');
    }

    // Aplicar filtros de busca
    if (filters?.search) {
      query = query.whereRaw('LOWER(legal_name) LIKE LOWER(?)', [`%${filters.search}%`]);
    }

    if (filters?.tax_regime) {
      query = query.where('tax_regime', filters.tax_regime);
    }

    if (filters?.created_from) {
      query = query.where('created_at', '>=', filters.created_from);
    }

    if (filters?.created_to) {
      query = query.where('created_at', '<=', filters.created_to);
    }

    console.log('[COMPANY_SERVICE_LIST] About to count records');
    // Contar total de registros
    const countQuery = query.clone().count('id as total').first();
    console.log('[COMPANY_SERVICE_LIST] Executing count query...');
    const countResult = (await countQuery) as any;
    console.log('[COMPANY_SERVICE_LIST] Count result:', { countResult, total: countResult?.total });
    const total = parseInt(countResult?.total || 0, 10);

    // Paginar e ordenar
    const companies = (await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)) as any[];
    // Formatar resposta
    const response = {
      data: companies.map((c) => this.formatCompanyResponse(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
    return response;
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
  static async getById(id: string, companyId?: string, userId?: string, role?: string): Promise<CompanyResponse> {
    const db = await getDatabase();

    const company = (await db('companies').where('id', id).where('is_active', true).first()) as any;

    if (!company) {
      throw new Error('Company not found');
    }

    // Se há userId, validar acesso (admin acessa qualquer empresa)
    if (userId && role !== 'admin') {
      const hasAccess = await TenantService.validateUserAccess(userId, id);
      if (!hasAccess.isValid) {
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
    role?: string,
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

    // Validar acesso (admin atualiza qualquer empresa)
    if (userId && role !== 'admin') {
      const hasAccess = await TenantService.validateUserAccess(userId, id);
      if (!hasAccess.isValid) {
        throw new Error('Access denied');
      }
    }

    // Preparar dados de atualização
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name) {
      updateData.legal_name = data.name;
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
    for (const field of [
      'inscricao_estadual',
      'city',
      'state',
      'postal_code',
      'endereco_numero',
      'endereco_bairro',
      'codigo_municipio',
      'crt',
    ] as const) {
      if (data[field] !== undefined) {
        updateData[field] = data[field] || null;
      }
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
    const existing = await db('companies').where('cnpj', cleaned).where('is_active', true).first();

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
      name: company.legal_name,
      address: company.address,
      phone: company.phone,
      email: company.email,
      tax_regime: company.tax_regime,
      fiscal_year_start: (() => {
        const raw = company.fiscal_year_start;
        if (raw === undefined || raw === null || raw === '') return undefined;
        if (typeof raw === 'number') return { month: raw, day: 1 };
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'number') return { month: parsed, day: 1 };
            if (parsed && typeof parsed === 'object' && parsed.month) return parsed;
          } catch {
            const n = Number(raw);
            if (n >= 1 && n <= 12) return { month: n, day: 1 };
          }
        }
        if (typeof raw === 'object' && raw && (raw as { month?: number }).month) {
          return raw as { month: number; day: number };
        }
        return undefined;
      })(),
      inscricao_estadual: company.inscricao_estadual || undefined,
      city: company.city || undefined,
      state: company.state || undefined,
      postal_code: company.postal_code || undefined,
      endereco_numero: company.endereco_numero || undefined,
      endereco_bairro: company.endereco_bairro || undefined,
      codigo_municipio: company.codigo_municipio || undefined,
      crt: company.crt || undefined,
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
    _trx?: any,
  ): Promise<void> {
    try {
      // Use main DB (not trx) to avoid aborting the transaction on audit errors
      const db = await getDatabase();

      await db('audit_logs').insert({
        id: randomUUID(),
        user_id: userId,
        action,
        entity_type: 'company',
        entity_id: companyId,
        new_value: JSON.stringify({ description }),
        status: success ? 'SUCCESS' : 'FAILED',
        timestamp: new Date().toISOString(),
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

    const [userCount, journalCount, accountCount] = await Promise.all([
      db('company_users').where('company_id', companyId).count('id as count').first(),
      db('journal_entries').where('company_id', companyId).count('id as count').first(),
      db('accounts')
        .where('company_id', companyId)
        .where('is_active', true)
        .count('id as count')
        .first(),
    ]);

    return {
      users: parseInt((userCount as any)?.count || 0),
      journals: parseInt((journalCount as any)?.count || 0),
      accounts: parseInt((accountCount as any)?.count || 0),
    };
  }
}
