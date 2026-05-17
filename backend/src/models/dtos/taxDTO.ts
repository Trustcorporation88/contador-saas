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

// ─── Alíquotas fixas (vigência 2025/2026) ────────────────────────────────────

/** Lucro Real e Lucro Presumido */
export const TAX_RATES = {
  IRPJ: {
    base_rate:      0.15,   // 15% sobre lucro
    surcharge_rate: 0.10,   // Adicional 10% sobre lucro > R$20.000/mês
    surcharge_threshold: 20000,
  },
  CSLL: {
    rate: 0.09,             // 9% geral (15% para financeiras)
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
