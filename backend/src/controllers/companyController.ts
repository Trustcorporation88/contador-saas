/**
 * Company Controller
 * Manipula requisições HTTP para gerenciamento de empresas
 * Aplica validações, tratamento de erros e respostas padronizadas
 */

import { Request, Response } from 'express';
import { CompanyService } from '../services/companyService';
import { logger } from '../middleware/requestLogger';
import { ERROR_CODES, HTTP_STATUS } from '../config/constants';

/**
 * Estender Express Request para incluir usuário autenticado
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        companyId?: string;
      };
      tenant?: {
        companyId: string;
        userId: string;
        role: string;
        permissions: string[];
      };
    }
  }
}

/**
 * Company Controller
 */
export class CompanyController {
  /**
   * POST /companies
   * Criar nova empresa
   * Requer: Admin role
   * Body: {cnpj, name, address?, phone?, email?, tax_regime, fiscal_year_start?}
   *
   * @param req - Express Request
   * @param res - Express Response
   */
  static async createCompany(req: Request, res: Response): Promise<void> {
    try {
      // Validar autenticação
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Unauthorized',
          code: ERROR_CODES.UNAUTHORIZED,
        });
        return;
      }

      // Validar role (apenas admin pode criar)
      if (req.user.role !== 'admin') {
        logger.warn('Non-admin attempted to create company', {
          userId: req.user.id,
          role: req.user.role,
        });

        res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
          message: 'Only administrators can create companies',
        });
        return;
      }

      const { cnpj, name, address, phone, email, tax_regime, fiscal_year_start } = req.body;

      // Validar dados obrigatórios
      if (!cnpj || !name || !tax_regime) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Missing required fields: cnpj, name, tax_regime',
        });
        return;
      }

      // Criar empresa
      const company = await CompanyService.create(
        {
          cnpj,
          name,
          address,
          phone,
          email,
          tax_regime,
          fiscal_year_start,
        },
        req.user.id, // Auto-associar criador como admin
      );

      logger.info('Company created successfully', {
        companyId: company.id,
        createdBy: req.user.id,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: company,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Erro de CNPJ duplicado
      if (errorMessage.includes('CNPJ already registered')) {
        res.status(HTTP_STATUS.CONFLICT).json({
          error: 'Conflict',
          code: 'CNPJ_EXISTS',
          message: 'CNPJ already registered',
        });
        return;
      }

      // Erro de validação
      if (errorMessage.includes('Validation error')) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: ERROR_CODES.VALIDATION_ERROR,
          message: errorMessage,
        });
        return;
      }

      logger.error('Error creating company', {
        error: errorMessage,
        userId: req.user?.id,
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * GET /companies
   * Listar empresas com paginação e filtros
   * Admin vê todas, users veem suas próprias
   * Query params: page, limit, search, tax_regime, created_from, created_to
   *
   * @param req - Express Request
   * @param res - Express Response
   */
  static async listCompanies(req: Request, res: Response): Promise<void> {
    console.log('[COMPANIES_CONTROLLER_ENTER] listCompanies called');
    try {
      // Validar autenticação
      if (!req.user) {
        console.log('[COMPANIES_CONTROLLER] No user in request');
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Unauthorized',
          code: ERROR_CODES.UNAUTHORIZED,
        });
        return;
      }

      console.log('[COMPANIES_CONTROLLER] User authenticated:', { userId: req.user.id, role: req.user.role });

      // Extrair query params
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = req.query.search as string | undefined;
      const tax_regime = req.query.tax_regime as string | undefined;
      const created_from = req.query.created_from as string | undefined;
      const created_to = req.query.created_to as string | undefined;

      // Validar paginação
      if (page < 1) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Page must be >= 1',
        });
        return;
      }

      if (limit < 1 || limit > 100) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Limit must be between 1 and 100',
        });
        return;
      }

      // Determinar se é admin
      const isAdmin = req.user.role === 'admin';
      console.log('[COMPANIES_CONTROLLER] Calling service.list with isAdmin=' + isAdmin);

      // Listar empresas
      const result = await CompanyService.list(isAdmin, isAdmin ? undefined : req.user.id, {
        page,
        limit,
        search,
        tax_regime,
        created_from,
        created_to,
      });

      console.log('[COMPANIES_CONTROLLER] Service.list returned, total=' + result.total);

      logger.info('Companies listed', {
        userId: req.user.id,
        isAdmin,
        page,
        limit,
        total: result.total,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      console.error('[COMPANIES_CONTROLLER_ERROR] Exception caught:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorObject: error,
      });
      logger.error('Error listing companies', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });

      // Send error response with details if not in production
      const isDev = process.env.NODE_ENV !== 'production';
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        code: ERROR_CODES.INTERNAL_ERROR,
        ...(isDev && {
          details: error instanceof Error ? error.message : String(error),
          stack: isDev && error instanceof Error ? error.stack : undefined,
        }),
      });
    }
  }

  /**
   * GET /companies/:id
   * Obter detalhes de uma empresa
   * Owner ou Admin apenas
   *
   * @param req - Express Request
   * @param res - Express Response
   */
  static async getCompany(req: Request, res: Response): Promise<void> {
    try {
      // Validar autenticação
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Unauthorized',
          code: ERROR_CODES.UNAUTHORIZED,
        });
        return;
      }

      const { id } = req.params;

      // Obter empresa
      const company = await CompanyService.getById(id, req.user.companyId, req.user.id);

      logger.info('Company retrieved', {
        companyId: id,
        userId: req.user.id,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: company,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Empresa não encontrada
      if (errorMessage.includes('Company not found')) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Not Found',
          code: 'COMPANY_NOT_FOUND',
          message: 'Company not found',
        });
        return;
      }

      // Acesso negado
      if (errorMessage.includes('Access denied')) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
          message: 'You do not have access to this company',
        });
        return;
      }

      logger.error('Error retrieving company', {
        error: errorMessage,
        companyId: req.params.id,
        userId: req.user?.id,
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * PUT /companies/:id
   * Atualizar empresa
   * Owner ou Admin apenas
   * CNPJ é imutável
   * Body: {name?, address?, phone?, email?, tax_regime?, fiscal_year_start?}
   *
   * @param req - Express Request
   * @param res - Express Response
   */
  static async updateCompany(req: Request, res: Response): Promise<void> {
    try {
      // Validar autenticação
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Unauthorized',
          code: ERROR_CODES.UNAUTHORIZED,
        });
        return;
      }

      const { id } = req.params;
      const { name, address, phone, email, tax_regime, fiscal_year_start } = req.body;

      // Verificar se tentou alterar CNPJ
      if (req.body.cnpj) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'CNPJ cannot be modified',
        });
        return;
      }

      // Validar que há pelo menos um campo a atualizar
      if (
        !name &&
        !address &&
        !phone &&
        !email &&
        !tax_regime &&
        !fiscal_year_start
      ) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'At least one field must be provided for update',
        });
        return;
      }

      // Atualizar empresa
      const company = await CompanyService.update(
        id,
        {
          name,
          address,
          phone,
          email,
          tax_regime,
          fiscal_year_start,
        },
        req.user.id,
        req.user.companyId,
      );

      logger.info('Company updated successfully', {
        companyId: id,
        updatedBy: req.user.id,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: company,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Empresa não encontrada
      if (errorMessage.includes('Company not found')) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Not Found',
          code: 'COMPANY_NOT_FOUND',
          message: 'Company not found',
        });
        return;
      }

      // Empresa inativa
      if (errorMessage.includes('Cannot update inactive company')) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: 'COMPANY_INACTIVE',
          message: 'Cannot update inactive company',
        });
        return;
      }

      // Erro de validação
      if (errorMessage.includes('Validation error')) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: ERROR_CODES.VALIDATION_ERROR,
          message: errorMessage,
        });
        return;
      }

      // Acesso negado (implícito no TenantService)
      if (errorMessage.includes('Access denied')) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
          message: 'You do not have access to this company',
        });
        return;
      }

      logger.error('Error updating company', {
        error: errorMessage,
        companyId: req.params.id,
        userId: req.user?.id,
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * DELETE /companies/:id
   * Deletar empresa (soft delete)
   * Admin only
   * Response: 204 No Content
   *
   * @param req - Express Request
   * @param res - Express Response
   */
  static async deleteCompany(req: Request, res: Response): Promise<void> {
    try {
      // Validar autenticação
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Unauthorized',
          code: ERROR_CODES.UNAUTHORIZED,
        });
        return;
      }

      // Validar role (apenas admin pode deletar)
      if (req.user.role !== 'admin') {
        logger.warn('Non-admin attempted to delete company', {
          userId: req.user.id,
          role: req.user.role,
          companyId: req.params.id,
        });

        res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
          message: 'Only administrators can delete companies',
        });
        return;
      }

      const { id } = req.params;

      // Deletar empresa
      await CompanyService.delete(id, req.user.id);

      logger.info('Company deleted successfully', {
        companyId: id,
        deletedBy: req.user.id,
      });

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Empresa não encontrada
      if (errorMessage.includes('Company not found')) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Not Found',
          code: 'COMPANY_NOT_FOUND',
          message: 'Company not found',
        });
        return;
      }

      // Já deletada
      if (errorMessage.includes('already deleted')) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          code: 'COMPANY_ALREADY_DELETED',
          message: 'Company is already deleted',
        });
        return;
      }

      logger.error('Error deleting company', {
        error: errorMessage,
        companyId: req.params.id,
        userId: req.user?.id,
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * GET /companies/:id/stats
   * Obter estatísticas da empresa
   * Owner ou Admin apenas
   *
   * @param req - Express Request
   * @param res - Express Response
   */
  static async getCompanyStats(req: Request, res: Response): Promise<void> {
    try {
      // Validar autenticação
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Unauthorized',
          code: ERROR_CODES.UNAUTHORIZED,
        });
        return;
      }

      const { id } = req.params;

      // Validar acesso
      await CompanyService.getById(id, req.user.companyId, req.user.id);

      // Obter estatísticas
      const stats = await CompanyService.getCompanyStats(id);

      logger.info('Company stats retrieved', {
        companyId: id,
        userId: req.user.id,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Empresa não encontrada
      if (errorMessage.includes('Company not found')) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Not Found',
          code: 'COMPANY_NOT_FOUND',
          message: 'Company not found',
        });
        return;
      }

      // Acesso negado
      if (errorMessage.includes('Access denied')) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
          message: 'You do not have access to this company',
        });
        return;
      }

      logger.error('Error retrieving company stats', {
        error: errorMessage,
        companyId: req.params.id,
        userId: req.user?.id,
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  }
}
