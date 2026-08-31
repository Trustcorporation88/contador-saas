/**
 * Produto Controller: catálogo de produtos por empresa (busca + CRUD).
 */

import { Request, Response, NextFunction } from 'express';
import { ProdutoService } from '../services/produtoService';
import { logger } from '../middleware/requestLogger';

function responderErro(err: unknown, res: Response, next: NextFunction, contexto: string): Response | void {
  const e = err as Error & { status?: number };
  if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
  logger.error(contexto, { error: (err as Error).message });
  return next(err);
}

export class ProdutoController {

  /** GET /companies/:companyId/produtos/buscar?q=&limit= (autocomplete da emissão) */
  static async buscar(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId } = req.params;
      const data = await ProdutoService.buscar(companyId, {
        q:     typeof req.query.q === 'string' ? req.query.q : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      return res.status(200).json({ data });
    } catch (err) {
      return responderErro(err, res, next, 'Produto buscar error');
    }
  }

  /** GET /companies/:companyId/produtos?q=&page=&limit= (listagem paginada) */
  static async listar(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId } = req.params;
      const result = await ProdutoService.listar(companyId, {
        q:     typeof req.query.q === 'string' ? req.query.q : undefined,
        page:  req.query.page  ? parseInt(req.query.page as string, 10)  : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      return res.status(200).json(result);
    } catch (err) {
      return responderErro(err, res, next, 'Produto listar error');
    }
  }

  /** GET /companies/:companyId/produtos/:id */
  static async obter(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      return res.status(200).json(await ProdutoService.obter(companyId, id));
    } catch (err) {
      return responderErro(err, res, next, 'Produto obter error');
    }
  }

  /** POST /companies/:companyId/produtos */
  static async criar(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId } = req.params;
      return res.status(201).json(await ProdutoService.criar(companyId, req.body));
    } catch (err) {
      return responderErro(err, res, next, 'Produto criar error');
    }
  }

  /** PUT /companies/:companyId/produtos/:id */
  static async atualizar(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      return res.status(200).json(await ProdutoService.atualizar(companyId, id, req.body));
    } catch (err) {
      return responderErro(err, res, next, 'Produto atualizar error');
    }
  }

  /** DELETE /companies/:companyId/produtos/:id */
  static async remover(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { companyId, id } = req.params;
      await ProdutoService.remover(companyId, id);
      return res.status(204).end();
    } catch (err) {
      return responderErro(err, res, next, 'Produto remover error');
    }
  }
}
