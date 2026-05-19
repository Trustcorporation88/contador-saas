/**
 * DocumentoFiscalService
 * Serviço para operações com documentos fiscais
 */

import { getDatabase } from '../config/database';
import {
  DocumentoFiscal,
  ItemDocumentoFiscal,
  CreateDocumentoFiscalDTO,
  UpdateDocumentoFiscalDTO,
  FiltrosDocumentiFiscal,
  StatusDocumento,
  TipoDocumentoFiscal,
  PaginatedDocumentosResponse,
  DocumentoFiscalResponse,
  DeleteDocumentoResponse,
  EstatisticasDocumentos,
} from '../models/tipos/DocumentoFiscalTypes';

export class DocumentoFiscalService {
  /**
   * Criar novo documento fiscal
   */
  static async create(
    companyId: string,
    userId: string,
    data: CreateDocumentoFiscalDTO,
  ): Promise<DocumentoFiscalResponse> {
    const db = await getDatabase();

    try {
      // Validar CNPJ
      const cnpjLimpo = this.validarCNPJ(data.contraparte_cnpj);
      if (!cnpjLimpo) {
        return {
          success: false,
          data: null as any,
          message: 'CNPJ inválido',
        };
      }

      // Validar que tipo + série + número são únicos
      const jaConta = await db('documentos_fiscais')
        .where({
          company_id: companyId,
          tipo: data.tipo,
          serie: data.serie,
          numero: data.numero,
          is_active: true,
        })
        .first();

      if (jaConta) {
        return {
          success: false,
          data: null as any,
          message: `Documento ${data.tipo} série ${data.serie} número ${data.numero} já existe`,
        };
      }

      // Calcular valor total a partir dos itens se não informado
      const valorTotalItens = data.itens.reduce((acc, item) => {
        const valorItem = item.quantidade * item.valor_unitario;
        return acc + valorItem;
      }, 0);

      const valor_total = data.valor_total || valorTotalItens;

      // Inserir documento
      const [documentoId] = await db('documentos_fiscais').insert({
        company_id: companyId,
        tipo: data.tipo,
        numero: data.numero,
        serie: data.serie,
        data_emissao: new Date(data.data_emissao),
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento) : null,
        valor_total,
        valor_impostos: data.valor_impostos || 0,
        valor_desconto: data.valor_desconto || 0,
        descricao: data.descricao,
        observacoes: data.observacoes || null,
        contraparte_tipo: data.contraparte_tipo,
        contraparte_cnpj: cnpjLimpo,
        contraparte_nome: data.contraparte_nome || 'Fornecedor',
        contraparte_email: data.contraparte_email || null,
        contraparte_telefone: data.contraparte_telefone || null,
        status: StatusDocumento.RASCUNHO,
        registrado_no_diario: false,
        is_active: true,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Inserir itens
      if (data.itens && data.itens.length > 0) {
        const itensComId: any[] = data.itens.map((item, idx: number) => {
          const ordem = item.ordem !== undefined ? item.ordem : idx;
          return {
            documento_fiscal_id: documentoId,
            descricao: item.descricao,
            codigo_produto: item.codigo_produto || null,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.quantidade * item.valor_unitario,
            aliquota_icms: item.aliquota_icms || null,
            valor_icms: 0,
            aliquota_ipi: item.aliquota_ipi || null,
            valor_ipi: 0,
            aliquota_pis: item.aliquota_pis || null,
            aliquota_cofins: item.aliquota_cofins || null,
            ordem: ordem,
            created_at: new Date(),
          };
        });

        await db('itens_documentos_fiscais').insert(itensComId);
      }

      // Buscar documento completo
      const documento = await this.getById(companyId, String(documentoId));

      return {
        success: true,
        data: documento as DocumentoFiscal,
        message: 'Documento criado com sucesso',
      };
    } catch (error) {
      console.error('[DocumentoFiscalService.create] Erro:', error);
      return {
        success: false,
        data: null as any,
        message: `Erro ao criar documento: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Listar documentos com filtros
   */
  static async list(
    companyId: string,
    filters?: FiltrosDocumentiFiscal,
  ): Promise<PaginatedDocumentosResponse> {
    const db = await getDatabase();

    try {
      const limit = Math.min(filters?.limit || 20, 100);
      const page = Math.max(filters?.page || 1, 1);
      const offset = (page - 1) * limit;
      const sortBy = filters?.sort_by || 'data_emissao';
      const sortOrder = filters?.sort_order || 'desc';

      // Query base
      let query = db('documentos_fiscais').where({
        company_id: companyId,
        is_active: true,
      });

      // Aplicar filtros
      if (filters?.tipo) {
        query = query.where('tipo', filters.tipo);
      }
      if (filters?.status) {
        query = query.where('status', filters.status);
      }
      if (filters?.contraparte_tipo) {
        query = query.where('contraparte_tipo', filters.contraparte_tipo);
      }
      if (filters?.contraparte_cnpj) {
        query = query.where('contraparte_cnpj', this.validarCNPJ(filters.contraparte_cnpj));
      }
      if (filters?.data_emissao_de) {
        query = query.where('data_emissao', '>=', new Date(filters.data_emissao_de));
      }
      if (filters?.data_emissao_ate) {
        query = query.where('data_emissao', '<=', new Date(filters.data_emissao_ate));
      }
      if (filters?.valor_minimo) {
        query = query.where('valor_total', '>=', filters.valor_minimo);
      }
      if (filters?.valor_maximo) {
        query = query.where('valor_total', '<=', filters.valor_maximo);
      }
      if (filters?.descricao) {
        query = query.whereRaw('LOWER(descricao) LIKE LOWER(?)', [`%${filters.descricao}%`]);
      }

      // Contar total
      const countQuery = query.clone().count('id as total').first();
      const countResult = (await countQuery) as any;
      const total = parseInt(countResult?.total || 0, 10);

      // Ordenar e paginar
      const documentos = await query
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset)
        .select();

      // Carregamento de itens (lazy loading)
      const documentosComItens = await Promise.all(
        documentos.map(async (doc) => {
          const itens = await db('itens_documentos_fiscais')
            .where('documento_fiscal_id', doc.id)
            .orderBy('ordem', 'asc');
          return { ...doc, itens };
        }),
      );

      return {
        success: true,
        data: documentosComItens,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        message: `${total} documento(s) encontrado(s)`,
      };
    } catch (error) {
      console.error('[DocumentoFiscalService.list] Erro:', error);
      return {
        success: false,
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        message: `Erro ao listar: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Buscar documento por ID
   */
  static async getById(companyId: string, documentoId: string): Promise<DocumentoFiscal | null> {
    const db = await getDatabase();

    try {
      const doc = await db('documentos_fiscais').where({
        id: documentoId,
        company_id: companyId,
        is_active: true,
      }).first();

      if (!doc) {
        return null;
      }

      // Carregar itens
      const itens = await db('itens_documentos_fiscais')
        .where('documento_fiscal_id', documentoId)
        .orderBy('ordem', 'asc');

      // Carregar anexos
      const anexos = await db('anexos_documentos_fiscais')
        .where('documento_fiscal_id', documentoId)
        .orderBy('uploaded_at', 'desc');

      return {
        ...doc,
        itens,
        anexos,
      };
    } catch (error) {
      console.error('[DocumentoFiscalService.getById] Erro:', error);
      return null;
    }
  }

  /**
   * Atualizar documento (apenas em rascunho)
   */
  static async update(
    companyId: string,
    documentoId: string,
    userId: string,
    data: UpdateDocumentoFiscalDTO,
  ): Promise<DocumentoFiscalResponse> {
    const db = await getDatabase();

    try {
      const doc = await this.getById(companyId, documentoId);

      if (!doc) {
        return {
          success: false,
          data: null as any,
          message: 'Documento não encontrado',
        };
      }

      if (doc.status !== StatusDocumento.RASCUNHO) {
        return {
          success: false,
          data: null as any,
          message: 'Apenas documentos em rascunho podem ser editados',
        };
      }

      const updateData: any = {
        updated_at: new Date(),
        updated_by: userId,
      };

      if (data.numero !== undefined) updateData.numero = data.numero;
      if (data.serie !== undefined) updateData.serie = data.serie;
      if (data.data_emissao !== undefined) updateData.data_emissao = new Date(data.data_emissao);
      if (data.data_vencimento !== undefined) {
        updateData.data_vencimento = data.data_vencimento ? new Date(data.data_vencimento) : null;
      }
      if (data.valor_total !== undefined) updateData.valor_total = data.valor_total;
      if (data.valor_impostos !== undefined) updateData.valor_impostos = data.valor_impostos;
      if (data.valor_desconto !== undefined) updateData.valor_desconto = data.valor_desconto;
      if (data.descricao !== undefined) updateData.descricao = data.descricao;
      if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;
      if (data.contraparte_nome !== undefined) updateData.contraparte_nome = data.contraparte_nome;
      if (data.contraparte_email !== undefined) updateData.contraparte_email = data.contraparte_email;
      if (data.contraparte_telefone !== undefined) {
        updateData.contraparte_telefone = data.contraparte_telefone;
      }

      await db('documentos_fiscais').where('id', documentoId).update(updateData);

      // Atualizar itens se fornecidos
      if (data.itens && data.itens.length > 0) {
        await db('itens_documentos_fiscais').where('documento_fiscal_id', documentoId).del();
        const itensComId = data.itens.map((item, idx) => ({
          documento_fiscal_id: documentoId,
          descricao: item.descricao,
          codigo_produto: item.codigo_produto || null,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.quantidade * item.valor_unitario,
          aliquota_icms: item.aliquota_icms || null,
          valor_icms: 0,
          aliquota_ipi: item.aliquota_ipi || null,
          valor_ipi: 0,
          aliquota_pis: item.aliquota_pis || null,
          aliquota_cofins: item.aliquota_cofins || null,
          ordem: item.ordem || idx,
          created_at: new Date(),
        }));
        await db('itens_documentos_fiscais').insert(itensComId);
      }

      const updated = await this.getById(companyId, documentoId);

      return {
        success: true,
        data: updated as DocumentoFiscal,
        message: 'Documento atualizado com sucesso',
      };
    } catch (error) {
      console.error('[DocumentoFiscalService.update] Erro:', error);
      return {
        success: false,
        data: null as any,
        message: `Erro ao atualizar: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Registrar documento (mudar de rascunho para registrado)
   */
  static async registrar(
    companyId: string,
    documentoId: string,
  ): Promise<DocumentoFiscalResponse> {
    const db = await getDatabase();

    try {
      const doc = await this.getById(companyId, documentoId);

      if (!doc) {
        return {
          success: false,
          data: null as any,
          message: 'Documento não encontrado',
        };
      }

      await db('documentos_fiscais').where('id', documentoId).update({
        status: StatusDocumento.REGISTRADO,
        updated_at: new Date(),
      });

      const updated = await this.getById(companyId, documentoId);

      return {
        success: true,
        data: updated as DocumentoFiscal,
        message: 'Documento registrado com sucesso',
      };
    } catch (error) {
      console.error('[DocumentoFiscalService.registrar] Erro:', error);
      return {
        success: false,
        data: null as any,
        message: `Erro ao registrar: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Cancelar documento
   */
  static async cancelar(
    companyId: string,
    documentoId: string,
  ): Promise<DeleteDocumentoResponse> {
    const db = await getDatabase();

    try {
      const doc = await this.getById(companyId, documentoId);

      if (!doc) {
        return {
          success: false,
          message: 'Documento não encontrado',
          documentoId,
        };
      }

      await db('documentos_fiscais').where('id', documentoId).update({
        status: StatusDocumento.CANCELADO,
        is_active: false,
        updated_at: new Date(),
      });

      return {
        success: true,
        message: 'Documento cancelado com sucesso',
        documentoId,
      };
    } catch (error) {
      console.error('[DocumentoFiscalService.cancelar] Erro:', error);
      return {
        success: false,
        message: `Erro ao cancelar: ${(error as Error).message}`,
        documentoId,
      };
    }
  }

  /**
   * Obter estatísticas de documentos
   */
  static async getEstatisticas(companyId: string): Promise<EstatisticasDocumentos> {
    const db = await getDatabase();

    try {
      const docs = await db('documentos_fiscais').where({
        company_id: companyId,
        is_active: true,
      });

      const total_documentos = docs.length;
      const total_valor = docs.reduce((acc, doc) => acc + doc.valor_total, 0);

      const documentos_por_tipo: any = {};
      const total_valor_por_tipo: any = {};
      const documentos_por_status: any = {};

      docs.forEach((doc) => {
        // Por tipo
        documentos_por_tipo[doc.tipo] = (documentos_por_tipo[doc.tipo] || 0) + 1;
        total_valor_por_tipo[doc.tipo] = (total_valor_por_tipo[doc.tipo] || 0) + doc.valor_total;

        // Por status
        documentos_por_status[doc.status] = (documentos_por_status[doc.status] || 0) + 1;
      });

      return {
        total_documentos,
        total_valor,
        documentos_por_tipo,
        documentos_por_status,
        total_valor_por_tipo,
      };
    } catch (error) {
      console.error('[DocumentoFiscalService.getEstatisticas] Erro:', error);
      return {
        total_documentos: 0,
        total_valor: 0,
        documentos_por_tipo: {},
        documentos_por_status: {},
        total_valor_por_tipo: {},
      };
    }
  }

  /**
   * Validar e limpar CNPJ
   */
  private static validarCNPJ(cnpj: string): string | null {
    const limpo = cnpj.replace(/\D/g, '');

    if (limpo.length !== 14) {
      return null;
    }

    // Validação de dígito verificador básica
    // TODO: Implementar validação completa de CNPJ

    return limpo;
  }
}
