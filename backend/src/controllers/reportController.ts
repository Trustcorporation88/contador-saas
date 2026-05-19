/**
 * Report Controller
 * HTTP handlers para demonstrações financeiras
 * Balanço Patrimonial, DRE, Balancete, Livro Razão
 */

import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService';
import { logger } from '../middleware/requestLogger';

export class ReportController {

  static async clientMonthlySummary(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const period = (req.query.period as string | undefined) ?? new Date().toISOString().slice(0, 7);

      const report = await ReportService.getClientMonthlySummary(companyId, period);
      return res.status(200).json(report);
    } catch (err) {
      logger.error('Error generating client monthly summary', { error: (err as Error).message });
      return next(err);
    }
  }

  static async clientAnnualSummary(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const queryYear = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const year = Number.isFinite(queryYear) ? queryYear : new Date().getFullYear();

      const report = await ReportService.getClientAnnualSummary(companyId, year);
      return res.status(200).json(report);
    } catch (err) {
      logger.error('Error generating client annual summary', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/balance-sheet
   * Balanço Patrimonial (Lei 6.404/76 Art. 178-186)
   * Query: date_to (YYYY-MM-DD, default = hoje)
   */
  static async balanceSheet(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dateTo = req.query.date_to as string | undefined;

      const report = await ReportService.getBalanceSheet(companyId, dateTo);
      return res.status(200).json(report);
    } catch (err) {
      logger.error('Error generating balance sheet', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/income-statement
   * DRE - Demonstração do Resultado do Exercício (Lei 6.404/76 Art. 187)
   * Query: date_from, date_to (obrigatórios, YYYY-MM-DD)
   */
  static async incomeStatement(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'date_from e date_to são obrigatórios (YYYY-MM-DD)' });
      }

      const report = await ReportService.getIncomeStatement(companyId, dateFrom, dateTo);
      return res.status(200).json(report);
    } catch (err) {
      logger.error('Error generating income statement', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/executive-summary
   * Resumo executivo do período para fluxo de caixa e relatórios básicos
   */
  static async executiveSummary(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'date_from e date_to são obrigatórios (YYYY-MM-DD)' });
      }

      const report = await ReportService.getExecutiveSummary(companyId, dateFrom, dateTo);
      return res.status(200).json(report);
    } catch (err) {
      logger.error('Error generating executive summary', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/cash-flow-summary
   * Série mensal de receitas, despesas e resultado
   */
  static async cashFlowSummary(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const months = req.query.months ? Number(req.query.months) : 12;

      const report = await ReportService.getCashFlowSummary(companyId, months);
      return res.status(200).json(report);
    } catch (err) {
      logger.error('Error generating cash flow summary', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/trial-balance
   * Balancete de Verificação
   * Query: date_from, date_to (opcionais, YYYY-MM-DD)
   */
  static async trialBalance(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dateFrom = req.query.date_from as string | undefined;
      const dateTo = req.query.date_to as string | undefined;

      const report = await ReportService.getTrialBalance(companyId, dateFrom, dateTo);
      return res.status(200).json(report);
    } catch (err) {
      logger.error('Error generating trial balance', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/ledger/:accountId
   * Livro Razão por conta contábil
   * Query: date_from, date_to (opcionais, YYYY-MM-DD)
   */
  static async ledger(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, accountId } = req.params;
      const dateFrom = req.query.date_from as string | undefined;
      const dateTo = req.query.date_to as string | undefined;

      const report = await ReportService.getLedger(companyId, accountId, dateFrom, dateTo);
      return res.status(200).json(report);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Error generating ledger', { error: error.message });
      return next(err);
    }
  }
}
