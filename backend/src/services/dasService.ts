/**
 * DAS Service
 * Lógica de negócio para geração, cálculo e gerenciamento de boletos DAS
 * Integração com apuração de impostos (Simples Nacional)
 */

import { getDatabase } from '../config/database';
import { generateBarCode, generateLineNumber } from '../utils/barcodeGenerator';
import crypto from 'crypto';
import {
  CreateDASDTO,
  DASBoleto,
  DASResponse,
  PaginatedDASResponse,
  ListDASFilters,
  RegisterPaymentDTO,
  UpdateDASDTO,
  StatusDAS,
  TipoEventoDAS,
  GenerateDASFromTaxDTO,
  DASCalculationResult,
  AgendamentoDAS,
  UpdateAgendamentoDASDTO,
  CODIGO_RECEITA_POR_REGIME,
  VENCIMENTO_DIA_PADRAO,
} from '../models/dtos/dasDTO';

export class DASService {
  /**
   * Calcula a data de vencimento padrão (20º dia do mês seguinte)
   */
  static calcularDataVencimento(mes: number, ano: number): Date {
    const proximoMes = mes === 12 ? 1 : mes + 1;
    const proximoAno = mes === 12 ? ano + 1 : ano;
    return new Date(proximoAno, proximoMes - 1, VENCIMENTO_DIA_PADRAO);
  }

  /**
   * Calcula o DAS a partir de uma apuração de impostos (tax_calculation)
   * Integrado com TaxCalculationService
   */
  static async calcularDAS(
    companyId: string,
    mesFiscal: number,
    anoFiscal: number,
    regime: 'SIMPLES' | 'LUCRO_REAL' | 'LUCRO_PRESUMIDO',
  ): Promise<DASCalculationResult> {
    const db = await getDatabase();

    try {
      // Buscar apuração de impostos do mês
      const dataInicio = new Date(anoFiscal, mesFiscal - 1, 1);
      const dataFim = new Date(anoFiscal, mesFiscal, 0);

      const taxCalc = await db('tax_calculations')
        .where({
          company_id: companyId,
          tax_regime: regime,
        })
        .whereBetween('period_start', [dataInicio, dataFim])
        .orWhereBetween('period_end', [dataInicio, dataFim])
        .first();

      if (!taxCalc) {
        throw new Error(
          `Nenhuma apuração encontrada para ${mesFiscal}/${anoFiscal} em regime ${regime}`,
        );
      }

      const valorBase = parseFloat(taxCalc.total_tax) || 0;
      const dataVencimento = this.calcularDataVencimento(mesFiscal, anoFiscal);

      // Para o Simples Nacional, o valor já vem calculado
      const aliquota = taxCalc.effective_rate || 0;

      return {
        mes_competencia: mesFiscal,
        ano_competencia: anoFiscal,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        regime_tributario: regime,
        valor_base: valorBase,
        valor_total: valorBase,
        percentual_aliquota: aliquota * 100,
        observacoes: [
          `DAS gerado automaticamente da apuração de ${regime}`,
          `Vencimento: 20º dia do mês seguinte`,
        ],
      };
    } catch (error) {
      throw new Error(`Erro ao calcular DAS: ${(error as Error).message}`);
    }
  }

  /**
   * Gera um boleto DAS completo com código de barras e linha digitável
   */
  static async create(
    companyId: string,
    userId: string,
    data: CreateDASDTO,
  ): Promise<DASResponse> {
    const db = await getDatabase();

    try {
      // Validações
      if (data.mes_competencia < 1 || data.mes_competencia > 12) {
        return {
          success: false,
          data: null,
          message: 'Mês de competência inválido (1-12)',
        };
      }

      if (data.valor_original <= 0) {
        return {
          success: false,
          data: null,
          message: 'Valor original deve ser maior que zero',
        };
      }

      // Verificar se já existe DAS para o mês/ano
      const existing = await db('das_boletos')
        .where({
          company_id: companyId,
          mes_competencia: data.mes_competencia,
          ano_competencia: data.ano_competencia,
          regime_tributario: data.regime_tributario,
          is_active: true,
        })
        .whereIn('status', [StatusDAS.EMITIDO, StatusDAS.PENDENTE])
        .first();

      if (existing) {
        return {
          success: false,
          data: null,
          message: `Já existe um DAS ativo para ${data.mes_competencia}/${data.ano_competencia}`,
        };
      }

      // Calcular valores finais
      const juros = data.juros || 0;
      const multa = data.multa || 0;
      const desconto = data.desconto || 0;
      const valorTotal = data.valor_original + juros + multa - desconto;

      // Gerar data de emissão e vencimento
      const dataEmissao = new Date();
      const dataVencimento = this.calcularDataVencimento(
        data.mes_competencia,
        data.ano_competencia,
      );

      // Gerar código de barras (formato banco DAS)
      const numeroBoleto = this.gerarNumeroBoleto(
        companyId,
        data.mes_competencia,
        data.ano_competencia,
      );
      const codigoReceita = CODIGO_RECEITA_POR_REGIME[data.regime_tributario];
      const codigoBarras = generateBarCode(
        codigoReceita,
        numeroBoleto,
        valorTotal.toFixed(2),
        dataVencimento,
      );
      const linhaDigitavel = generateLineNumber(codigoBarras);

      // Hash de integridade (SHA-256)
      const hashIntegridade = this.gerarHashIntegridade({
        codigoReceita,
        numeroBoleto,
        valorTotal,
        dataVencimento: dataVencimento.toISOString(),
      });

      // Preparar payload para insert
      const insertPayload = {
        company_id: companyId,
        tax_calculation_id: data.tax_calculation_id || null,
        data_emissao: dataEmissao,
        data_vencimento: dataVencimento,
        mes_competencia: data.mes_competencia,
        ano_competencia: data.ano_competencia,
        valor_original: data.valor_original,
        juros,
        multa,
        desconto,
        valor_total: valorTotal,
        valor_pago: 0,
        status: StatusDAS.EMITIDO,
        codigo_receita: codigoReceita,
        numero_boleto: numeroBoleto,
        codigo_barras: codigoBarras,
        linha_digitavel: linhaDigitavel,
        regime_tributario: data.regime_tributario,
        observacoes: data.observacoes || null,
        created_by: userId,
        hash_integridade: hashIntegridade,
        created_at: dataEmissao,
        updated_at: dataEmissao,
        is_active: true,
      };

      const inserted = await db('das_boletos').insert(insertPayload).returning('id');
      const dasId = typeof inserted[0] === 'object' ? inserted[0].id : inserted[0];

      // Registrar evento de geração
      await this.registrarEvento(dasId, TipoEventoDAS.GERADO, userId, {
        regime: data.regime_tributario,
        valor: valorTotal,
      });

      const das = await this.getById(companyId, dasId);
      return {
        success: true,
        data: das!,
        message: 'DAS gerado com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `Erro ao criar DAS: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Lista boletos DAS com filtros e paginação
   */
  static async list(
    companyId: string,
    filters?: ListDASFilters,
  ): Promise<PaginatedDASResponse> {
    const db = await getDatabase();

    try {
      const limit = Math.min(filters?.limit || 20, 100);
      const page = Math.max(filters?.page || 1, 1);
      const offset = (page - 1) * limit;
      const sortBy = filters?.sort_by || 'data_vencimento';
      const sortOrder = filters?.sort_order || 'asc';

      let query = db('das_boletos')
        .where({ company_id: companyId, is_active: true });

      if (filters?.status) {
        query = query.where('status', filters.status);
      }
      if (filters?.regime_tributario) {
        query = query.where('regime_tributario', filters.regime_tributario);
      }
      if (filters?.mes_competencia) {
        query = query.where('mes_competencia', filters.mes_competencia);
      }
      if (filters?.ano_competencia) {
        query = query.where('ano_competencia', filters.ano_competencia);
      }
      if (filters?.data_vencimento_de) {
        query = query.where(
          'data_vencimento',
          '>=',
          new Date(filters.data_vencimento_de),
        );
      }
      if (filters?.data_vencimento_ate) {
        query = query.where(
          'data_vencimento',
          '<=',
          new Date(filters.data_vencimento_ate),
        );
      }
      if (filters?.somente_atrasadas) {
        query = query
          .where('data_vencimento', '<', new Date())
          .whereIn('status', [StatusDAS.EMITIDO, StatusDAS.PENDENTE, StatusDAS.VENCIDO]);
      }
      if (filters?.somente_nao_pagos) {
        query = query.whereIn('status', [
          StatusDAS.EMITIDO,
          StatusDAS.PENDENTE,
          StatusDAS.VENCIDO,
        ]);
      }

      const countResult = (await query
        .clone()
        .count('id as total')
        .first()) as any;
      const total = parseInt(countResult?.total || 0, 10);

      const rows = await query.orderBy(sortBy, sortOrder).limit(limit).offset(offset);

      return {
        success: true,
        data: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
    }
  }

  /**
   * Busca um DAS por ID
   */
  static async getById(companyId: string, dasId: string): Promise<DASBoleto | null> {
    const db = await getDatabase();

    try {
      const das = await db('das_boletos')
        .where({ id: dasId, company_id: companyId, is_active: true })
        .first();

      if (!das) return null;

      // Calcular valor devido
      return {
        ...das,
        valor_devido: das.valor_total - das.valor_pago,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Registra pagamento de um DAS
   */
  static async registrarPagamento(
    companyId: string,
    dasId: string,
    userId: string,
    data: RegisterPaymentDTO,
  ): Promise<DASResponse> {
    const db = await getDatabase();

    try {
      const das = await this.getById(companyId, dasId);
      if (!das) {
        return { success: false, data: null, message: 'DAS não encontrado' };
      }

      if (das.status === StatusDAS.PAGO) {
        return { success: false, data: null, message: 'DAS já foi pago' };
      }

      if (data.valor_pago > das.valor_total) {
        return {
          success: false,
          data: null,
          message: 'Valor pago não pode ser superior ao valor total',
        };
      }

      const dataPagamento = new Date(data.data_pagamento);
      const novoStatus =
        data.valor_pago >= das.valor_total ? StatusDAS.PAGO : StatusDAS.PENDENTE;
      const multa = Math.max(0, das.multa, data.multa_paga || 0);
      const juros = Math.max(0, das.juros, data.juros_pago || 0);

      // Atualizar DAS
      await db('das_boletos').where({ id: dasId }).update({
        status: novoStatus,
        valor_pago: data.valor_pago,
        data_pagamento: dataPagamento,
        juros_pago: data.juros_pago || null,
        multa_paga: data.multa_paga || null,
        numero_comprovante: data.numero_comprovante || null,
        updated_by: userId,
        updated_at: new Date(),
      });

      // Registrar evento
      await this.registrarEvento(dasId, TipoEventoDAS.PAGAMENTO_REGISTRADO, userId, {
        valor_pago: data.valor_pago,
        data_pagamento: data.data_pagamento,
        comprovante: data.numero_comprovante,
      });

      const dasAtualizado = await this.getById(companyId, dasId);
      return {
        success: true,
        data: dasAtualizado!,
        message: 'Pagamento registrado com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `Erro ao registrar pagamento: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Atualiza um DAS (juros, multa, desconto, observações)
   */
  static async update(
    companyId: string,
    dasId: string,
    userId: string,
    data: UpdateDASDTO,
  ): Promise<DASResponse> {
    const db = await getDatabase();

    try {
      const das = await this.getById(companyId, dasId);
      if (!das) {
        return { success: false, data: null, message: 'DAS não encontrado' };
      }

      if (das.status === StatusDAS.PAGO) {
        return { success: false, data: null, message: 'Não é possível alterar um DAS já pago' };
      }

      const dadosAnteriores = {
        juros: das.juros,
        multa: das.multa,
        desconto: das.desconto,
      };

      const juros = data.juros !== undefined ? data.juros : das.juros;
      const multa = data.multa !== undefined ? data.multa : das.multa;
      const desconto = data.desconto !== undefined ? data.desconto : das.desconto;
      const valorTotal = das.valor_original + juros + multa - desconto;

      await db('das_boletos').where({ id: dasId }).update({
        juros,
        multa,
        desconto,
        valor_total: valorTotal,
        observacoes: data.observacoes !== undefined ? data.observacoes : das.observacoes,
        updated_by: userId,
        updated_at: new Date(),
      });

      // Registrar evento
      await this.registrarEvento(dasId, TipoEventoDAS.ALTERADO, userId, {
        campos_alterados: {
          juros: [dadosAnteriores.juros, juros],
          multa: [dadosAnteriores.multa, multa],
          desconto: [dadosAnteriores.desconto, desconto],
        },
      });

      const dasAtualizado = await this.getById(companyId, dasId);
      return {
        success: true,
        data: dasAtualizado!,
        message: 'DAS atualizado com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `Erro ao atualizar DAS: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Cancela um DAS
   */
  static async cancelar(
    companyId: string,
    dasId: string,
    userId: string,
    motivo: string,
  ): Promise<DASResponse> {
    const db = await getDatabase();

    try {
      const das = await this.getById(companyId, dasId);
      if (!das) {
        return { success: false, data: null, message: 'DAS não encontrado' };
      }

      if (das.status === StatusDAS.PAGO) {
        return {
          success: false,
          data: null,
          message: 'Não é possível cancelar um DAS já pago',
        };
      }

      await db('das_boletos').where({ id: dasId }).update({
        status: StatusDAS.CANCELADO,
        observacoes: `Cancelado: ${motivo}`,
        updated_by: userId,
        updated_at: new Date(),
      });

      // Registrar evento
      await this.registrarEvento(dasId, TipoEventoDAS.CANCELADO, userId, {
        motivo,
      });

      const dasAtualizado = await this.getById(companyId, dasId);
      return {
        success: true,
        data: dasAtualizado!,
        message: 'DAS cancelado com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `Erro ao cancelar DAS: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Gera automaticamente DAS para um mês/regime específico
   * Integração com TaxCalculationService
   */
  static async gerarAutomaticamente(
    companyId: string,
    userId: string,
    mesFiscal: number,
    anoFiscal: number,
    regime: 'SIMPLES' | 'LUCRO_REAL' | 'LUCRO_PRESUMIDO',
  ): Promise<DASResponse> {
    try {
      // Calcular DAS a partir da apuração de impostos
      const calculo = await this.calcularDAS(companyId, mesFiscal, anoFiscal, regime);

      // Criar o boleto
      return this.create(companyId, userId, {
        mes_competencia: calculo.mes_competencia,
        ano_competencia: calculo.ano_competencia,
        valor_original: calculo.valor_total,
        regime_tributario: regime,
        observacoes: calculo.observacoes.join('; '),
      });
    } catch (error) {
      return {
        success: false,
        data: null,
        message: `Erro ao gerar DAS automaticamente: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Busca/cria agendamento de geração automática de DAS
   */
  static async obterAgendamento(
    companyId: string,
    regime: 'SIMPLES' | 'LUCRO_REAL' | 'LUCRO_PRESUMIDO',
  ): Promise<AgendamentoDAS | null> {
    const db = await getDatabase();

    try {
      return await db('das_agendamentos')
        .where({
          company_id: companyId,
          regime_tributario: regime,
          is_active: true,
        })
        .first();
    } catch {
      return null;
    }
  }

  /**
   * Atualiza configurações de agendamento
   */
  static async atualizarAgendamento(
    companyId: string,
    regime: 'SIMPLES' | 'LUCRO_REAL' | 'LUCRO_PRESUMIDO',
    userId: string,
    data: UpdateAgendamentoDASDTO,
  ): Promise<AgendamentoDAS | null> {
    const db = await getDatabase();

    try {
      let agendamento = await this.obterAgendamento(companyId, regime);

      if (!agendamento) {
        // Criar novo agendamento
        const insert = await db('das_agendamentos')
          .insert({
            company_id: companyId,
            regime_tributario: regime,
            auto_gerar: data.auto_gerar !== false,
            dias_antes_alerta: data.dias_antes_alerta || 3,
            codigos_receita: JSON.stringify(data.codigos_receita || {}),
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('id');

        const id = typeof insert[0] === 'object' ? insert[0].id : insert[0];
        agendamento = await this.obterAgendamento(companyId, regime);
      } else {
        // Atualizar existente
        await db('das_agendamentos').where({ id: agendamento.id }).update({
          auto_gerar: data.auto_gerar !== undefined ? data.auto_gerar : agendamento.auto_gerar,
          dias_antes_alerta:
            data.dias_antes_alerta !== undefined
              ? data.dias_antes_alerta
              : agendamento.dias_antes_alerta,
          codigos_receita:
            data.codigos_receita !== undefined
              ? JSON.stringify(data.codigos_receita)
              : agendamento.codigos_receita,
          updated_at: new Date(),
        });

        agendamento = await this.obterAgendamento(companyId, regime);
      }

      return agendamento;
    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────────

  private static gerarNumeroBoleto(
    companyId: string,
    mes: number,
    ano: number,
  ): string {
    // Formato: YYYYMMDD + 8 dígitos sequenciais
    const data = `${ano}${String(mes).padStart(2, '0')}20`;
    const sequencial = String(parseInt(companyId.slice(0, 8), 16) % 99999999)
      .padStart(8, '0');
    return `${data}${sequencial}`;
  }

  private static gerarHashIntegridade(dados: Record<string, any>): string {
    const json = JSON.stringify(dados);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  private static async registrarEvento(
    dasId: string,
    tipoEvento: TipoEventoDAS,
    usuarioId: string,
    dados: Record<string, any> = {},
  ): Promise<void> {
    const db = await getDatabase();

    try {
      await db('das_eventos').insert({
        das_boleto_id: dasId,
        tipo_evento: tipoEvento,
        descricao: dados.descricao || null,
        dados_anteriores: dados.dados_anteriores ? JSON.stringify(dados.dados_anteriores) : null,
        dados_novos: JSON.stringify(dados),
        usuario_id: usuarioId,
        ocorrencia_at: new Date(),
      });
    } catch (error) {
      console.error('Erro ao registrar evento DAS:', error);
      // Não lançar erro para não interromper fluxo principal
    }
  }
}
