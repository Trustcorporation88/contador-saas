/**
 * DAS Controller
 * Endpoints: GET/POST /companies/:companyId/das
 */

import { Request, Response, NextFunction } from 'express';
import { DASService } from '../services/dasService';
import { CreateDASDTO, ListDASFilters, RegisterPaymentDTO, UpdateDASDTO, GenerateDASFromTaxDTO, UpdateAgendamentoDASDTO } from '../models/dtos/dasDTO';
import { logger } from '../middleware/requestLogger';

export class DASController {
  /**
   * POST /companies/:companyId/das/generate
   * Gera um boleto DAS manualmente
   * Body: CreateDASDTO
   */
  static async generate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const userId = (req as any).userId;

      const dto: CreateDASDTO = {
        mes_competencia: req.body.mes_competencia,
        ano_competencia: req.body.ano_competencia,
        valor_original: req.body.valor_original,
        regime_tributario: req.body.regime_tributario,
        juros: req.body.juros,
        multa: req.body.multa,
        desconto: req.body.desconto,
        observacoes: req.body.observacoes,
        tax_calculation_id: req.body.tax_calculation_id,
      };

      // Validações básicas
      if (!dto.mes_competencia || !dto.ano_competencia || !dto.valor_original || !dto.regime_tributario) {
        return res.status(400).json({
          error: 'Campos obrigatórios: mes_competencia, ano_competencia, valor_original, regime_tributario',
        });
      }

      if (dto.valor_original <= 0) {
        return res.status(400).json({ error: 'Valor original deve ser maior que zero' });
      }

      logger.info('Gerando DAS', { companyId, mes: dto.mes_competencia, ano: dto.ano_competencia });

      const result = await DASService.create(companyId, userId, dto);
      const statusCode = result.success ? 201 : 400;
      return res.status(statusCode).json(result);
    } catch (err) {
      logger.error('DAS generate error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/das/generate-auto
   * Gera DAS automaticamente a partir de uma apuração de impostos
   * Body: GenerateDASFromTaxDTO
   */
  static async generateAuto(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const userId = (req as any).userId;
      const dto: GenerateDASFromTaxDTO = req.body;

      if (!dto.tax_calculation_id) {
        return res.status(400).json({ error: 'tax_calculation_id é obrigatório' });
      }

      logger.info('Gerando DAS automaticamente', { companyId, taxCalcId: dto.tax_calculation_id });

      // Aqui você faria a integração com TaxCalculationService
      // Por agora, retornamos um erro indicando que deve ser implementado
      return res.status(501).json({
        error: 'Geração automática de DAS a partir de tax_calculation ainda não implementada',
        hint: 'Use o endpoint /das/generate e passe os dados calculados manualmente',
      });
    } catch (err) {
      logger.error('DAS generateAuto error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/das
   * Lista boletos DAS com filtros e paginação
   * Query params: status, regime_tributario, mes, ano, data_vencimento_de, data_vencimento_ate, somente_atrasadas, page, limit
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;

      const filters: ListDASFilters = {
        status: req.query.status as any,
        regime_tributario: req.query.regime_tributario as any,
        mes_competencia: req.query.mes_competencia ? parseInt(req.query.mes_competencia as string) : undefined,
        ano_competencia: req.query.ano_competencia ? parseInt(req.query.ano_competencia as string) : undefined,
        data_vencimento_de: req.query.data_vencimento_de as string,
        data_vencimento_ate: req.query.data_vencimento_ate as string,
        somente_atrasadas: req.query.somente_atrasadas === 'true',
        somente_nao_pagos: req.query.somente_nao_pagos === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        sort_by: (req.query.sort_by as any) || 'data_vencimento',
        sort_order: (req.query.sort_order as any) || 'asc',
      };

      const result = await DASService.list(companyId, filters);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('DAS list error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/das/:dasId
   * Busca um DAS específico
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dasId = req.params.dasId;

      const das = await DASService.getById(companyId, dasId);

      if (!das) {
        return res.status(404).json({ error: 'DAS não encontrado' });
      }

      return res.status(200).json({ success: true, data: das });
    } catch (err) {
      logger.error('DAS getById error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * PATCH /companies/:companyId/das/:dasId
   * Atualiza um DAS (juros, multa, desconto, observações)
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dasId = req.params.dasId;
      const userId = (req as any).userId;

      const dto: UpdateDASDTO = {
        juros: req.body.juros,
        multa: req.body.multa,
        desconto: req.body.desconto,
        observacoes: req.body.observacoes,
      };

      const result = await DASService.update(companyId, dasId, userId, dto);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (err) {
      logger.error('DAS update error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/das/:dasId/pay
   * Registra pagamento de um DAS
   * Body: RegisterPaymentDTO
   */
  static async registrarPagamento(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dasId = req.params.dasId;
      const userId = (req as any).userId;

      const dto: RegisterPaymentDTO = {
        data_pagamento: req.body.data_pagamento,
        valor_pago: req.body.valor_pago,
        juros_pago: req.body.juros_pago,
        multa_paga: req.body.multa_paga,
        numero_comprovante: req.body.numero_comprovante,
      };

      if (!dto.data_pagamento || !dto.valor_pago) {
        return res.status(400).json({
          error: 'Campos obrigatórios: data_pagamento, valor_pago',
        });
      }

      logger.info('Registrando pagamento DAS', { dasId, valor: dto.valor_pago });

      const result = await DASService.registrarPagamento(companyId, dasId, userId, dto);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (err) {
      logger.error('DAS registrarPagamento error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * DELETE /companies/:companyId/das/:dasId
   * Cancela um DAS
   * Body: { motivo: string }
   */
  static async cancelar(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dasId = req.params.dasId;
      const userId = (req as any).userId;
      const motivo = req.body.motivo || 'Cancelamento sem motivo especificado';

      logger.info('Cancelando DAS', { dasId });

      const result = await DASService.cancelar(companyId, dasId, userId, motivo);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (err) {
      logger.error('DAS cancelar error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/das/agendamento/:regime
   * Busca configurações de agendamento automático
   */
  static async obterAgendamento(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const regime = req.params.regime as any;

      if (!['SIMPLES', 'LUCRO_REAL', 'LUCRO_PRESUMIDO'].includes(regime)) {
        return res.status(400).json({ error: 'Regime inválido' });
      }

      const agendamento = await DASService.obterAgendamento(companyId, regime);

      return res.status(200).json({
        success: true,
        data: agendamento,
      });
    } catch (err) {
      logger.error('DAS obterAgendamento error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * PUT /companies/:companyId/das/agendamento/:regime
   * Atualiza configurações de agendamento automático
   */
  static async atualizarAgendamento(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const regime = req.params.regime as any;
      const userId = (req as any).userId;

      if (!['SIMPLES', 'LUCRO_REAL', 'LUCRO_PRESUMIDO'].includes(regime)) {
        return res.status(400).json({ error: 'Regime inválido' });
      }

      const dto: UpdateAgendamentoDASDTO = {
        auto_gerar: req.body.auto_gerar,
        dias_antes_alerta: req.body.dias_antes_alerta,
        codigos_receita: req.body.codigos_receita,
      };

      const agendamento = await DASService.atualizarAgendamento(companyId, regime, userId, dto);

      if (!agendamento) {
        return res.status(500).json({ error: 'Erro ao atualizar agendamento' });
      }

      return res.status(200).json({
        success: true,
        data: agendamento,
        message: 'Agendamento atualizado com sucesso',
      });
    } catch (err) {
      logger.error('DAS atualizarAgendamento error', { error: (err as Error).message });
      return next(err);
    }
  }
}
