export enum StatusContaPagar {
  PENDENTE = 'pendente',
  PARCIAL = 'parcial',
  PAGO = 'pago',
  VENCIDO = 'vencido',
  CANCELADO = 'cancelado',
}

export enum CategoriaContaPagar {
  BOLETO = 'boleto',
  FORNECEDOR = 'fornecedor',
  IMPOSTO = 'imposto',
  SALARIO = 'salario',
  ALUGUEL = 'aluguel',
  OUTRO = 'outro',
}

export enum FormaPagamentoContaPagar {
  PIX = 'pix',
  BOLETO = 'boleto',
  TRANSFERENCIA = 'transferencia',
  DINHEIRO = 'dinheiro',
  CARTAO = 'cartao',
  OUTRO = 'outro',
}

export interface PagamentoContaPagar {
  id: string;
  conta_pagar_id: string;
  data_pagamento: string;
  valor_pago: number;
  juros: number;
  multa: number;
  desconto: number;
  forma_pagamento: FormaPagamentoContaPagar;
  observacoes?: string;
  created_at: string;
  created_by: string;
}

export interface ContaPagar {
  id: string;
  company_id: string;
  created_by: string;
  updated_by?: string;
  documento_fiscal_id?: string;
  categoria: CategoriaContaPagar;
  numero_titulo: string;
  descricao: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  fornecedor_email?: string;
  fornecedor_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  valor_pago: number;
  juros: number;
  multa: number;
  desconto: number;
  status: StatusContaPagar;
  observacoes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  saldo_aberto?: number;
  dias_atraso?: number;
  pagamentos?: PagamentoContaPagar[];
}

export interface CreateContaPagarDTO {
  documento_fiscal_id?: string;
  categoria: CategoriaContaPagar;
  numero_titulo: string;
  descricao: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  fornecedor_email?: string;
  fornecedor_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  observacoes?: string;
}

export interface UpdateContaPagarDTO extends Partial<CreateContaPagarDTO> {
  status?: StatusContaPagar;
}

export interface RegistrarPagamentoDTO {
  data_pagamento: string;
  valor_pago: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  forma_pagamento: FormaPagamentoContaPagar;
  observacoes?: string;
}

export interface FiltrosContaPagar {
  categoria?: CategoriaContaPagar;
  status?: StatusContaPagar;
  fornecedor_cnpj?: string;
  fornecedor_nome?: string;
  data_vencimento_de?: string;
  data_vencimento_ate?: string;
  valor_minimo?: number;
  valor_maximo?: number;
  somente_atrasadas?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'data_vencimento' | 'valor_original' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedContasPagarResponse {
  success: boolean;
  data: ContaPagar[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

export interface ContaPagarResponse {
  success: boolean;
  data: ContaPagar | null;
  message?: string;
}

export interface DeleteContaPagarResponse {
  success: boolean;
  data: { id: string } | null;
  message?: string;
}

export interface EstatisticasContasPagar {
  total_titulos: number;
  total_aberto: number;
  total_pago: number;
  total_vencido: number;
  proximos_7_dias: number;
  proximos_14_dias: number;
  proximos_30_dias: number;
  por_status: Record<string, { quantidade: number; valor: number }>;
}