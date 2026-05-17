/**
 * Export Controller
 * Endpoints de exportação de relatórios financeiros em xlsx e pdf
 *
 * GET /companies/:companyId/reports/balance-sheet/export?format=xlsx|pdf
 * GET /companies/:companyId/reports/income-statement/export?format=xlsx|pdf
 * GET /companies/:companyId/reports/trial-balance/export?format=xlsx|pdf
 * GET /companies/:companyId/reports/ledger/:accountId/export?format=xlsx|pdf
 */

import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService';
import {
  exportBalanceSheetToExcel,
  exportBalanceSheetToPdf,
  exportIncomeStatementToExcel,
  exportIncomeStatementToPdf,
  exportTrialBalanceToExcel,
  exportTrialBalanceToPdf,
  exportLedgerToExcel,
  exportLedgerToPdf,
} from '../services/exportService';
import { logger } from '../middleware/requestLogger';

type ExportFormat = 'xlsx' | 'pdf';

function getFormat(req: Request): ExportFormat {
  const fmt = (req.query.format as string ?? 'xlsx').toLowerCase();
  return fmt === 'pdf' ? 'pdf' : 'xlsx';
}

function setDownloadHeaders(res: Response, filename: string, format: ExportFormat): void {
  const contentType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.${ext}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store');
}

export class ExportController {

  /**
   * GET /companies/:companyId/reports/balance-sheet/export
   * Query: date_to (YYYY-MM-DD), format (xlsx|pdf)
   */
  static async balanceSheet(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dateTo = req.query.date_to as string | undefined;
      const format = getFormat(req);

      const report = await ReportService.getBalanceSheet(companyId, dateTo);
      setDownloadHeaders(res, `balanco-patrimonial-${dateTo ?? 'atual'}`, format);

      if (format === 'pdf') {
        const buf = exportBalanceSheetToPdf(report);
        return res.send(buf);
      }
      const buf = await exportBalanceSheetToExcel(report);
      return res.send(buf);
    } catch (err) {
      logger.error('Export balance sheet error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/income-statement/export
   * Query: date_from (obrigatório), date_to (obrigatório), format (xlsx|pdf)
   */
  static async incomeStatement(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const format = getFormat(req);

      if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'date_from e date_to são obrigatórios (YYYY-MM-DD)' });
      }

      const report = await ReportService.getIncomeStatement(companyId, dateFrom, dateTo);
      setDownloadHeaders(res, `dre-${dateFrom}-${dateTo}`, format);

      if (format === 'pdf') {
        const buf = exportIncomeStatementToPdf(report);
        return res.send(buf);
      }
      const buf = await exportIncomeStatementToExcel(report);
      return res.send(buf);
    } catch (err) {
      logger.error('Export income statement error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/trial-balance/export
   * Query: date_from (opcional), date_to (opcional), format (xlsx|pdf)
   */
  static async trialBalance(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const companyId = req.params.companyId;
      const dateFrom = req.query.date_from as string | undefined;
      const dateTo = req.query.date_to as string | undefined;
      const format = getFormat(req);

      const report = await ReportService.getTrialBalance(companyId, dateFrom, dateTo);
      setDownloadHeaders(res, `balancete-${dateTo ?? 'atual'}`, format);

      if (format === 'pdf') {
        const buf = exportTrialBalanceToPdf(report);
        return res.send(buf);
      }
      const buf = await exportTrialBalanceToExcel(report);
      return res.send(buf);
    } catch (err) {
      logger.error('Export trial balance error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/reports/ledger/:accountId/export
   * Query: date_from (opcional), date_to (opcional), format (xlsx|pdf)
   */
  static async ledger(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, accountId } = req.params;
      const dateFrom = req.query.date_from as string | undefined;
      const dateTo = req.query.date_to as string | undefined;
      const format = getFormat(req);

      const report = await ReportService.getLedger(companyId, accountId, dateFrom, dateTo);
      setDownloadHeaders(res, `razao-${report.account_code}-${dateTo ?? 'atual'}`, format);

      if (format === 'pdf') {
        const buf = exportLedgerToPdf(report);
        return res.send(buf);
      }
      const buf = await exportLedgerToExcel(report);
      return res.send(buf);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Export ledger error', { error: error.message });
      return next(err);
    }
  }
}
