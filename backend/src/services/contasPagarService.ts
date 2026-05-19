import { getDatabase } from '../config/database';
import {
  ContaPagar,
  ContaPagarResponse,
  CreateContaPagarDTO,
  DeleteContaPagarResponse,
  EstatisticasContasPagar,
  FiltrosContaPagar,
  PaginatedContasPagarResponse,
  RegistrarPagamentoDTO,
  StatusContaPagar,
  UpdateContaPagarDTO,
} from '../models/tipos/ContaPagarTypes';

export class ContasPagarService {
  static async create(companyId: string, userId: string, data: CreateContaPagarDTO): Promise<ContaPagarResponse> {
    const db = await getDatabase();

    try {
      const existing = await db('contas_pagar')
        .where({ company_id: companyId, numero_titulo: data.numero_titulo, is_active: true })
        .first();

      if (existing) {
        return { success: false, data: null, message: 'Já existe um título com esse número para a empresa' };
      }

      if (new Date(data.data_vencimento) < new Date(data.data_emissao)) {
        return { success: false, data: null, message: 'Data de vencimento não pode ser anterior à emissão' };
      }

      const insertPayload = {
        company_id: companyId,
        created_by: userId,
        documento_fiscal_id: data.documento_fiscal_id || null,
        categoria: data.categoria,
        numero_titulo: data.numero_titulo,
        descricao: data.descricao,
        fornecedor_nome: data.fornecedor_nome,
        fornecedor_cnpj: this.normalizarCnpj(data.fornecedor_cnpj),
        fornecedor_email: data.fornecedor_email || null,
        fornecedor_telefone: data.fornecedor_telefone || null,
        data_emissao: new Date(data.data_emissao),
        data_vencimento: new Date(data.data_vencimento),
        valor_original: data.valor_original,
        valor_pago: 0,
        juros: data.juros || 0,
        multa: data.multa || 0,
        desconto: data.desconto || 0,
        status: StatusContaPagar.PENDENTE,
        observacoes: data.observacoes || null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const inserted = await db('contas_pagar').insert(insertPayload).returning('id');
      const contaId = typeof inserted[0] === 'object' ? inserted[0].id : inserted[0];
      const conta = await this.getById(companyId, contaId);
      return { success: true, data: conta, message: 'Conta a pagar criada com sucesso' };
    } catch (error) {
      return { success: false, data: null, message: `Erro ao criar conta a pagar: ${(error as Error).message}` };
    }
  }

  static async list(companyId: string, filters?: FiltrosContaPagar): Promise<PaginatedContasPagarResponse> {
    const db = await getDatabase();

    try {
      const limit = Math.min(filters?.limit || 20, 100);
      const page = Math.max(filters?.page || 1, 1);
      const offset = (page - 1) * limit;
      const sortBy = filters?.sort_by || 'data_vencimento';
      const sortOrder = filters?.sort_order || 'asc';

      let query = db('contas_pagar').where({ company_id: companyId, is_active: true });

      if (filters?.categoria) query = query.where('categoria', filters.categoria);
      if (filters?.status) query = query.where('status', filters.status);
      if (filters?.fornecedor_cnpj) query = query.where('fornecedor_cnpj', this.normalizarCnpj(filters.fornecedor_cnpj));
      if (filters?.fornecedor_nome) query = query.whereRaw('LOWER(fornecedor_nome) LIKE LOWER(?)', [`%${filters.fornecedor_nome}%`]);
      if (filters?.data_vencimento_de) query = query.where('data_vencimento', '>=', new Date(filters.data_vencimento_de));
      if (filters?.data_vencimento_ate) query = query.where('data_vencimento', '<=', new Date(filters.data_vencimento_ate));
      if (filters?.valor_minimo) query = query.where('valor_original', '>=', filters.valor_minimo);
      if (filters?.valor_maximo) query = query.where('valor_original', '<=', filters.valor_maximo);
      if (filters?.somente_atrasadas) {
        query = query.whereIn('status', [StatusContaPagar.PENDENTE, StatusContaPagar.PARCIAL, StatusContaPagar.VENCIDO])
          .andWhere('data_vencimento', '<', new Date());
      }

      const countResult = await query.clone().count('id as total').first() as any;
      const total = parseInt(countResult?.total || 0, 10);

      const rows = await query.orderBy(sortBy, sortOrder).limit(limit).offset(offset).select();
      const contas = await Promise.all(rows.map((row) => this.enriquecerConta(row as ContaPagar)));

      return {
        success: true,
        data: contas,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        message: `${total} conta(s) encontrada(s)`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        message: `Erro ao listar contas a pagar: ${(error as Error).message}`,
      };
    }
  }

  static async getById(companyId: string, contaId: string): Promise<ContaPagar | null> {
    const db = await getDatabase();
    try {
      const conta = await db('contas_pagar').where({ id: contaId, company_id: companyId, is_active: true }).first();
      if (!conta) return null;

      const pagamentos = await db('pagamentos_contas_pagar')
        .where('conta_pagar_id', contaId)
        .orderBy('data_pagamento', 'desc');

      const enriquecida = await this.enriquecerConta({ ...conta, pagamentos } as ContaPagar);
      return { ...enriquecida, pagamentos };
    } catch {
      return null;
    }
  }

  static async update(companyId: string, contaId: string, userId: string, data: UpdateContaPagarDTO): Promise<ContaPagarResponse> {
    const db = await getDatabase();
    try {
      const contaAtual = await this.getById(companyId, contaId);
      if (!contaAtual) return { success: false, data: null, message: 'Conta a pagar não encontrada' };
      if (contaAtual.status === StatusContaPagar.PAGO || contaAtual.status === StatusContaPagar.CANCELADO) {
        return { success: false, data: null, message: 'Contas pagas ou canceladas não podem ser alteradas' };
      }

      const patch: Record<string, unknown> = {
        updated_by: userId,
        updated_at: new Date(),
      };

      if (data.categoria !== undefined) patch.categoria = data.categoria;
      if (data.numero_titulo !== undefined) patch.numero_titulo = data.numero_titulo;
      if (data.descricao !== undefined) patch.descricao = data.descricao;
      if (data.fornecedor_nome !== undefined) patch.fornecedor_nome = data.fornecedor_nome;
      if (data.fornecedor_cnpj !== undefined) patch.fornecedor_cnpj = this.normalizarCnpj(data.fornecedor_cnpj);
      if (data.fornecedor_email !== undefined) patch.fornecedor_email = data.fornecedor_email || null;
      if (data.fornecedor_telefone !== undefined) patch.fornecedor_telefone = data.fornecedor_telefone || null;
      if (data.data_emissao !== undefined) patch.data_emissao = new Date(data.data_emissao);
      if (data.data_vencimento !== undefined) patch.data_vencimento = new Date(data.data_vencimento);
      if (data.valor_original !== undefined) patch.valor_original = data.valor_original;
      if (data.juros !== undefined) patch.juros = data.juros;
      if (data.multa !== undefined) patch.multa = data.multa;
      if (data.desconto !== undefined) patch.desconto = data.desconto;
      if (data.observacoes !== undefined) patch.observacoes = data.observacoes || null;

      await db('contas_pagar').where({ id: contaId, company_id: companyId }).update(patch);
      const conta = await this.getById(companyId, contaId);
      return { success: true, data: conta, message: 'Conta a pagar atualizada com sucesso' };
    } catch (error) {
      return { success: false, data: null, message: `Erro ao atualizar conta a pagar: ${(error as Error).message}` };
    }
  }

  static async registrarPagamento(companyId: string, contaId: string, userId: string, data: RegistrarPagamentoDTO): Promise<ContaPagarResponse> {
    const db = await getDatabase();
    const trx = await db.transaction();
    try {
      const conta = await trx('contas_pagar').where({ id: contaId, company_id: companyId, is_active: true }).first();
      if (!conta) {
        await trx.rollback();
        return { success: false, data: null, message: 'Conta a pagar não encontrada' };
      }
      if (conta.status === StatusContaPagar.CANCELADO) {
        await trx.rollback();
        return { success: false, data: null, message: 'Conta cancelada não pode receber pagamentos' };
      }

      await trx('pagamentos_contas_pagar').insert({
        conta_pagar_id: contaId,
        data_pagamento: new Date(data.data_pagamento),
        valor_pago: data.valor_pago,
        juros: data.juros || 0,
        multa: data.multa || 0,
        desconto: data.desconto || 0,
        forma_pagamento: data.forma_pagamento,
        observacoes: data.observacoes || null,
        created_at: new Date(),
        created_by: userId,
      });

      const totalPagamentos = await trx('pagamentos_contas_pagar')
        .where('conta_pagar_id', contaId)
        .sum('valor_pago as total')
        .first() as any;

      const valorPago = Number(totalPagamentos?.total || 0);
      const valorOriginal = Number(conta.valor_original);
      const status = valorPago >= valorOriginal ? StatusContaPagar.PAGO : StatusContaPagar.PARCIAL;

      await trx('contas_pagar').where({ id: contaId }).update({
        valor_pago: valorPago,
        status,
        updated_by: userId,
        updated_at: new Date(),
      });

      await trx.commit();
      const atualizada = await this.getById(companyId, contaId);
      return { success: true, data: atualizada, message: 'Pagamento registrado com sucesso' };
    } catch (error) {
      await trx.rollback();
      return { success: false, data: null, message: `Erro ao registrar pagamento: ${(error as Error).message}` };
    }
  }

  static async cancelar(companyId: string, contaId: string, userId: string): Promise<DeleteContaPagarResponse> {
    const db = await getDatabase();
    try {
      const conta = await this.getById(companyId, contaId);
      if (!conta) return { success: false, data: null, message: 'Conta a pagar não encontrada' };

      await db('contas_pagar').where({ id: contaId, company_id: companyId }).update({
        status: StatusContaPagar.CANCELADO,
        is_active: false,
        updated_by: userId,
        updated_at: new Date(),
      });

      return { success: true, data: { id: contaId }, message: 'Conta a pagar cancelada' };
    } catch (error) {
      return { success: false, data: null, message: `Erro ao cancelar conta a pagar: ${(error as Error).message}` };
    }
  }

  static async getEstatisticas(companyId: string): Promise<EstatisticasContasPagar> {
    const db = await getDatabase();
    const hoje = new Date();
    const addDays = (days: number) => new Date(hoje.getTime() + days * 24 * 60 * 60 * 1000);

    const rows = await db('contas_pagar').where({ company_id: companyId, is_active: true }).select();
    const contas = await Promise.all(rows.map((row) => this.enriquecerConta(row as ContaPagar)));

    const porStatus = contas.reduce<Record<string, { quantidade: number; valor: number }>>((acc, conta) => {
      const key = conta.status;
      if (!acc[key]) acc[key] = { quantidade: 0, valor: 0 };
      acc[key].quantidade += 1;
      acc[key].valor += Number(conta.saldo_aberto || 0);
      return acc;
    }, {});

    const totalAberto = contas.reduce((sum, conta) => sum + Number(conta.saldo_aberto || 0), 0);
    const totalPago = contas.reduce((sum, conta) => sum + Number(conta.valor_pago || 0), 0);
    const totalVencido = contas.filter((conta) => Number(conta.dias_atraso || 0) > 0 && conta.status !== StatusContaPagar.PAGO).reduce((sum, conta) => sum + Number(conta.saldo_aberto || 0), 0);

    const proximos = (dias: number) => contas
      .filter((conta) => conta.status !== StatusContaPagar.PAGO && conta.status !== StatusContaPagar.CANCELADO)
      .filter((conta) => {
        const venc = new Date(conta.data_vencimento);
        return venc >= hoje && venc <= addDays(dias);
      })
      .reduce((sum, conta) => sum + Number(conta.saldo_aberto || 0), 0);

    return {
      total_titulos: contas.length,
      total_aberto: totalAberto,
      total_pago: totalPago,
      total_vencido: totalVencido,
      proximos_7_dias: proximos(7),
      proximos_14_dias: proximos(14),
      proximos_30_dias: proximos(30),
      por_status: porStatus,
    };
  }

  private static async enriquecerConta(conta: ContaPagar): Promise<ContaPagar> {
    const saldoAberto = Number(conta.valor_original || 0) - Number(conta.valor_pago || 0);
    const hoje = new Date();
    const vencimento = new Date(conta.data_vencimento);
    const diasAtraso = saldoAberto > 0 && vencimento < hoje ? Math.floor((hoje.getTime() - vencimento.getTime()) / (24 * 60 * 60 * 1000)) : 0;
    const status = this.statusDerivado(conta.status, saldoAberto, diasAtraso);
    return { ...conta, saldo_aberto: saldoAberto, dias_atraso: diasAtraso, status };
  }

  private static statusDerivado(status: string, saldoAberto: number, diasAtraso: number): StatusContaPagar {
    if (status === StatusContaPagar.CANCELADO) return StatusContaPagar.CANCELADO;
    if (saldoAberto <= 0) return StatusContaPagar.PAGO;
    if (diasAtraso > 0) return status === StatusContaPagar.PARCIAL ? StatusContaPagar.PARCIAL : StatusContaPagar.VENCIDO;
    if (status === StatusContaPagar.PARCIAL) return StatusContaPagar.PARCIAL;
    return StatusContaPagar.PENDENTE;
  }

  private static normalizarCnpj(cnpj?: string): string | null {
    if (!cnpj) return null;
    const clean = cnpj.replace(/\D/g, '');
    return clean || null;
  }
}