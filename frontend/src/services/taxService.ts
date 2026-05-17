import api from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaxType    = 'IRPJ' | 'CSLL' | 'PIS' | 'COFINS' | 'ICMS' | 'ISS';
export type TaxRegime  = 'LUCRO_REAL' | 'LUCRO_PRESUMIDO' | 'SIMPLES';
export type TaxStatus  = 'PENDING' | 'APPROVED' | 'FILED';

export interface TaxLineResult {
  tax_type: TaxType;
  base:     number;
  rate:     number;
  amount:   number;
  surcharge?: number;
  notes?:   string;
}

export interface TaxCalculationResult {
  company_id:    string;
  tax_regime:    TaxRegime;
  period_start:  string;
  period_end:    string;
  generated_at:  string;
  revenues:      number;
  expenses:      number;
  net_income:    number;
  taxes:         TaxLineResult[];
  total_tax:     number;
  effective_rate: number;
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

export interface CalculatePayload {
  tax_regime:   TaxRegime;
  period_start: string;
  period_end:   string;
  rbt12?:       number;
  atividade?:   string;
  iss_rate?:    number;
  icms_rate?:   number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const TaxService = {
  async calculate(companyId: string, payload: CalculatePayload): Promise<TaxCalculationResult> {
    const { data } = await api.post<TaxCalculationResult>(
      `/companies/${companyId}/taxes/calculate`,
      payload
    );
    return data;
  },

  async appraisal(companyId: string, payload: CalculatePayload): Promise<SavedTaxCalculation[]> {
    const { data } = await api.post<SavedTaxCalculation[]>(
      `/companies/${companyId}/taxes/appraisal`,
      payload
    );
    return data;
  },

  async listAppraisals(companyId: string): Promise<SavedTaxCalculation[]> {
    const { data } = await api.get<SavedTaxCalculation[]>(
      `/companies/${companyId}/taxes/appraisal`
    );
    return data;
  },

  async updateStatus(companyId: string, id: string, status: TaxStatus): Promise<SavedTaxCalculation> {
    const { data } = await api.patch<SavedTaxCalculation>(
      `/companies/${companyId}/taxes/appraisal/${id}/status`,
      { status }
    );
    return data;
  },
};
