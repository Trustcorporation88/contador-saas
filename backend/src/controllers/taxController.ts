/**
 * Tax Controller
 * Endpoints de apuração e gestão de impostos
 * Com cache Redis para otimização de performance
 */

import { Request, Response, NextFunction } from 'express';
import { TaxCalculationService } from '../services/taxCalculationService';
import { TaxAdjustmentService } from '../services/taxAdjustmentService';
import {
  TaxRegime, TaxStatus, TaxType, CalculateTaxDTO, ApuracaoPeriodicidade,
} from '../models/dtos/taxDTO';
import { ReformaTributariaService } from '../services/reformaTributariaService';
import { ReformaTaxType, RateNature, CalculateReformaDTO, ProjecaoReformaDTO } from '../models/dtos/reformaTributariaDTO';
import fs from 'fs';
import path from 'path';
import { logger } from '../middleware/requestLogger';
import cacheService, { TTL_CONFIG } from '../services/cache/cacheService';
import CacheKeys from '../services/cache/cacheKeys';

export class TaxController {

  /**
   * Monta o DTO de cálculo a partir do body.
   *
   * Centralizado porque /calculate e /appraisal montavam o mesmo objeto em duas
   * cópias — e é assim que um campo novo entra em um endpoint e não no outro.
   */
  private static montarCalculateDto(companyId: string, body: Record<string, unknown>): CalculateTaxDTO {
    return {
      company_id:   companyId,
      tax_regime:   body.tax_regime as TaxRegime,
      period_start: body.period_start as string,
      period_end:   body.period_end as string,
      rbt12:        body.rbt12 as number | undefined,
      atividade:    body.atividade as CalculateTaxDTO['atividade'],
      iss_rate:     body.iss_rate as number | undefined,
      icms_rate:    body.icms_rate as number | undefined,
      apuracao:     body.apuracao as ApuracaoPeriodicidade | undefined,
      prejuizo_fiscal_acumulado: body.prejuizo_fiscal_acumulado as number | undefined,
    };
  }

  /**
   * Entradas que mudam o resultado e precisam entrar na chave de cache. Sem isso
   * duas simulações do mesmo período e regime, com atividade ou alíquota
   * diferentes, compartilhavam a chave e a segunda recebia o resultado da
   * primeira.
   */
  private static varianteDeCache(dto: CalculateTaxDTO): string {
    return [
      dto.atividade ?? '-',
      dto.rbt12 ?? '-',
      dto.iss_rate ?? '-',
      dto.icms_rate ?? '-',
      dto.apuracao ?? '-',
      dto.prejuizo_fiscal_acumulado ?? '-',
    ].join('|');
  }

  /**
   * POST /companies/:companyId/taxes/calculate
   * Calcula impostos do período sem salvar
   * Body: CalculateTaxDTO
   * Cache: 1 hora
   */
  static async calculate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dto = TaxController.montarCalculateDto(companyId, req.body);

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
        dto.tax_regime,
        TaxController.varianteDeCache(dto),
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
      const dto = TaxController.montarCalculateDto(companyId, req.body);

      if (!dto.tax_regime || !dto.period_start || !dto.period_end) {
        return res.status(400).json({ error: 'tax_regime, period_start e period_end são obrigatórios' });
      }

      const result = await TaxCalculationService.calculate(dto);
      const guide = await TaxCalculationService.generateDASGuide(result);

      const guidesDir = path.resolve(process.cwd(), 'generated-guides');
      await fs.promises.mkdir(guidesDir, { recursive: true });
      const filePath = path.join(guidesDir, guide.filename);
      await fs.promises.writeFile(filePath, guide.buffer);

      const saved = await TaxCalculationService.save(result);

      // INVALIDATE CACHE após salvar apuração
      const invalidatedCount = await cacheService.invalidateTaxes(companyId);
      logger.info('Cache invalidated after tax appraisal save', {
        companyId,
        invalidatedKeys: invalidatedCount,
      });

      return res.status(201).json({ calculation: result, saved, guide: { filename: guide.filename } });
    } catch (err) {
      logger.error('Tax appraisal error', { error: (err as Error).message });
      return next(err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LALUR — adições e exclusões
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * POST /companies/:companyId/taxes/adjustments
   * Registra uma adição ou exclusão do LALUR.
   * Body: { period_start, period_end, adjustment_type, amount, justification, account_id? }
   */
  static async createAdjustment(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const ajuste = await TaxAdjustmentService.create(companyId, req.user?.id ?? null, {
        period_start:    req.body.period_start,
        period_end:      req.body.period_end,
        adjustment_type: req.body.adjustment_type,
        amount:          Number(req.body.amount),
        justification:   req.body.justification,
        account_id:      req.body.account_id,
      });

      // Um ajuste muda a base do IRPJ/CSLL: cálculo em cache do mesmo período
      // ficaria desatualizado e ninguém perceberia.
      await cacheService.invalidateTaxes(companyId);

      return res.status(201).json({ data: ajuste });
    } catch (err) {
      logger.error('Tax adjustment create error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/taxes/adjustments
   * Lista ajustes do LALUR. Query: period_start, period_end
   */
  static async listAdjustments(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const rows = await TaxAdjustmentService.list(companyId, {
        period_start: req.query.period_start as string | undefined,
        period_end:   req.query.period_end as string | undefined,
      });
      return res.status(200).json({ data: rows, total: rows.length });
    } catch (err) {
      logger.error('Tax adjustment list error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * DELETE /companies/:companyId/taxes/adjustments/:id
   */
  static async deleteAdjustment(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      await TaxAdjustmentService.remove(companyId, id);
      await cacheService.invalidateTaxes(companyId);
      return res.status(204).send();
    } catch (err) {
      logger.error('Tax adjustment delete error', { error: (err as Error).message });
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

  // ─── Reforma Tributária (CBS/IBS) ─────────────────────────────────────────

  /**
   * POST /companies/:companyId/taxes/reforma/calculate
   * Calcula CBS/IBS de um único ano-calendário (2026 em diante)
   * Body: { ano, tax_regime, period_start?, period_end?, revenues? }
   */
  static async calculateReforma(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const ano = Number(req.body.ano);
      const regime = req.body.tax_regime as TaxRegime;

      if (!ano || !Number.isInteger(ano)) {
        return res.status(400).json({ error: 'ano é obrigatório (ex.: 2026)' });
      }
      if (!regime || !Object.values(TaxRegime).includes(regime)) {
        return res.status(400).json({ error: `tax_regime inválido. Use: ${Object.values(TaxRegime).join(', ')}` });
      }

      const dto: CalculateReformaDTO = {
        company_id: companyId,
        ano,
        regime,
        period_start: req.body.period_start,
        period_end: req.body.period_end,
        revenues: req.body.revenues,
        icms_iss_legado_amount: req.body.icms_iss_legado_amount,
      };

      const cacheKey = CacheKeys.reformaCalculation(companyId, ano, regime, dto.revenues);
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }

      const result = await ReformaTributariaService.calculate(dto);
      await cacheService.set(cacheKey, result, TTL_CONFIG.TAXES);

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Reforma calculate error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/taxes/reforma/projecao
   * Projeta CBS/IBS ano a ano (ex.: 2026-2033)
   * Body: { ano_inicio, ano_fim, tax_regime, revenues? }
   */
  static async projetarReforma(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const anoInicio = Number(req.body.ano_inicio);
      const anoFim = Number(req.body.ano_fim);
      const regime = req.body.tax_regime as TaxRegime;

      if (!anoInicio || !anoFim || !Number.isInteger(anoInicio) || !Number.isInteger(anoFim)) {
        return res.status(400).json({ error: 'ano_inicio e ano_fim são obrigatórios' });
      }
      if (Math.abs(anoFim - anoInicio) > 20) {
        return res.status(400).json({ error: 'Intervalo de projeção muito amplo (máx. 20 anos)' });
      }
      if (!regime || !Object.values(TaxRegime).includes(regime)) {
        return res.status(400).json({ error: `tax_regime inválido. Use: ${Object.values(TaxRegime).join(', ')}` });
      }

      const dto: ProjecaoReformaDTO = {
        company_id: companyId,
        regime,
        ano_inicio: anoInicio,
        ano_fim: anoFim,
        revenues: req.body.revenues,
        period_start: req.body.period_start,
        period_end: req.body.period_end,
      };

      const cacheKey = CacheKeys.reformaProjecao(companyId, regime, anoInicio, anoFim, dto.revenues);
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }

      const result = await ReformaTributariaService.projetar(dto);
      await cacheService.set(cacheKey, result, TTL_CONFIG.TAXES);

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Reforma projecao error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/taxes/reforma/appraisal
   * Calcula e persiste CBS/IBS de um ano em tax_calculations
   * Body: { ano, tax_regime, period_start, period_end, revenues? }
   */
  static async appraisalReforma(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const ano = Number(req.body.ano);
      const regime = req.body.tax_regime as TaxRegime;
      const periodStart = req.body.period_start;
      const periodEnd = req.body.period_end;

      if (!ano || !regime || !periodStart || !periodEnd) {
        return res.status(400).json({ error: 'ano, tax_regime, period_start e period_end são obrigatórios' });
      }

      const result = await ReformaTributariaService.calculate({
        company_id: companyId,
        ano,
        regime,
        period_start: periodStart,
        period_end: periodEnd,
        revenues: req.body.revenues,
      });

      if (!result.applicable) {
        return res.status(422).json({ error: result.motivo_nao_aplicavel });
      }

      const saved = await ReformaTributariaService.save(result, companyId, periodStart, periodEnd);

      const invalidatedCount = await cacheService.invalidateTaxes(companyId);
      logger.info('Cache invalidated after reforma appraisal save', { companyId, invalidatedKeys: invalidatedCount });

      return res.status(201).json({ calculation: result, saved });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      logger.error('Reforma appraisal error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * PUT /companies/:companyId/taxes/reforma/aliquotas
   * Cadastra/atualiza a alíquota de CBS/IBS/IS de um ano-calendário.
   * Endpoint restrito a admin (authorize('admin') na rota) — mecanismo de
   * atualização sem deploy, já que o governo publica as alíquotas anualmente.
   * Body: { ano, tax_type, aliquota, natureza, aplicavel_simples?, fonte_legal? }
   */
  static async upsertAliquotaReforma(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const ano = Number(req.body.ano);
      const taxType = req.body.tax_type as ReformaTaxType;
      const aliquota = Number(req.body.aliquota);
      const natureza = req.body.natureza as RateNature;

      if (!ano || !Number.isInteger(ano)) {
        return res.status(400).json({ error: 'ano é obrigatório' });
      }
      if (!Object.values(ReformaTaxType).includes(taxType)) {
        return res.status(400).json({ error: `tax_type inválido. Use: ${Object.values(ReformaTaxType).join(', ')}` });
      }
      if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 1) {
        return res.status(400).json({ error: 'aliquota deve ser um número entre 0 e 1 (ex.: 0.009 = 0,9%)' });
      }
      if (!Object.values(RateNature).includes(natureza)) {
        return res.status(400).json({ error: `natureza inválida. Use: ${Object.values(RateNature).join(', ')}` });
      }

      const saved = await ReformaTributariaService.upsertAliquota({
        ano,
        tax_type: taxType,
        aliquota,
        natureza,
        aplicavel_simples: req.body.aplicavel_simples,
        fonte_legal: req.body.fonte_legal,
        vigencia_inicio: req.body.vigencia_inicio,
        vigencia_fim: req.body.vigencia_fim,
      });

      return res.status(200).json(saved);
    } catch (err) {
      logger.error('Reforma upsert aliquota error', { error: (err as Error).message });
      return next(err);
    }
  }
}
