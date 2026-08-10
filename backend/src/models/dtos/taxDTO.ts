/**
 * Tax DTOs e Interfaces
 * Tipos para cálculo de IRPJ, CSLL, PIS, COFINS, ICMS, ISS
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum TaxType {
  IRPJ   = 'IRPJ',
  CSLL   = 'CSLL',
  PIS    = 'PIS',
  COFINS = 'COFINS',
  ICMS   = 'ICMS',
  ISS    = 'ISS',
}

export enum TaxRegime {
  LUCRO_REAL      = 'LUCRO_REAL',
  LUCRO_PRESUMIDO = 'LUCRO_PRESUMIDO',
  SIMPLES         = 'SIMPLES',
}

export enum TaxStatus {
  PENDING  = 'PENDING',
  APPROVED = 'APPROVED',
  FILED    = 'FILED',
}

/**
 * Periodicidade da apuração de IRPJ/CSLL.
 *
 * Importa porque o limite do adicional de IRPJ vale POR PERÍODO DE APURAÇÃO, não
 * por consulta. Uma empresa que apura trimestralmente e tem lucro de R$ 100.000
 * no 1º trimestre e R$ 100.000 no 4º deve R$ 8.000 de adicional (cada trimestre
 * excede os R$ 60.000). Somando o ano num único período, R$ 200.000 fica abaixo
 * dos R$ 240.000 e o adicional seria zero — resultado diferente para o mesmo fato.
 */
export enum ApuracaoPeriodicidade {
  MENSAL      = 'MENSAL',
  TRIMESTRAL  = 'TRIMESTRAL',
  ANUAL       = 'ANUAL',
}

// ─── Alíquotas fixas (vigência 2025/2026) ────────────────────────────────────

/** Lucro Real e Lucro Presumido */
export const TAX_RATES = {
  IRPJ: {
    base_rate:      0.15,   // 15% sobre lucro
    surcharge_rate: 0.10,   // Adicional 10% sobre o excedente
    /**
     * Limite do adicional POR MÊS do período de apuração (Lei 9.430/96 art. 4º,
     * RIR/2018 art. 622). O limite efetivo é este valor multiplicado pelo número
     * de meses apurados: R$ 60.000 no trimestre, R$ 240.000 no ano.
     *
     * O nome carrega "_monthly" de propósito: antes se chamava
     * surcharge_threshold e era aplicado direto sobre o lucro do período inteiro,
     * cobrando adicional de quem não devia — um lucro anual de R$ 200.000 gerava
     * R$ 18.000 de adicional onde o correto é zero.
     */
    surcharge_threshold_monthly: 20000,
  },
  CSLL: {
    rate: 0.09,             // 9% geral (15% para financeiras)
  },
  /**
   * Compensação de prejuízo fiscal de períodos anteriores (Lei 9.065/95 art. 15):
   * limitada a 30% do lucro líquido ajustado pelas adições e exclusões.
   */
  PREJUIZO_FISCAL: {
    limite_compensacao: 0.30,
  },
  PIS: {
    lucro_presumido: 0.0065, // 0,65% cumulativo
    lucro_real:      0.0165, // 1,65% não-cumulativo
    simples:         0.0,    // incluso no DAS
  },
  COFINS: {
    lucro_presumido: 0.03,   // 3% cumulativo
    lucro_real:      0.076,  // 7,6% não-cumulativo
    simples:         0.0,    // incluso no DAS
  },
  /** Percentuais de presunção (Lucro Presumido) por atividade */
  PRESUNCAO: {
    comercio:       0.08,   // 8% receita bruta
    industria:      0.08,
    servicos:       0.32,   // 32%
    servicos_hosp:  0.16,   // 16% para serviços hospitalares / transporte
    atividade_rural: 0.08,
  },
} as const;

// ─── Simples Nacional — Anexos (2024) ────────────────────────────────────────

export interface SimplesAnexoFaixa {
  limite: number;
  aliquota: number;
  deducao: number;
}

/** Anexo I — Comércio */
export const SIMPLES_ANEXO_I: SimplesAnexoFaixa[] = [
  { limite: 180000,   aliquota: 0.04,   deducao: 0 },
  { limite: 360000,   aliquota: 0.073,  deducao: 5940 },
  { limite: 720000,   aliquota: 0.095,  deducao: 13860 },
  { limite: 1800000,  aliquota: 0.107,  deducao: 22500 },
  { limite: 3600000,  aliquota: 0.143,  deducao: 87300 },
  { limite: 4800000,  aliquota: 0.19,   deducao: 378000 },
];

/** Anexo III — Serviços (ISS incluso) */
export const SIMPLES_ANEXO_III: SimplesAnexoFaixa[] = [
  { limite: 180000,   aliquota: 0.06,   deducao: 0 },
  { limite: 360000,   aliquota: 0.112,  deducao: 9360 },
  { limite: 720000,   aliquota: 0.135,  deducao: 17640 },
  { limite: 1800000,  aliquota: 0.16,   deducao: 35640 },
  { limite: 3600000,  aliquota: 0.21,   deducao: 125640 },
  { limite: 4800000,  aliquota: 0.33,   deducao: 648000 },
];

// ─── DTOs de Request ──────────────────────────────────────────────────────────

export interface CalculateTaxDTO {
  // snake_case (API interna, banco de dados)
  company_id?:   string;
  tax_regime?:   TaxRegime;
  period_start?: string;       // YYYY-MM-DD
  period_end?:   string;       // YYYY-MM-DD
  // camelCase (testes e API REST)
  companyId?:    string;
  regime?:       TaxRegime;
  periodStart?:  string;
  periodEnd?:    string;
  revenues?:     number;
  /** Para Simples Nacional: RBT12 (receita bruta dos últimos 12 meses) */
  rbt12?:       number;
  /** Atividade para cálculo de presunção (Lucro Presumido) */
  atividade?:   keyof typeof TAX_RATES.PRESUNCAO;
  /** Alíquota de ISS municipal (0.02 a 0.05) — também aceita issRate */
  iss_rate?:    number;
  issRate?:     number;
  /** Alíquota de ICMS estadual — também aceita icmsRate */
  icms_rate?:   number;
  icmsRate?:    number;
  /**
   * Periodicidade da apuração de IRPJ/CSLL. Quando informada e o período pedido
   * abranger mais de uma janela (ex.: TRIMESTRAL num período anual), a apuração é
   * feita janela por janela e somada — cada uma com seu próprio limite de
   * adicional. Omitida, o período é tratado como uma única janela, que é o
   * comportamento histórico.
   */
  apuracao?:    ApuracaoPeriodicidade;
  /**
   * Saldo de prejuízo fiscal de períodos anteriores disponível para compensação
   * (Lucro Real). Informado pelo contador — o sistema não mantém esse saldo, só
   * aplica o limite de 30% e reporta quanto foi usado.
   */
  prejuizo_fiscal_acumulado?: number;
  prejuizoFiscalAcumulado?:   number;
}

// ─── LALUR — adições e exclusões ──────────────────────────────────────────────

export enum AdjustmentType {
  ADDITION  = 'ADDITION',
  EXCLUSION = 'EXCLUSION',
}

/**
 * Ajuste do LALUR. O lucro real não é o lucro contábil: é o lucro líquido do
 * período ajustado pelas adições (despesas indedutíveis, multas, brindes) e
 * exclusões (receitas não tributáveis, dividendos recebidos) previstas em lei.
 *
 * Cada ajuste exige justificativa porque o LALUR é um livro fiscal — um valor
 * sem fundamentação não se sustenta em fiscalização.
 */
export interface CreateTaxAdjustmentDTO {
  period_start:    string;   // YYYY-MM-DD
  period_end:      string;   // YYYY-MM-DD
  adjustment_type: AdjustmentType;
  amount:          number;   // sempre positivo; o tipo define o sinal
  justification:   string;
  account_id?:     string;
}

export interface TaxAdjustment extends CreateTaxAdjustmentDTO {
  id:         string;
  company_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Memória de cálculo da transição lucro contábil → lucro real. */
export interface LucroRealMemoria {
  lucro_contabil:        number;
  adicoes:               number;
  exclusoes:             number;
  lucro_ajustado:        number;
  prejuizo_disponivel:   number;
  prejuizo_compensado:   number;
  limite_compensacao:    number;
  lucro_real:            number;
}

export interface TaxAdjustmentDTO {
  tax_calculation_id: string;
  account_id?:        string;
  adjustment_type:    'ADDITION' | 'EXCLUSION';
  amount:             number;
  justification:      string;
}

// ─── DTOs de Response ─────────────────────────────────────────────────────────

export interface TaxLineResult {
  tax_type:      TaxType;
  type?:         TaxType;        // alias camelCase
  base:          number;         // Base de cálculo
  taxableBase?:  number;         // alias camelCase para base
  rate:          number;         // Alíquota aplicada
  amount:        number;         // Valor calculado (inclui surcharge)
  surcharge?:    number;         // Adicional IRPJ (incluído no amount)
  notes?:        string;
}

export interface TaxCalculationResult {
  company_id:   string;
  companyId?:   string;         // alias camelCase
  tax_regime:   TaxRegime;
  regime?:      TaxRegime;      // alias camelCase
  period_start: string;
  periodStart?: string;         // alias camelCase
  period_end:   string;
  periodEnd?:   string;         // alias camelCase
  generated_at: string;
  revenues:     number;
  expenses:     number;
  net_income:   number;
  taxes:        TaxLineResult[];
  total_tax:    number;
  totalAmount?: number;         // alias camelCase para total_tax
  effective_rate: number;     // Carga tributária efetiva sobre receita
}

export interface SavedTaxCalculation {
  id:               string;
  company_id:       string;
  tax_type:         TaxType;
  period_start:     string;
  period_end:       string;
  calculated_amount: number;
  status:           TaxStatus;
  notes?:           string;
  created_at:       string;
  updated_at:       string;
}
