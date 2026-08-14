/**
 * NF-e Controller
 * CRUD + ciclo de vida da Nota Fiscal Eletrônica
 */

import { Request, Response, NextFunction } from 'express';
import { NfeService } from '../services/nfeService';
import { DanfeService } from '../services/danfeService';
import { NfeStatus, NfeListFilters } from '../models/dtos/nfeDTO';
import { logger } from '../middleware/requestLogger';

export class NfeController {

  /** POST /companies/:companyId/nfe — Criar NF-e (rascunho) */
  static async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId } = req.params;
      const nfe = await NfeService.create(companyId, req.body);
      return res.status(201).json(nfe);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      logger.error('NF-e create error', { error: (err as Error).message });
      return next(err);
    }
  }

  /** POST /companies/:companyId/nfe/verificar-numeracao — Valida número/série (local + SEFAZ) */
  static async verificarNumeracao(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { companyId } = req.params;
      const serie = Number(req.body?.serie ?? 1);
      const numero = Number(req.body?.numero);
      const modelo = req.body?.modelo != null ? Number(req.body.modelo) : 55;
      if (!Number.isFinite(numero)) {
        return res.status(400).json({ error: 'Informe o número da NF-e.' });
      }
      const result = await NfeService.verificarNumeracao(companyId, {
        serie,
        numero,
        modelo,
      });
      return res.status(200).json(result);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      logger.error('NF-e verificar numeração error', { error: (err as Error).message });
      return next(err);
    }
  }

  /** GET /companies/:companyId/nfe — Listar NF-e */
  static async list(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId } = req.params;
      const filters: NfeListFilters = {
        status:   req.query.status as NfeStatus | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo:   req.query.dateTo as string | undefined,
        page:     req.query.page   ? parseInt(req.query.page as string)  : undefined,
        limit:    req.query.limit  ? parseInt(req.query.limit as string) : undefined,
      };
      const result = await NfeService.list(companyId, filters);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  }

  /** GET /companies/:companyId/nfe/:id — Buscar NF-e por ID (com itens) */
  static async get(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      const nfe = await NfeService.get(id, companyId);
      return res.status(200).json(nfe);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      return next(err);
    }
  }

  /** POST /companies/:companyId/nfe/:id/autorizar — Autorizar junto ao SEFAZ */
  static async authorize(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      const { contingencia } = (req.body ?? {}) as { contingencia?: string };
      if (contingencia !== undefined) {
        const texto = String(contingencia).trim();
        if (texto.length < 20 || texto.length > 256) {
          return res.status(422).json({
            error: 'A justificativa da contingência deve ter de 20 a 256 caracteres.',
          });
        }
      }
      const nfe = await NfeService.authorize(id, companyId, contingencia);
      return res.status(200).json(nfe);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      logger.error('NF-e authorize error', { error: (err as Error).message });
      return next(err);
    }
  }

  /** POST /companies/:companyId/nfe/:id/cancelar — Cancelar NF-e autorizada */
  static async cancel(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      const { justificativa } = req.body as { justificativa?: string };
      if (!justificativa) {
        return res.status(400).json({ error: 'Campo "justificativa" é obrigatório' });
      }
      const nfe = await NfeService.cancel(id, companyId, justificativa);
      return res.status(200).json(nfe);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      logger.error('NF-e cancel error', { error: (err as Error).message });
      return next(err);
    }
  }

  /** GET /companies/:companyId/nfe/:id/xml — Download do XML */
  static async getXml(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      const xml = await NfeService.getXml(id, companyId);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nfe-${id}.xml"`);
      return res.status(200).send(xml);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      return next(err);
    }
  }

  /**
   * GET /companies/:companyId/nfe/:id/danfe — DANFE em PDF.
   *
   * Responde o PDF inline (e não como attachment) porque o uso normal é abrir,
   * conferir e imprimir; o navegador ainda permite salvar. O nome do arquivo
   * leva a chave de acesso, que é como o documento é identificado depois.
   */
  static async getDanfe(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      const { pdf, nomeArquivo } = await DanfeService.gerar(id, companyId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
      res.setHeader('Content-Length', String(pdf.length));
      return res.status(200).end(pdf);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      logger.error('DANFE error', { error: (err as Error).message });
      return next(err);
    }
  }
}
