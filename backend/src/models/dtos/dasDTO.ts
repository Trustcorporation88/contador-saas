/**
 * DAS DTOs e Interfaces
 * Tipos para Documento de Arrecadação do Simples Nacional
 */

export enum StatusDAS {
  EMITIDO = 'EMITIDO',
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
  VENCIDO = 'VENCIDO',
  CANCELADO = 'CANCELADO',
}

export enum TipoEventoDAS {
  GERADO = 'GERADO',
  EMITIDO = 'EMITIDO',
  VENCIMENTO_PROXIMO = 'VENCIMENTO_PROXIMO',
  VENCIDO = 'VENCIDO',
  PAGAMENTO_REGISTRADO = 'PAGAMENTO_REGISTRADO',
  CANCELADO = 'CANCELADO',
  ALTERADO = 'ALTERADO',
}

export enum CodigoReceitaDAS {
  SIMPLES_NACIONAL = '0201',
  LUCRO_REAL = '0200',
  LUCRO_PRESUMIDO = '0200',
  IRRF = '0101',
  INSS = '0110',
}

// ─── DTOs de Request ──────────────────────────────────────────────────────────

export interface CreateDASDTO {
  tax_calculation_id?: string;
  mes_competencia: number; // 1-12
  ano_competencia: number;
  valor_original: number;
  regime_tributario: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES';
  juros?: number;
  multa?: number;
  desconto?: number;
  observacoes?: string;
}

export interface GenerateDASFromTaxDTO {
  tax_calculation_id: string;
  auto_generate_if_simples?: boolean; // Se true, gera automaticamente se Simples Nacional
}

export interface UpdateDASDTO {
  juros?: number;
  multa?: number;
  desconto?: number;
  observacoes?: string;
}

export interface RegisterPaymentDTO {
  data_pagamento: string; // YYYY-MM-DD
  valor_pago: number;
  juros_pago?: number;
  multa_paga?: number;
  numero_comprovante?: string;
}

export interface ListDASFilters {
  status?: StatusDAS;
  regime_tributario?: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES';
  mes_competencia?: number;
  ano_competencia?: number;
  data_vencimento_de?: string;
  data_vencimento_ate?: string;
  somente_atrasadas?: boolean;
  somente_nao_pagos?: boolean;
  limit?: number;
  page?: number;
  sort_by?: 'data_vencimento' | 'valor_total' | 'status' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface UpdateAgendamentoDASDTO {
  auto_gerar?: boolean;
  dias_antes_alerta?: number;
  codigos_receita?: Record<string, string>;
}

// ─── DTOs de Response ─────────────────────────────────────────────────────────

export interface DASBoleto {
  id: string;
  company_id: string;
  tax_calculation_id: string | null;
  
  data_emissao: string; // ISO 8601
  data_vencimento: string;
  mes_competencia: number;
  ano_competencia: number;
  
  valor_original: number;
  juros: number;
  multa: number;
  desconto: number;
  valor_total: number;
  valor_pago: number;
  valor_devido: number; // valor_total - valor_pago
  
  status: StatusDAS;
  
  codigo_receita: string;
  numero_boleto: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  
  data_pagamento: string | null;
  juros_pago: number | null;
  multa_paga: number | null;
  numero_comprovante: string | null;
  
  regime_tributario: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES';
  observacoes: string | null;
  
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface DASResponse {
  success: boolean;
  data: DASBoleto | null;
  message?: string;
}

export interface PaginatedDASResponse {
  success: boolean;
  data: DASBoleto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DASCalculationResult {
  mes_competencia: number;
  ano_competencia: number;
  data_vencimento: string; // Calculada como 20º dia do mês seguinte
  regime_tributario: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES';
  valor_base: number;
  valor_total: number;
  percentual_aliquota: number;
  observacoes: string[];
}

export interface EventoDAS {
  id: string;
  das_boleto_id: string;
  tipo_evento: TipoEventoDAS;
  descricao: string | null;
  dados_anteriores: Record<string, any> | null;
  dados_novos: Record<string, any> | null;
  usuario_id: string;
  ocorrencia_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AgendamentoDAS {
  id: string;
  company_id: string;
  auto_gerar: boolean;
  dias_antes_alerta: number;
  regime_tributario: 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES';
  codigos_receita: Record<string, string>;
  ultimo_agendamento: string | null;
  proximo_agendamento: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

export const CODIGO_RECEITA_POR_REGIME = {
  SIMPLES: CodigoReceitaDAS.SIMPLES_NACIONAL,
  LUCRO_REAL: CodigoReceitaDAS.LUCRO_REAL,
  LUCRO_PRESUMIDO: CodigoReceitaDAS.LUCRO_PRESUMIDO,
} as const;

export const VENCIMENTO_DIA_PADRAO = 20; // 20º dia do mês seguinte
