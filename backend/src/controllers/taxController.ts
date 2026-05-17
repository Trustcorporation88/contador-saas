/**
 * Tax Controller
 * Endpoints de apuração e gestão de impostos
 */

import { Request, Response, NextFunction } from 'express';
import { TaxCalculationService } from '../services/taxCalculationService';
import { TaxRegime, TaxStatus, TaxType, CalculateTaxDTO } from '../models/dtos/taxDTO';
import { logger } from '../middleware/requestLogger';

export class TaxController {

  /**
   * POST /companies/:companyId/taxes/calculate
   * Calcula impostos do período sem salvar
   * Body: CalculateTaxDTO
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

      const result = await TaxCalculationService.calculate(dto);
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
   */
  static async listAppraisals(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const rows = await TaxCalculationService.list(companyId, {
        tax_type:     req.query.tax_type as TaxType | undefined,
        status:       req.query.status as TaxStatus | undefined,
        period_start: req.query.period_start as string | undefined,
        period_end:   req.query.period_end as string | undefined,
      });
      return res.status(200).json({ data: rows, total: rows.length });
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
