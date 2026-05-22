/**
 * Tax Controller
 * Endpoints de apuração e gestão de impostos
 * Com cache Redis para otimização de performance
 */

import { Request, Response, NextFunction } from 'express';
import { TaxCalculationService } from '../services/taxCalculationService';
import { TaxRegime, TaxStatus, TaxType, CalculateTaxDTO } from '../models/dtos/taxDTO';
import { logger } from '../middleware/requestLogger';
import cacheService, { TTL_CONFIG } from '../services/cache/cacheService';
import CacheKeys from '../services/cache/cacheKeys';

export class TaxController {

  /**
   * POST /companies/:companyId/taxes/calculate
   * Calcula impostos do período sem salvar
   * Body: CalculateTaxDTO
   * Cache: 1 hora
   */
  static async calculate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dto: CalculateTaxDTO = {
        company_id:   companyId,
        tax_regime:   req.body.tax_regime as TaxRegime,
        period_start: req.body.period_start,
        period_end:   req.body.period_end,
        rbt12:        req.body.rbt12,
        atividade:    req.body.atividade,
        iss_rate:     req.body.iss_rate,
        icms_rate:    req.body.icms_rate,
      };

      if (!dto.tax_regime || !dto.period_start || !dto.period_end) {
        return res.status(400).json({ error: 'tax_regime, period_start e period_end são obrigatórios' });
      }
      if (!Object.values(TaxRegime).includes(dto.tax_regime)) {
        return res.status(400).json({ error: `tax_regime inválido. Use: ${Object.values(TaxRegime).join(', ')}` });
      }

      // Try cache first
      const cacheKey = CacheKeys.taxCalculation(
        companyId,
        dto.period_start,
        dto.period_end,
        dto.tax_regime
      );
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.info('Cache HIT - Tax Calculation', { companyId, regime: dto.tax_regime, key: cacheKey });
        return res.status(200).json(cached);
      }

      // Cache MISS
      logger.info('Cache MISS - Tax Calculation', { companyId, regime: dto.tax_regime, key: cacheKey });
      const result = await TaxCalculationService.calculate(dto);

      // Store in cache (1 hora - cálculos são pesados)
      await cacheService.set(cacheKey, result, TTL_CONFIG.TAXES);

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Tax calculate error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/taxes/appraisal
   * Calcula e salva apuração no banco (tax_calculations)
   * Body: CalculateTaxDTO
   * INVALIDATES CACHE: Invalida caches de taxes da empresa
   */
  static async appraisal(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dto: CalculateTaxDTO = {
        company_id:   companyId,
        tax_regime:   req.body.tax_regime as TaxRegime,
        period_start: req.body.period_start,
        period_end:   req.body.period_end,
        rbt12:        req.body.rbt12,
        atividade:    req.body.atividade,
        iss_rate:     req.body.iss_rate,
        icms_rate:    req.body.icms_rate,
      };

      if (!dto.tax_regime || !dto.period_start || !dto.period_end) {
        return res.status(400).json({ error: 'tax_regime, period_start e period_end são obrigatórios' });
      }

      const result = await TaxCalculationService.calculate(dto);
      const saved  = await TaxCalculationService.save(result);

      // INVALIDATE CACHE após salvar apuração
      const invalidatedCount = await cacheService.invalidateTaxes(companyId);
      logger.info('Cache invalidated after tax appraisal save', { 
        companyId,
        invalidatedKeys: invalidatedCount 
      });

      return res.status(201).json({ calculation: result, saved });
    } catch (err) {
      logger.error('Tax appraisal error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/taxes/appraisal
   * Lista apurações salvas com filtros opcionais
   * Query: tax_type, status, period_start, period_end
   * Cache: 30 minutos
   */
  static async listAppraisals(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const filters = {
        tax_type:     req.query.tax_type as TaxType | undefined,
        status:       req.query.status as TaxStatus | undefined,
        period_start: req.query.period_start as string | undefined,
        period_end:   req.query.period_end as string | undefined,
      };

      // Try cache first
      const cacheKey = CacheKeys.taxAppraisalList(companyId, filters);
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.info('Cache HIT - Tax Appraisal List', { companyId, key: cacheKey });
        return res.status(200).json(cached);
      }

      // Cache MISS
      logger.info('Cache MISS - Tax Appraisal List', { companyId, key: cacheKey });
      const rows = await TaxCalculationService.list(companyId, filters);
      const result = { data: rows, total: rows.length };

      // Store in cache (30 minutos)
      await cacheService.set(cacheKey, result, TTL_CONFIG.TAXES / 2);

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Tax list error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * PATCH /companies/:companyId/taxes/appraisal/:id/status
   * Atualiza status de uma apuração (PENDING → APPROVED → FILED)
   * Body: { status: 'APPROVED' | 'FILED' }
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      const status = req.body.status as TaxStatus;

      if (!Object.values(TaxStatus).includes(status)) {
        return res.status(400).json({ error: `status inválido. Use: ${Object.values(TaxStatus).join(', ')}` });
      }

      const updated = await TaxCalculationService.updateStatus(id, companyId, status);
      if (!updated) return res.status(404).json({ error: 'Apuração não encontrada' });

      return res.status(200).json(updated);
    } catch (err) {
      logger.error('Tax status update error', { error: (err as Error).message });
      return next(err);
    }
  }
}
