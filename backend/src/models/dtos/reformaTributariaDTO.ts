/**
 * Reforma Tributária DTOs — CBS (Contribuição sobre Bens e Serviços) e
 * IBS (Imposto sobre Bens e Serviços)
 *
 * Base legal: EC 132/2023 + LC 214/2025
 * Cronograma (Receita Federal / LC 214):
 *  - 2026: fase de testes. CBS 0,9% + IBS 0,1%, calculados e destacados,
 *    SEM recolhimento em dinheiro (compensável). Simples Nacional NÃO
 *    participa desta fase — só entra em 2027.
 *  - 2027-2028: PIS/COFINS extintos; CBS cobrada de fato; IBS segue 0,1%;
 *    IPI → 0 (exceto ZFM); IS inicia em 2027. Simples entra no novo modelo.
 *  - 2029-2032: IBS substitui ICMS/ISS gradualmente (10/20/30/40% da
 *    alíquota cheia; legado ICMS/ISS em 90/80/70/60%).
 *  - 2033+: sistema definitivo — só CBS + IBS (+ IS quando aplicável).
 *
 * Alíquotas de referência definitivas pós-2026 são fixadas anualmente por
 * resolução do Senado (cálculo TCU / Comitê Gestor). Enquanto não houver
 * cadastro oficial em `reforma_aliquotas_anuais`, o motor usa alíquotas de
 * referência de mercado para simulação (CBS ~8,8% / IBS cheio ~17,7%),
 * sempre sobrescritas pelo valor cadastrado no banco quando existir.
 */

import { TaxRegime } from './taxDTO';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ReformaTaxType {
  CBS = 'CBS',
  IBS = 'IBS',
  IS  = 'IS', // Imposto Seletivo — schema disponível, cálculo automático fora do escopo atual
}

export enum RateNature {
  /** 2026: calculado/destacado, sem recolhimento em dinheiro (compensável) */
  INFORMATIVO = 'INFORMATIVO',
  /** 2027+: valor efetivamente devido */
  DEVIDO = 'DEVIDO',
}

/** Origem da alíquota usada no cálculo */
export type ReformaAliquotaFonte =
  | 'CADASTRADA'          // linha em reforma_aliquotas_anuais
  | 'REFERENCIA_MERCADO'; // fallback de simulação (CBS 8,8% / IBS transição)

// ─── Modelo de dados versionado (tabelas reforma_*) ──────────────────────────

export interface ReformaAliquotaAnual {
  id: string;
  ano: number;
  tax_type: ReformaTaxType;
  aliquota: number;
  natureza: RateNature;
  aplicavel_simples: boolean;
  fonte_legal?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  created_at: string;
  updated_at: string;
}

export interface ReformaTransicaoAno {
  id: string;
  ano: number;
  /** Fração da carga tributária já substituída por IBS (0 a 1) */
  percentual_ibs: number;
  /** Fração de ICMS/ISS legado que ainda subsiste (0 a 1) */
  percentual_icms_iss_legado: number;
  fonte_legal?: string;
  created_at: string;
  updated_at: string;
}

// ─── DTOs de Request ──────────────────────────────────────────────────────────

export interface CalculateReformaDTO {
  company_id?: string;
  ano: number;
  regime: TaxRegime;
  period_start?: string;
  period_end?: string;
  /** Override de receita para simulação sem buscar DRE real */
  revenues?: number;
  /** Valor de ICMS+ISS legado do período, usado na fase de transição 2029-2032 */
  icms_iss_legado_amount?: number;
}

export interface ProjecaoReformaDTO {
  company_id?: string;
  regime: TaxRegime;
  ano_inicio: number;
  ano_fim: number;
  revenues?: number;
  period_start?: string;
  period_end?: string;
}

export interface UpsertAliquotaReformaDTO {
  ano: number;
  tax_type: ReformaTaxType;
  aliquota: number;
  natureza: RateNature;
  aplicavel_simples?: boolean;
  fonte_legal?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
}

// ─── DTOs de Response ─────────────────────────────────────────────────────────

export interface ReformaTaxLineResult {
  tax_type: ReformaTaxType;
  base: number;
  rate: number;
  amount: number;
  natureza: RateNature;
  /** true quando natureza === DEVIDO (valor a recolher de fato) */
  collectible: boolean;
  /** true quando há alíquota utilizável (cadastrada ou referência de mercado) */
  aliquota_publicada: boolean;
  /** Origem da alíquota aplicada */
  fonte_aliquota?: ReformaAliquotaFonte;
  notes?: string;
}

export interface ReformaCalculationResult {
  ano: number;
  regime: TaxRegime;
  /** false quando o ano é anterior a 2026, ou Simples Nacional em 2026 */
  applicable: boolean;
  motivo_nao_aplicavel?: string;
  revenues: number;
  taxes: ReformaTaxLineResult[];
  /** Soma apenas das linhas com collectible=true */
  total_devido: number;
  /** Soma das linhas com collectible=false (ex.: 2026, informativo) */
  total_informativo: number;
  /** Soma das alíquotas CBS+IBS aplicadas (fração, ex.: 0.265 = 26,5%) */
  aliquota_efetiva: number;
  /** Rótulo da fase do cronograma (testes / CBS plena / transição / definitivo) */
  fase?: string;
  /** Fração IBS na transição ICMS/ISS (0–1), quando aplicável */
  percentual_ibs_transicao?: number;
  /** Fração ICMS/ISS legado remanescente (0–1), quando aplicável */
  percentual_icms_iss_legado?: number;
  generated_at: string;
}
