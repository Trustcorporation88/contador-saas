/**
 * Reforma Tributária DTOs — CBS (Contribuição sobre Bens e Serviços) e
 * IBS (Imposto sobre Bens e Serviços)
 *
 * Base legal: EC 132/2023 + LC 214/2025
 * Cronograma confirmado (verificado em 2026-07-25):
 *  - 2026: fase de testes. CBS 0,9% + IBS 0,1%, calculados e destacados,
 *    SEM recolhimento em dinheiro (compensável). Simples Nacional NÃO
 *    participa desta fase — só entra em 2027.
 *  - 2027-2028: PIS/COFINS extintos, CBS cobrada de fato. IBS segue 0,1%,
 *    CBS reduz 0,1 p.p. Simples Nacional entra no novo modelo.
 *  - 2029-2032: IBS substitui ICMS/ISS gradualmente.
 *  - 2033+: sistema definitivo — só CBS + IBS (+ IS quando aplicável).
 *
 * As alíquotas de referência definitivas pós-2027 AINDA NÃO são fixadas por
 * lei — dependem de cálculo anual do Comitê Gestor do IBS + Receita Federal.
 * Por isso NUNCA são hardcoded aqui — vêm da tabela `reforma_aliquotas_anuais`.
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
  /** false quando não há alíquota cadastrada em reforma_aliquotas_anuais para o ano */
  aliquota_publicada: boolean;
  notes?: string;
}

export interface ReformaCalculationResult {
  ano: number;
  regime: TaxRegime;
  /** false quando o ano é anterior a 2026, ou Simples Nacional antes de 2027 */
  applicable: boolean;
  motivo_nao_aplicavel?: string;
  revenues: number;
  taxes: ReformaTaxLineResult[];
  /** Soma apenas das linhas com collectible=true */
  total_devido: number;
  /** Soma das linhas com collectible=false (ex.: 2026, informativo) */
  total_informativo: number;
  generated_at: string;
}
