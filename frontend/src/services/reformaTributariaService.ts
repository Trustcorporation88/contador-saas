import api from '../config/api';
import type { TaxRegime } from './taxService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReformaTaxType = 'CBS' | 'IBS' | 'IS';
export type RateNature     = 'INFORMATIVO' | 'DEVIDO';
export type ReformaAliquotaFonte = 'CADASTRADA' | 'REFERENCIA_MERCADO';

export interface ReformaTaxLineResult {
  tax_type: ReformaTaxType;
  base:     number;
  rate:     number;
  amount:   number;
  natureza: RateNature;
  collectible: boolean;
  aliquota_publicada: boolean;
  fonte_aliquota?: ReformaAliquotaFonte;
  notes?: string;
}

export interface ReformaCalculationResult {
  ano:      number;
  regime:   TaxRegime;
  applicable: boolean;
  motivo_nao_aplicavel?: string;
  revenues: number;
  taxes:    ReformaTaxLineResult[];
  total_devido:      number;
  total_informativo: number;
  aliquota_efetiva?: number;
  fase?: string;
  percentual_ibs_transicao?: number;
  percentual_icms_iss_legado?: number;
  generated_at: string;
}

export interface CalculateReformaPayload {
  ano: number;
  tax_regime: TaxRegime;
  revenues?: number;
  period_start?: string;
  period_end?: string;
}

export interface ProjetarReformaPayload {
  ano_inicio: number;
  ano_fim: number;
  tax_regime: TaxRegime;
  revenues?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const ReformaTributariaService = {
  async calculate(companyId: string, payload: CalculateReformaPayload): Promise<ReformaCalculationResult> {
    const { data } = await api.post<ReformaCalculationResult>(
      `/companies/${companyId}/taxes/reforma/calculate`,
      payload,
    );
    return data;
  },

  async projetar(companyId: string, payload: ProjetarReformaPayload): Promise<ReformaCalculationResult[]> {
    const { data } = await api.post<ReformaCalculationResult[]>(
      `/companies/${companyId}/taxes/reforma/projecao`,
      payload,
    );
    return data;
  },
};
