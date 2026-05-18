import { Request, Response } from 'express';
import { ContasReceberService } from '../services/contasReceberService';
import { CreateContaReceberDTO, FiltrosContaReceber, RegistrarRecebimentoDTO } from '../models/tipos/ContaReceberTypes';

export class ContasReceberController {
  static async criar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.id;
      if (!companyId || !userId) {
        res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const data = req.body as CreateContaReceberDTO;
      if (!data.categoria || !data.numero_titulo || !data.descricao || !data.cliente_nome || !data.data_emissao || !data.data_vencimento || !data.valor_original) {
        res.status(400).json({ success: false, error: 'Campos obrigatórios: categoria, numero_titulo, descricao, cliente_nome, data_emissao, data_vencimento, valor_original', code: 'VALIDATION_ERROR' });
        return;
      }

      const resultado = await ContasReceberService.create(companyId, userId, data);
      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      res.status(201).json(resultado);
    } catch {
      res.status(500).json({ success: false, error: 'Erro ao criar conta a receber', code: 'INTERNAL_ERROR' });
    }
  }

  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const filters: FiltrosContaReceber = {
        categoria: req.query.categoria as any,
        status: req.query.status as any,
        cliente_cnpj: req.query.cliente_cnpj as string,
        cliente_nome: req.query.cliente_nome as string,
        data_vencimento_de: req.query.data_vencimento_de as string,
        data_vencimento_ate: req.query.data_vencimento_ate as string,
        valor_minimo: req.query.valor_minimo ? Number(req.query.valor_minimo) : undefined,
        valor_maximo: req.query.valor_maximo ? Number(req.query.valor_maximo) : undefined,
        somente_atrasadas: req.query.somente_atrasadas === 'true',
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sort_by: req.query.sort_by as any,
        sort_order: req.query.sort_order as any,
      };

      const resultado = await ContasReceberService.list(companyId, filters);
      res.json(resultado);
    } catch {
      res.status(500).json({ success: false, error: 'Erro ao listar contas a receber', code: 'INTERNAL_ERROR' });
    }
  }

  static async obter(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const conta = await ContasReceberService.getById(companyId, req.params.id);
      if (!conta) {
        res.status(404).json({ success: false, error: 'Conta a receber não encontrada', code: 'NOT_FOUND' });
        return;
      }

      res.json({ success: true, data: conta });
    } catch {
      res.status(500).json({ success: false, error: 'Erro ao obter conta a receber', code: 'INTERNAL_ERROR' });
    }
  }

  static async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.id;
      if (!companyId || !userId) {
        res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const resultado = await ContasReceberService.update(companyId, req.params.id, userId, req.body);
      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      res.json(resultado);
    } catch {
      res.status(500).json({ success: false, error: 'Erro ao atualizar conta a receber', code: 'INTERNAL_ERROR' });
    }
  }

  static async registrarRecebimento(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.id;
      if (!companyId || !userId) {
        res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const data = req.body as RegistrarRecebimentoDTO;
      if (!data.data_recebimento || !data.valor_recebido || !data.forma_recebimento) {
        res.status(400).json({ success: false, error: 'Campos obrigatórios: data_recebimento, valor_recebido, forma_recebimento', code: 'VALIDATION_ERROR' });
        return;
      }

      const resultado = await ContasReceberService.registrarRecebimento(companyId, req.params.id, userId, data);
      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      res.json(resultado);
    } catch {
      res.status(500).json({ success: false, error: 'Erro ao registrar recebimento', code: 'INTERNAL_ERROR' });
    }
  }

  static async cancelar(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.id;
      if (!companyId || !userId) {
        res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const resultado = await ContasReceberService.cancelar(companyId, req.params.id, userId);
      if (!resultado.success) {
        res.status(400).json(resultado);
        return;
      }

      res.json(resultado);
    } catch {
      res.status(500).json({ success: false, error: 'Erro ao cancelar conta a receber', code: 'INTERNAL_ERROR' });
    }
  }

  static async getEstatisticas(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const stats = await ContasReceberService.getEstatisticas(companyId);
      res.json({ success: true, data: stats });
    } catch {
      res.status(500).json({ success: false, error: 'Erro ao obter estatísticas', code: 'INTERNAL_ERROR' });
    }
  }
}