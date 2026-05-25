/**
 * DocumentoFiscalController
 * Controlador para endpoints de documentos fiscais
 */

import { Request, Response } from 'express';
import { DocumentoFiscalService } from '../services/documentoFiscalService';
import {
  CreateDocumentoFiscalDTO,
  FiltrosDocumentiFiscal,
} from '../models/tipos/DocumentoFiscalTypes';
import { logger } from '../middleware/requestLogger';

export class DocumentoFiscalController {
  /**
   * POST /api/v1/documentos
   * Criar novo documento fiscal
   */
  static async criar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.id;

      if (!companyId || !userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const data = req.body as CreateDocumentoFiscalDTO;

      if (!data.tipo || !data.numero || !data.serie || !data.descricao) {
        res.status(400).json({
          success: false,
          error: 'Campos obrigatórios: tipo, numero, serie, descricao',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      if (!data.itens || data.itens.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Documento deve ter pelo menos 1 item',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const resultado = await DocumentoFiscalService.create(companyId, userId, data);

      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      logger.info('Documento fiscal criado', { companyId, userId });
      res.status(201).json(resultado);
    } catch (error) {
      logger.error('Erro ao criar documento fiscal', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Erro ao criar documento',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/v1/documentos
   * Listar documentos com filtros
   */
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const filters: FiltrosDocumentiFiscal = {
        tipo: req.query.tipo as any,
        status: req.query.status as any,
        contraparte_tipo: req.query.contraparte_tipo as any,
        data_emissao_de: req.query.data_emissao_de as string,
        data_emissao_ate: req.query.data_emissao_ate as string,
        valor_minimo: req.query.valor_minimo ? Number(req.query.valor_minimo) : undefined,
        valor_maximo: req.query.valor_maximo ? Number(req.query.valor_maximo) : undefined,
        contraparte_cnpj: req.query.contraparte_cnpj as string,
        descricao: req.query.descricao as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sort_by: req.query.sort_by as any,
        sort_order: req.query.sort_order as any,
      };

      const resultado = await DocumentoFiscalService.list(companyId, filters);
      res.json(resultado);
    } catch (error) {
      logger.error('Erro ao listar documentos fiscais', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Erro ao listar documentos',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/v1/documentos/:id
   * Obter documento por ID
   */
  static async obter(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const { id } = req.params;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const documento = await DocumentoFiscalService.getById(companyId, id);

      if (!documento) {
        res.status(404).json({
          success: false,
          error: 'Documento não encontrado',
          code: 'NOT_FOUND',
        });
        return;
      }

      res.json({ success: true, data: documento });
    } catch (error) {
      logger.error('Erro ao obter documento fiscal', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Erro ao obter documento',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * PUT /api/v1/documentos/:id
   * Atualizar documento (apenas rascunho)
   */
  static async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.id;
      const { id } = req.params;

      if (!companyId || !userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const resultado = await DocumentoFiscalService.update(companyId, id, userId, req.body);

      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      res.json(resultado);
    } catch (error) {
      logger.error('Erro ao atualizar documento fiscal', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar documento',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * POST /api/v1/documentos/:id/registrar
   * Registrar documento (rascunho → registrado)
   */
  static async registrar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const { id } = req.params;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const resultado = await DocumentoFiscalService.registrar(companyId, id);

      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      res.json(resultado);
    } catch (error) {
      logger.error('Erro ao registrar documento fiscal', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Erro ao registrar documento',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * DELETE /api/v1/documentos/:id
   * Cancelar/deletar documento
   */
  static async cancelar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const { id } = req.params;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const resultado = await DocumentoFiscalService.cancelar(companyId, id);

      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      res.json(resultado);
    } catch (error) {
      logger.error('Erro ao cancelar documento fiscal', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Erro ao cancelar documento',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/v1/documentos/stats/estatisticas
   * Obter estatísticas de documentos
   */
  static async getEstatisticas(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const stats = await DocumentoFiscalService.getEstatisticas(companyId);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Erro ao obter estatísticas de documentos', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Erro ao obter estatísticas',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}
