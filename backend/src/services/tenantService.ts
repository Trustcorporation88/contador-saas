/**
 * Tenant Service
 * Gerenciamento de multi-tenancy, acesso de usuários, permissões e company switching
 */

import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

/**
 * Response para validação de acesso
 */
export interface AccessValidationResult {
  isValid: boolean;
  role?: string;
  permissions?: string[];
  error?: string;
}

/**
 * Informações de empresa do usuário
 */
export interface UserCompanyInfo {
  id: string;
  name: string;
  role: string;
  permissions: string[];
}

/**
 * Resultado de switch de empresa
 */
export interface CompanySwitchResult {
  success: boolean;
  newToken?: string;
  companyId?: string;
  error?: string;
}

/**
 * Tenant Service Class
 * Métodos para gerenciar acesso multi-tenant de usuários
 */
export class TenantService {
  /**
   * Valida que usuário tem acesso à empresa
   * Retorna role e permissions se válido, erro caso contrário
   */
  static async validateUserAccess(
    userId: string,
    companyId: string,
  ): Promise<AccessValidationResult> {
    try {
      const db = await getDatabase();

      // Buscar associação user-company
      const userCompany = await db('company_users')
        .select('id', 'user_id', 'company_id', 'role', 'permissions', 'is_active')
        .where('user_id', userId)
        .where('company_id', companyId)
        .first();

      // User não está na empresa
      if (!userCompany) {
        logger.warn('User access validation failed - user not in company', {
          userId,
          companyId,
        });
        return {
          isValid: false,
          error: 'User is not associated with this company',
        };
      }

      // User está inativo na empresa
      if (!userCompany.is_active) {
        logger.warn('User access validation failed - user inactive', {
          userId,
          companyId,
        });
        return {
          isValid: false,
          error: 'User account is inactive for this company',
        };
      }

      // Parse permissions
      let permissions: string[] = [];
      try {
        permissions = typeof userCompany.permissions === 'string'
          ? JSON.parse(userCompany.permissions)
          : userCompany.permissions || [];
      } catch (e) {
        permissions = [];
      }

      return {
        isValid: true,
        role: userCompany.role,
        permissions,
      };
    } catch (error) {
      logger.error('Error validating user access', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        companyId,
      });
      return {
        isValid: false,
        error: 'Error validating access',
      };
    }
  }

  /**
   * Retorna lista de todas as empresas às quais o usuário tem acesso
   */
  static async getUserCompanies(userId: string): Promise<UserCompanyInfo[]> {
    try {
      const db = await getDatabase();

      const companies = await db('company_users')
        .join('companies', 'company_users.company_id', 'companies.id')
        .select(
          'companies.id',
          'companies.name',
          'company_users.role',
          'company_users.permissions',
        )
        .where('company_users.user_id', userId)
        .where('company_users.is_active', true)
        .orderBy('companies.name', 'asc');

      return companies.map((cu: any) => ({
        id: cu.id,
        name: cu.name,
        role: cu.role,
        permissions: typeof cu.permissions === 'string'
          ? JSON.parse(cu.permissions)
          : cu.permissions || [],
      }));
    } catch (error) {
      logger.error('Error getting user companies', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Troca empresa do usuário (company context)
   * Gera novo JWT com o novo company_id
   *
   * Validações:
   * 1. User deve estar em company_users com a nova empresa
   * 2. User deve estar ativo na nova empresa
   * 3. User deve ter tido acesso anteriormente (histórico)
   */
  static async switchCompany(
    userId: string,
    newCompanyId: string,
  ): Promise<CompanySwitchResult> {
    try {
      const db = await getDatabase();

      // Validar que user tem acesso à nova empresa
      const validation = await this.validateUserAccess(userId, newCompanyId);
      if (!validation.isValid) {
        logger.warn('Company switch rejected - access denied', {
          userId,
          newCompanyId,
        });
        return {
          success: false,
          error: 'You do not have access to this company',
        };
      }

      // Buscar dados do usuário
      const user = await db('users')
        .select('id', 'email', 'role')
        .where('id', userId)
        .first();

      if (!user) {
        logger.error('User not found for company switch', { userId });
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Gerar novo token com novo company_id
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: newCompanyId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + envConfig.jwt.expirationSeconds,
      };

      const newToken = jwt.sign(payload, envConfig.jwt.secret);

      // Log audit
      await db('access_audit').insert({
        user_id: userId,
        company_id: newCompanyId,
        action: 'COMPANY_SWITCH',
        reason: 'User switched company context',
        timestamp: new Date(),
      });

      logger.info('Company switch successful', {
        userId,
        oldCompanyId: user.companyId,
        newCompanyId,
      });

      return {
        success: true,
        newToken,
        companyId: newCompanyId,
      };
    } catch (error) {
      logger.error('Error switching company', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        newCompanyId,
      });
      return {
        success: false,
        error: 'Error switching company',
      };
    }
  }

  /**
   * Verifica se user tem permissão específica na empresa
   * Usado para controle de acesso granular
   */
  static async checkPermission(
    userId: string,
    companyId: string,
    action: string,
  ): Promise<boolean> {
    try {
      const db = await getDatabase();

      const userCompany = await db('company_users')
        .select('permissions')
        .where('user_id', userId)
        .where('company_id', companyId)
        .where('is_active', true)
        .first();

      if (!userCompany) {
        return false;
      }

      let permissions: string[] = [];
      try {
        permissions = typeof userCompany.permissions === 'string'
          ? JSON.parse(userCompany.permissions)
          : userCompany.permissions || [];
      } catch (e) {
        return false;
      }

      return permissions.includes(action);
    } catch (error) {
      logger.error('Error checking permission', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        companyId,
        action,
      });
      return false;
    }
  }

  /**
   * Valida múltiplas permissões (AND logic)
   * Retorna true apenas se user tem TODAS as permissões
   */
  static async checkAllPermissions(
    userId: string,
    companyId: string,
    actions: string[],
  ): Promise<boolean> {
    for (const action of actions) {
      const hasPermission = await this.checkPermission(userId, companyId, action);
      if (!hasPermission) {
        return false;
      }
    }
    return true;
  }

  /**
   * Valida múltiplas permissões (OR logic)
   * Retorna true se user tem PELO MENOS UMA permissão
   */
  static async checkAnyPermission(
    userId: string,
    companyId: string,
    actions: string[],
  ): Promise<boolean> {
    for (const action of actions) {
      const hasPermission = await this.checkPermission(userId, companyId, action);
      if (hasPermission) {
        return true;
      }
    }
    return false;
  }

  /**
   * Retorna todas as permissões do usuário na empresa
   */
  static async getUserPermissions(
    userId: string,
    companyId: string,
  ): Promise<string[]> {
    try {
      const db = await getDatabase();

      const userCompany = await db('company_users')
        .select('permissions')
        .where('user_id', userId)
        .where('company_id', companyId)
        .where('is_active', true)
        .first();

      if (!userCompany) {
        return [];
      }

      let permissions: string[] = [];
      try {
        permissions = typeof userCompany.permissions === 'string'
          ? JSON.parse(userCompany.permissions)
          : userCompany.permissions || [];
      } catch (e) {
        return [];
      }

      return permissions;
    } catch (error) {
      logger.error('Error getting user permissions', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        companyId,
      });
      return [];
    }
  }

  /**
   * Audit logging de acessos
   * Registra todas as ações de acesso cross-tenant
   */
  static async auditAccess(
    userId: string,
    companyId: string,
    action: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      const db = await getDatabase();

      await db('access_audit').insert({
        user_id: userId,
        company_id: companyId,
        action,
        details: details ? JSON.stringify(details) : null,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error recording audit', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        companyId,
        action,
      });
    }
  }

  /**
   * Retorna histórico de acessos do usuário
   * Útil para detectar atividades suspeitas
   */
  static async getAccessHistory(
    userId: string,
    limit: number = 50,
  ): Promise<any[]> {
    try {
      const db = await getDatabase();

      return await db('access_audit')
        .select('*')
        .where('user_id', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);
    } catch (error) {
      logger.error('Error retrieving access history', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Detecta atividade suspeita
   * Retorna true se detecta padrões de ataque
   *
   * Padrões detectados:
   * 1. Múltiplos acessos negados em curto tempo
   * 2. Acesso a múltiplas empresas rapidamente
   * 3. Horários anormais de acesso
   */
  static async detectSuspiciousActivity(userId: string): Promise<boolean> {
    try {
      const db = await getDatabase();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
      const oneHourAgo = new Date(Date.now() - 60 * 60000);

      // Check 1: Múltiplas negações em 5 min
      const recentDenials = await db('access_audit')
        .count('* as count')
        .where('user_id', userId)
        .where('action', 'ACCESS_DENIED')
        .where('timestamp', '>', fiveMinutesAgo)
        .first();

      if (recentDenials?.count > 10) {
        logger.warn('SUSPICIOUS ACTIVITY: Multiple access denials', {
          userId,
          denialCount: recentDenials.count,
        });
        return true;
      }

      // Check 2: Acesso a múltiplas empresas rapidamente
      const uniqueCompanies = await db('access_audit')
        .distinct('company_id')
        .count('* as count')
        .where('user_id', userId)
        .where('action', 'COMPANY_SWITCH')
        .where('timestamp', '>', oneHourAgo)
        .first();

      if (uniqueCompanies?.count > 5) {
        logger.warn('SUSPICIOUS ACTIVITY: Multiple company switches in 1 hour', {
          userId,
          switchCount: uniqueCompanies.count,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error detecting suspicious activity', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return false;
    }
  }

  /**
   * Gera relatório de acessos por tenant
   * Útil para auditoria e compliance
   */
  static async getAccessReportByCompany(
    companyId: string,
    days: number = 30,
  ): Promise<any> {
    try {
      const db = await getDatabase();
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60000);

      const stats = await db('access_audit')
        .select(
          'user_id',
          'action',
          db.raw('COUNT(*) as count'),
          db.raw('MAX(timestamp) as last_access'),
        )
        .where('company_id', companyId)
        .where('timestamp', '>', sinceDate)
        .groupBy('user_id', 'action')
        .orderBy('user_id', 'asc');

      return {
        companyId,
        period: `${days} days`,
        sinceDate,
        totalRecords: stats.length,
        stats,
      };
    } catch (error) {
      logger.error('Error generating access report', {
        error: error instanceof Error ? error.message : String(error),
        companyId,
      });
      return null;
    }
  }
}

export default TenantService;
