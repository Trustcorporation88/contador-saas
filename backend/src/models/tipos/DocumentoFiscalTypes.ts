/**
 * Tipos e DTOs para Documentos Fiscais
 */

export enum TipoDocumentoFiscal {
  NFE = 'nfe',
  BOLETO = 'boleto',
  RECIBO = 'recibo',
  CUPOM_FISCAL = 'cupom_fiscal',
}

export enum ContraparteType {
  CLIENTE = 'cliente',
  FORNECEDOR = 'fornecedor',
}

export enum StatusDocumento {
  RASCUNHO = 'rascunho',
  REGISTRADO = 'registrado',
  CANCELADO = 'cancelado',
}

export enum TipoAnexo {
  XML = 'xml',
  IMAGEM = 'imagem',
  PDF = 'pdf',
  OUTRO = 'outro',
}

/**
 * Item individual de um documento fiscal
 */
export interface ItemDocumentoFiscal {
  id?: string;
  documento_fiscal_id?: string;
  descricao: string;
  codigo_produto?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  aliquota_icms?: number;
  valor_icms?: number;
  aliquota_ipi?: number;
  valor_ipi?: number;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  ordem?: number;
  created_at?: Date;
}

/**
 * Anexo de um documento fiscal
 */
export interface AnexoDocumentoFiscal {
  id?: string;
  documento_fiscal_id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  url_arquivo: string;
  tamanho_bytes?: number;
  descricao?: string;
  tipo_anexo: TipoAnexo;
  uploaded_at?: Date;
  uploaded_by: string;
}

/**
 * Documento Fiscal - Entidade principal
 */
export interface DocumentoFiscal {
  id?: string;
  company_id: string;
  tipo: TipoDocumentoFiscal;
  numero: string;
  serie: string;
  data_emissao: Date;
  data_vencimento?: Date;
  valor_total: number;
  valor_impostos?: number;
  valor_desconto?: number;
  descricao: string;
  observacoes?: string;
  
  // Contraparte
  contraparte_tipo: ContraparteType;
  contraparte_cnpj: string;
  contraparte_nome: string;
  contraparte_email?: string;
  contraparte_telefone?: string;
  
  // Status
  status: StatusDocumento;
  registrado_no_diario: boolean;
  lancamento_diario_id?: string;
  
  // Soft delete
  is_active: boolean;
  
  // Timestamps
  created_at?: Date;
  updated_at?: Date;
  created_by: string;
  updated_by?: string;
  
  // Relações (carregadas sob demanda)
  itens?: ItemDocumentoFiscal[];
  anexos?: AnexoDocumentoFiscal[];
}

/**
 * DTO para criar documento (entrada de dados)
 */
export interface CreateDocumentoFiscalDTO {
  tipo: TipoDocumentoFiscal;
  numero: string;
  serie: string;
  data_emissao: string | Date; // ISO string ou Date
  data_vencimento?: string | Date;
  valor_total: number;
  valor_impostos?: number;
  valor_desconto?: number;
  descricao: string;
  observacoes?: string;
  
  contraparte_tipo: ContraparteType;
  contraparte_cnpj: string; // Com ou sem formatação
  contraparte_nome?: string; // Se não preencher, busca via BrasilAPI
  contraparte_email?: string;
  contraparte_telefone?: string;
  
  itens: CreateItemDocumentoDTO[];
  anexos?: AnexoDocumentoFiscal[];
  registrar_no_diario?: boolean; // Se true, cria lançamento automático
}

/**
 * DTO para item de documento
 */
export interface CreateItemDocumentoDTO {
  descricao: string;
  codigo_produto?: string;
  quantidade: number;
  valor_unitario: number;
  aliquota_icms?: number;
  aliquota_ipi?: number;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  ordem?: number;
}

/**
 * DTO para atualizar documento
 */
export interface UpdateDocumentoFiscalDTO {
  numero?: string;
  serie?: string;
  data_emissao?: string | Date;
  data_vencimento?: string | Date;
  valor_total?: number;
  valor_impostos?: number;
  valor_desconto?: number;
  descricao?: string;
  observacoes?: string;
  
  contraparte_tipo?: ContraparteType;
  contraparte_cnpj?: string;
  contraparte_nome?: string;
  contraparte_email?: string;
  contraparte_telefone?: string;
  
  status?: StatusDocumento;
  itens?: CreateItemDocumentoDTO[];
}

/**
 * Filtros para listar documentos
 */
export interface FiltrosDocumentiFiscal {
  tipo?: TipoDocumentoFiscal;
  status?: StatusDocumento;
  contraparte_tipo?: ContraparteType;
  data_emissao_de?: string | Date;
  data_emissao_ate?: string | Date;
  valor_minimo?: number;
  valor_maximo?: number;
  contraparte_cnpj?: string;
  descricao?: string;
  
  // Paginação
  page?: number;
  limit?: number;
  sort_by?: 'data_emissao' | 'valor_total' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Resposta paginada
 */
export interface PaginatedDocumentosResponse {
  success: boolean;
  data: DocumentoFiscal[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

/**
 * Resposta para criar/atualizar
 */
export interface DocumentoFiscalResponse {
  success: boolean;
  data: DocumentoFiscal;
  message?: string;
}

/**
 * Resposta para deletar
 */
export interface DeleteDocumentoResponse {
  success: boolean;
  message: string;
  documentoId: string;
}

/**
 * Estatísticas de documentos
 */
export interface EstatisticasDocumentos {
  total_documentos: number;
  total_valor: number;
  documentos_por_tipo: {
    [key in TipoDocumentoFiscal]?: number;
  };
  documentos_por_status: {
    [key in StatusDocumento]?: number;
  };
  total_valor_por_tipo: {
    [key in TipoDocumentoFiscal]?: number;
  };
}
