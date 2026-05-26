/**
 * NF-e OCR Controller
 * Endpoints para upload, extração, preview e confirmação de NF-e via OCR
 */

import { Request, Response, NextFunction } from 'express';
import { NfeOcrService } from '../services/nfeOcrService';
import { logger } from '../middleware/requestLogger';

export class NfeOcrController {

  /**
   * POST /companies/:companyId/nfe/ocr/upload
   * Upload de PDF/Imagem de NF-e para extração automática
   */
  static async upload(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId } = req.params;
      
      // Validate file upload
      if (!req.file) {
        return res.status(400).json({ 
          error: 'Arquivo não fornecido',
          details: 'Faça upload de um PDF ou imagem de NF-e'
        });
      }

      // Validate file type
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: 'Tipo de arquivo inválido',
          details: 'Apenas PDF, JPEG, PNG e TIFF são aceitos',
        });
      }

      // Validate file size (max 50MB)
      if (req.file.size > 50 * 1024 * 1024) {
        return res.status(400).json({
          error: 'Arquivo muito grande',
          details: 'Tamanho máximo: 50MB',
        });
      }

      logger.info('NF-e OCR upload started', {
        companyId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });

      // Process upload
      const result = await NfeOcrService.processUpload(companyId, req.file);

      return res.status(201).json(result);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) {
        logger.warn('NF-e OCR upload client error', { error: e.message });
        return res.status(e.status).json({ error: e.message });
      }
      logger.error('NF-e OCR upload error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/nfe/ocr/:uploadId/preview
   * Gera preview de lançamento contábil baseado em OCR
   */
  static async getPreview(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, uploadId } = req.params;

      logger.info('Generating journal entry preview', { companyId, uploadId });

      const preview = await NfeOcrService.generateJournalEntryPreview(uploadId, companyId);

      return res.status(200).json(preview);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) {
        logger.warn('NF-e OCR preview error', { error: e.message });
        return res.status(e.status).json({ error: e.message });
      }
      logger.error('NF-e OCR preview error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * POST /companies/:companyId/nfe/ocr/:uploadId/confirm
   * Confirma OCR e cria lançamento contábil
   */
  static async confirm(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, uploadId } = req.params;
      const { adjustments, labels } = req.body;

      logger.info('Confirming NF-e OCR and creating journal entry', {
        companyId,
        uploadId,
        hasAdjustments: !!adjustments,
      });

      const result = await NfeOcrService.confirmAndCreateEntry(
        uploadId,
        companyId,
        adjustments,
        labels
      );

      return res.status(201).json({
        ...result,
        message: 'Lançamento contábil criado com sucesso',
      });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) {
        logger.warn('NF-e OCR confirm error', { error: e.message });
        return res.status(e.status).json({ error: e.message });
      }
      logger.error('NF-e OCR confirm error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/nfe/ocr/:invoiceKey/validate
   * Valida NF-e key com SEFAZ
   */
  static async validate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, invoiceKey } = req.params;

      // Validate invoice key format (basic)
      if (!invoiceKey || invoiceKey.length !== 44) {
        return res.status(400).json({
          error: 'Chave de acesso inválida',
          details: 'A chave deve ter exatamente 44 dígitos',
        });
      }

      if (!/^\d{44}$/.test(invoiceKey)) {
        return res.status(400).json({
          error: 'Chave de acesso inválida',
          details: 'A chave deve conter apenas dígitos',
        });
      }

      logger.info('Validating NF-e key with SEFAZ', { invoiceKey });

      const result = await NfeOcrService.validateWithSefaz(invoiceKey);

      return res.status(200).json(result);
    } catch (err: unknown) {
      logger.error('NF-e SEFAZ validation error', { error: (err as Error).message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/nfe/ocr/:uploadId
   * Obter dados de upload OCR
   */
  static async getUpload(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, uploadId } = req.params;

      const upload = await NfeOcrService.getUpload(uploadId, companyId);

      return res.status(200).json(upload);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) {
        return res.status(e.status).json({ error: e.message });
      }
      return next(err);
    }
  }
}
