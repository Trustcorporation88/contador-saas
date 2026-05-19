import { Request, Response } from 'express';
import { ContasPagarService } from '../services/contasPagarService';
import { CreateContaPagarDTO, RegistrarPagamentoDTO, UpdateContaPagarDTO } from '../models/tipos/ContaPagarTypes';

export class ContasPagarController {
  static async criar(req: Request, res: Response): Promise<Response> {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    const payload = req.body as CreateContaPagarDTO;

    if (!companyId || !userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const result = await ContasPagarService.create(companyId, userId, payload);
    return res.status(result.success ? 201 : 400).json(result);
  }

  static async listar(req: Request, res: Response): Promise<Response> {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const result = await ContasPagarService.list(companyId, {
      categoria: req.query.categoria as any,
      status: req.query.status as any,
      fornecedor_cnpj: req.query.fornecedor_cnpj as string,
      fornecedor_nome: req.query.fornecedor_nome as string,
      data_vencimento_de: req.query.data_vencimento_de as string,
      data_vencimento_ate: req.query.data_vencimento_ate as string,
      valor_minimo: req.query.valor_minimo ? Number(req.query.valor_minimo) : undefined,
      valor_maximo: req.query.valor_maximo ? Number(req.query.valor_maximo) : undefined,
      somente_atrasadas: req.query.somente_atrasadas === 'true',
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      sort_by: req.query.sort_by as any,
      sort_order: req.query.sort_order as any,
    });

    return res.status(result.success ? 200 : 400).json(result);
  }

  static async obter(req: Request, res: Response): Promise<Response> {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const conta = await ContasPagarService.getById(companyId, req.params.id);
    if (!conta) {
      return res.status(404).json({ success: false, data: null, message: 'Conta a pagar não encontrada' });
    }

    return res.json({ success: true, data: conta });
  }

  static async atualizar(req: Request, res: Response): Promise<Response> {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    const payload = req.body as UpdateContaPagarDTO;

    if (!companyId || !userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const result = await ContasPagarService.update(companyId, userId ? req.params.id : req.params.id, userId, payload);
    return res.status(result.success ? 200 : 400).json(result);
  }

  static async registrarPagamento(req: Request, res: Response): Promise<Response> {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    const payload = req.body as RegistrarPagamentoDTO;

    if (!companyId || !userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const result = await ContasPagarService.registrarPagamento(companyId, req.params.id, userId, payload);
    return res.status(result.success ? 200 : 400).json(result);
  }

  static async cancelar(req: Request, res: Response): Promise<Response> {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;

    if (!companyId || !userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const result = await ContasPagarService.cancelar(companyId, req.params.id, userId);
    return res.status(result.success ? 200 : 400).json(result);
  }

  static async getEstatisticas(req: Request, res: Response): Promise<Response> {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const data = await ContasPagarService.getEstatisticas(companyId);
    return res.json({ success: true, data });
  }
}