/**
 * Tax Calculation Service
 * Motor de cálculo: IRPJ, CSLL, PIS, COFINS, ICMS, ISS
 * Regimes: Lucro Real, Lucro Presumido, Simples Nacional
 */

import { getDatabase } from '../config/database';
import { ReportService } from './reportService';
import {
  TaxType, TaxRegime, TaxStatus,
  TAX_RATES, SIMPLES_ANEXO_I, SIMPLES_ANEXO_III,
  CalculateTaxDTO, TaxLineResult, TaxCalculationResult, SavedTaxCalculation,
} from '../models/dtos/taxDTO';

export class TaxCalculationService {

  // ───────────────────────────────────────────────────────────────────────────
  // CÁLCULO PRINCIPAL — ponto de entrada
  // ───────────────────────────────────────────────────────────────────────────

  static async calculate(dto: CalculateTaxDTO): Promise<TaxCalculationResult> {
    // Normalizar camelCase → snake_case
    const companyId   = dto.company_id  ?? dto.companyId  ?? '';
    const taxRegime   = dto.tax_regime  ?? dto.regime     ?? TaxRegime.LUCRO_REAL;
    const periodStart = dto.period_start ?? dto.periodStart ?? '';
    const periodEnd   = dto.period_end   ?? dto.periodEnd   ?? '';
    const issRate     = dto.iss_rate     ?? dto.issRate     ?? 0.05;
    const icmsRate    = dto.icms_rate    ?? dto.icmsRate    ?? 0.12;

    const dre = await ReportService.getIncomeStatement(
      companyId, periodStart, periodEnd,
    );

    // dto.revenues tem prioridade (pode ser override de teste); fallback para o DRE
    const revenues  = dto.revenues ?? (dre as any).gross_revenue ?? (dre as any).revenues ?? 0;
    const expenses  = (dre as any).total_expenses ?? (dre as any).expenses ?? 0;
    const netIncome = (dre as any).net_income     ?? (dre as any).netIncome ?? 0;

    let taxes: TaxLineResult[];

    switch (taxRegime) {
      case TaxRegime.LUCRO_PRESUMIDO:
        taxes = TaxCalculationService.calcLucroPresumido(
          revenues, dto.atividade ?? 'servicos', issRate, icmsRate,
        );
        break;
      case TaxRegime.SIMPLES:
        taxes = TaxCalculationService.calcSimples(revenues, dto.rbt12 ?? revenues);
        break;
      case TaxRegime.LUCRO_REAL:
      default:
        taxes = TaxCalculationService.calcLucroReal(
          revenues, netIncome, issRate, icmsRate,
        );
        break;
    }

    // Adicionar aliases camelCase para compatibilidade com testes
    taxes = taxes.map(t => ({ ...t, type: t.tax_type, taxableBase: t.base }));

    // totalTax = soma dos amounts (surcharge já incluso no amount de cada imposto)
    const totalTax = taxes.reduce((s, t) => s + t.amount, 0);
    const effectiveRate = revenues > 0 ? totalTax / revenues : 0;

    const result: TaxCalculationResult = {
      company_id:   companyId,
      companyId,                // alias camelCase
      tax_regime:   taxRegime,
      regime:       taxRegime,  // alias camelCase
      period_start: periodStart,
      periodStart,              // alias camelCase
      period_end:   periodEnd,
      periodEnd,                // alias camelCase
      generated_at: new Date().toISOString(),
      revenues, expenses, net_income: netIncome,
      taxes, total_tax: totalTax,
      totalAmount: totalTax,   // alias camelCase
      effective_rate: Math.round(effectiveRate * 10000) / 10000,
    };
    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LUCRO REAL
  // ───────────────────────────────────────────────────────────────────────────

  private static calcLucroReal(
    revenues: number,
    netIncome: number,
    issRate = 0.05,
    icmsRate = 0.12,
  ): TaxLineResult[] {
    const results: TaxLineResult[] = [];
    const lucroTributavel = Math.max(0, netIncome);

    // IRPJ: 15% + adicional 10% sobre lucro > R$20.000/mês
    const irpjBase = lucroTributavel;
    const irpjAmount = irpjBase * TAX_RATES.IRPJ.base_rate;
    const irpjSurcharge = Math.max(0, irpjBase - TAX_RATES.IRPJ.surcharge_threshold)
      * TAX_RATES.IRPJ.surcharge_rate;
    // amount inclui a sobretaxa (total IRPJ a pagar)
    results.push({
      tax_type: TaxType.IRPJ,
      base: irpjBase,
      rate: TAX_RATES.IRPJ.base_rate,
      amount: Math.round((irpjAmount + irpjSurcharge) * 100) / 100,
      surcharge: Math.round(irpjSurcharge * 100) / 100,
      notes: irpjSurcharge > 0 ? `Adicional 10% sobre R$ ${(irpjBase - TAX_RATES.IRPJ.surcharge_threshold).toFixed(2)}` : undefined,
    });

    // CSLL: 9% sobre lucro
    results.push({
      tax_type: TaxType.CSLL,
      base: lucroTributavel,
      rate: TAX_RATES.CSLL.rate,
      amount: Math.round(lucroTributavel * TAX_RATES.CSLL.rate * 100) / 100,
    });

    // PIS: 1,65% sobre receita (não-cumulativo)
    results.push({
      tax_type: TaxType.PIS,
      base: revenues,
      rate: TAX_RATES.PIS.lucro_real,
      amount: Math.round(revenues * TAX_RATES.PIS.lucro_real * 100) / 100,
      notes: 'Não-cumulativo',
    });

    // COFINS: 7,6% sobre receita (não-cumulativo)
    results.push({
      tax_type: TaxType.COFINS,
      base: revenues,
      rate: TAX_RATES.COFINS.lucro_real,
      amount: Math.round(revenues * TAX_RATES.COFINS.lucro_real * 100) / 100,
      notes: 'Não-cumulativo',
    });

    // ISS: alíquota municipal (2% a 5%)
    const issRate_ = Math.min(0.05, Math.max(0.02, issRate));
    results.push({
      tax_type: TaxType.ISS,
      base: revenues,
      rate: issRate_,
      amount: Math.round(revenues * issRate_ * 100) / 100,
      notes: `Alíquota municipal ${(issRate_ * 100).toFixed(0)}%`,
    });

    // ICMS: alíquota estadual
    results.push({
      tax_type: TaxType.ICMS,
      base: revenues,
      rate: icmsRate,
      amount: Math.round(revenues * icmsRate * 100) / 100,
      notes: `Alíquota estadual ${(icmsRate * 100).toFixed(0)}%`,
    });

    return results;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LUCRO PRESUMIDO
  // ───────────────────────────────────────────────────────────────────────────

  private static calcLucroPresumido(
    revenues: number,
    atividade: keyof typeof TAX_RATES.PRESUNCAO,
    issRate = 0.05,
    icmsRate = 0.12,
  ): TaxLineResult[] {
    const results: TaxLineResult[] = [];
    const presuncao = TAX_RATES.PRESUNCAO[atividade];
    const lucroPresumido = revenues * presuncao;

    // IRPJ: 15% sobre lucro presumido + adicional
    const irpjAmount = lucroPresumido * TAX_RATES.IRPJ.base_rate;
    const irpjSurcharge = Math.max(0, lucroPresumido - TAX_RATES.IRPJ.surcharge_threshold)
      * TAX_RATES.IRPJ.surcharge_rate;
    // amount inclui a sobretaxa (total IRPJ a pagar)
    results.push({
      tax_type: TaxType.IRPJ,
      base: lucroPresumido,
      rate: TAX_RATES.IRPJ.base_rate,
      amount: Math.round((irpjAmount + irpjSurcharge) * 100) / 100,
      surcharge: Math.round(irpjSurcharge * 100) / 100,
      notes: `Presunção ${(presuncao * 100).toFixed(0)}% sobre R$ ${revenues.toFixed(2)}`,
    });

    // CSLL: 9% sobre lucro presumido (presunção 12% ou 32%)
    const csllPresuncao = atividade === 'servicos' ? 0.32 : 0.12;
    const csllBase = revenues * csllPresuncao;
    results.push({
      tax_type: TaxType.CSLL,
      base: csllBase,
      rate: TAX_RATES.CSLL.rate,
      amount: Math.round(csllBase * TAX_RATES.CSLL.rate * 100) / 100,
      notes: `Presunção CSLL ${(csllPresuncao * 100).toFixed(0)}%`,
    });

    // PIS: 0,65% (cumulativo)
    results.push({
      tax_type: TaxType.PIS,
      base: revenues,
      rate: TAX_RATES.PIS.lucro_presumido,
      amount: Math.round(revenues * TAX_RATES.PIS.lucro_presumido * 100) / 100,
      notes: 'Cumulativo',
    });

    // COFINS: 3% (cumulativo)
    results.push({
      tax_type: TaxType.COFINS,
      base: revenues,
      rate: TAX_RATES.COFINS.lucro_presumido,
      amount: Math.round(revenues * TAX_RATES.COFINS.lucro_presumido * 100) / 100,
      notes: 'Cumulativo',
    });

    // ISS
    const issRate_ = Math.min(0.05, Math.max(0.02, issRate));
    results.push({
      tax_type: TaxType.ISS,
      base: revenues,
      rate: issRate_,
      amount: Math.round(revenues * issRate_ * 100) / 100,
      notes: `Alíquota municipal ${(issRate_ * 100).toFixed(0)}%`,
    });

    // ICMS
    results.push({
      tax_type: TaxType.ICMS,
      base: revenues,
      rate: icmsRate,
      amount: Math.round(revenues * icmsRate * 100) / 100,
      notes: `Alíquota estadual ${(icmsRate * 100).toFixed(0)}%`,
    });

    return results;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SIMPLES NACIONAL
  // ───────────────────────────────────────────────────────────────────────────

  private static calcSimples(
    revenues: number,
    rbt12: number,
    anexo: 'I' | 'III' = 'III',
  ): TaxLineResult[] {
    const faixas = anexo === 'I' ? SIMPLES_ANEXO_I : SIMPLES_ANEXO_III;
    const faixa = faixas.find(f => rbt12 <= f.limite) ?? faixas[faixas.length - 1];
    const aliquotaEfetiva = rbt12 > 0
      ? (rbt12 * faixa.aliquota - faixa.deducao) / rbt12
      : faixa.aliquota;

    const das = Math.round(revenues * aliquotaEfetiva * 100) / 100;

    return [{
      tax_type: TaxType.PIS,    // DAS engloba todos os tributos
      base: revenues,
      rate: aliquotaEfetiva,
      amount: das,
      notes: `DAS Simples Nacional — Anexo ${anexo} | Alíquota efetiva ${(aliquotaEfetiva * 100).toFixed(2)}% | RBT12 R$ ${rbt12.toFixed(2)}`,
    }];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PERSISTÊNCIA no banco — salvar/listar cálculos
  // ───────────────────────────────────────────────────────────────────────────

  static async save(result: TaxCalculationResult): Promise<SavedTaxCalculation[]> {
    const db = await getDatabase();
    const saved: SavedTaxCalculation[] = [];

    for (const tax of result.taxes) {
      const amount = tax.amount + (tax.surcharge ?? 0);
      const [row] = await db('tax_calculations')
        .insert({
          company_id:        result.company_id,
          tax_type:          tax.tax_type,
          period_start:      result.period_start,
          period_end:        result.period_end,
          calculated_amount: amount,
          status:            TaxStatus.PENDING,
          notes:             tax.notes ?? null,
        })
        .onConflict(['company_id', 'tax_type', 'period_start', 'period_end'])
        .merge({ calculated_amount: amount, status: TaxStatus.PENDING, notes: tax.notes ?? null })
        .returning('*');
      saved.push(row as SavedTaxCalculation);
    }

    return saved;
  }

  static async list(companyId: string, filters?: {
    tax_type?: TaxType;
    status?: TaxStatus;
    period_start?: string;
    period_end?: string;
  }): Promise<SavedTaxCalculation[]> {
    const db = await getDatabase();
    let q = db('tax_calculations').where({ company_id: companyId });
    if (filters?.tax_type)    q = q.where({ tax_type: filters.tax_type });
    if (filters?.status)      q = q.where({ status: filters.status });
    if (filters?.period_start) q = q.where('period_start', '>=', filters.period_start);
    if (filters?.period_end)   q = q.where('period_end', '<=', filters.period_end);
    return q.orderBy('period_start', 'desc') as Promise<SavedTaxCalculation[]>;
  }

  static async updateStatus(
    id: string, companyId: string, status: TaxStatus,
  ): Promise<SavedTaxCalculation | null> {
    const db = await getDatabase();
    const [row] = await db('tax_calculations')
      .where({ id, company_id: companyId })
      .update({ status, updated_at: new Date() })
      .returning('*');
    return (row as SavedTaxCalculation) ?? null;
  }
}
