import { Request, Response } from 'express';
import { FiscalCaptureService } from '../services/fiscalCaptureService';
import { logger } from '../middleware/requestLogger';

export class FiscalCaptureController {
  static async uploadCertificate(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.params.companyId;
      const file = req.file;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'companyId obrigatório' });
        return;
      }

      if (!file) {
        res.status(400).json({ success: false, error: 'Arquivo .pfx obrigatório' });
        return;
      }

      const { cnpj, uf, password, serpro_motor, cert_valid_until } = req.body;
      const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
      if (!cnpjDigits || cnpjDigits.length !== 14) {
        res.status(400).json({
          success: false,
          error: 'CNPJ inválido — informe os 14 dígitos da empresa (não use e-mail de login)',
        });
        return;
      }
      if (!uf || !password) {
        res.status(400).json({
          success: false,
          error: 'Campos obrigatórios: uf e senha do certificado',
        });
        return;
      }

      const saved = await FiscalCaptureService.upsertCertificate(companyId, {
        cnpj: cnpjDigits,
        uf,
        password,
        pfxBuffer: file.buffer,
        serproMotor: serpro_motor === true || serpro_motor === 'true',
        certValidUntil: cert_valid_until || null,
      });

      logger.info('Certificado fiscal A1 cadastrado', { companyId, cnpj: saved.cnpj });
      res.status(201).json({ success: true, data: saved });
    } catch (error) {
      const e = error as Error & { status?: number };
      const message = e.message;
      logger.error('Erro ao cadastrar certificado fiscal', { error: message });
      if (e.status && e.status < 500) {
        res.status(e.status).json({ success: false, error: message });
        return;
      }
      res.status(500).json({
        success: false,
        error: message.includes('EACCES') || message.includes('permission denied')
          ? 'Servidor sem permissão para gravar o certificado. Tente novamente após o próximo deploy.'
          : `Erro ao salvar certificado A1: ${message}`,
      });
    }
  }

  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.params.companyId;
      const status = await FiscalCaptureService.getStatus(companyId);
      res.json({ success: true, data: status });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  static async listCaptures(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.params.companyId;
      const page = Number(req.query.page || 1);
      const limit = Math.min(Number(req.query.limit || 20), 100);
      const data = await FiscalCaptureService.listCaptures(companyId, page, limit);
      res.json({ success: true, ...data });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  static async sync(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.params.companyId;
      const tipo = (req.body?.tipo || 'all') as 'nfe' | 'nfse' | 'all';
      const result = await FiscalCaptureService.runSync(companyId, tipo);

      if (!result.success) {
        res.status(502).json({ success: false, ...result });
        return;
      }

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  static async reprocess(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.params.companyId;
      const result = await FiscalCaptureService.runReprocess(companyId);

      if (!result.success) {
        res.status(502).json({ success: false, ...result });
        return;
      }

      logger.info('Reprocessamento de capturas fiscais concluído', { companyId });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
}
