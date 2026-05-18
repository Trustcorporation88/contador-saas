export enum StatusContaReceber {
  PENDENTE = 'pendente',
  PARCIAL = 'parcial',
  RECEBIDO = 'recebido',
  VENCIDO = 'vencido',
  CANCELADO = 'cancelado',
}

export enum CategoriaContaReceber {
  BOLETO = 'boleto',
  DUPLICATA = 'duplicata',
  PROMISSORIA = 'promissoria',
  PIX = 'pix',
  OUTRO = 'outro',
}

export enum FormaRecebimento {
  PIX = 'pix',
  BOLETO = 'boleto',
  TRANSFERENCIA = 'transferencia',
  DINHEIRO = 'dinheiro',
  CARTAO = 'cartao',
  OUTRO = 'outro',
}

export interface RecebimentoContaReceber {
  id: string;
  conta_receber_id: string;
  data_recebimento: string;
  valor_recebido: number;
  juros: number;
  multa: number;
  desconto: number;
  forma_recebimento: FormaRecebimento;
  observacoes?: string;
  created_at: string;
  created_by: string;
}

export interface ContaReceber {
  id: string;
  company_id: string;
  created_by: string;
  updated_by?: string;
  documento_fiscal_id?: string;
  categoria: CategoriaContaReceber;
  numero_titulo: string;
  descricao: string;
  cliente_nome: string;
  cliente_cnpj?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  valor_recebido: number;
  juros: number;
  multa: number;
  desconto: number;
  status: StatusContaReceber;
  observacoes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  saldo_aberto?: number;
  dias_atraso?: number;
  recebimentos?: RecebimentoContaReceber[];
}

export interface CreateContaReceberDTO {
  documento_fiscal_id?: string;
  categoria: CategoriaContaReceber;
  numero_titulo: string;
  descricao: string;
  cliente_nome: string;
  cliente_cnpj?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  data_emissao: string;
  data_vencimento: string;
  valor_original: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  observacoes?: string;
}

export interface UpdateContaReceberDTO extends Partial<CreateContaReceberDTO> {
  status?: StatusContaReceber;
}

export interface RegistrarRecebimentoDTO {
  data_recebimento: string;
  valor_recebido: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  forma_recebimento: FormaRecebimento;
  observacoes?: string;
}

export interface FiltrosContaReceber {
  categoria?: CategoriaContaReceber;
  status?: StatusContaReceber;
  cliente_cnpj?: string;
  cliente_nome?: string;
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

export interface PaginatedContasReceberResponse {
  success: boolean;
  data: ContaReceber[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

export interface ContaReceberResponse {
  success: boolean;
  data: ContaReceber | null;
  message?: string;
}

export interface DeleteContaReceberResponse {
  success: boolean;
  data: { id: string } | null;
  message?: string;
}

export interface EstatisticasContasReceber {
  total_titulos: number;
  total_aberto: number;
  total_recebido: number;
  total_vencido: number;
  proximos_7_dias: number;
  proximos_14_dias: number;
  proximos_30_dias: number;
  por_status: Record<string, { quantidade: number; valor: number }>;
}