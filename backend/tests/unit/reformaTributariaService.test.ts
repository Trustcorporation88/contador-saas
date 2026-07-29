/**
 * Testes unitários do fallback de alíquotas de referência (CBS/IBS).
 * Não dependem de banco — validam o cronograma LC 214 / benchmarks de mercado.
 */

jest.mock('../../src/config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../src/services/reportService', () => ({
  ReportService: { getIncomeStatement: jest.fn() },
}));

jest.mock('../../src/services/taxCalculationService', () => ({
  TaxCalculationService: { save: jest.fn() },
}));

import { getAliquotaReferencia } from '../../src/services/reformaTributariaService';
import { ReformaTaxType, RateNature } from '../../src/models/dtos/reformaTributariaDTO';

describe('getAliquotaReferencia — cronograma Reforma Tributária', () => {
  it('retorna null antes de 2026', () => {
    expect(getAliquotaReferencia(2025, ReformaTaxType.CBS)).toBeNull();
  });

  it('2026: CBS 0,9% e IBS 0,1% informativos', () => {
    const cbs = getAliquotaReferencia(2026, ReformaTaxType.CBS)!;
    const ibs = getAliquotaReferencia(2026, ReformaTaxType.IBS)!;
    expect(cbs.aliquota).toBe(0.009);
    expect(ibs.aliquota).toBe(0.001);
    expect(cbs.natureza).toBe(RateNature.INFORMATIVO);
    expect(ibs.natureza).toBe(RateNature.INFORMATIVO);
  });

  it('2027-2028: CBS 8,8% e IBS 0,1% devidos', () => {
    for (const ano of [2027, 2028]) {
      const cbs = getAliquotaReferencia(ano, ReformaTaxType.CBS)!;
      const ibs = getAliquotaReferencia(ano, ReformaTaxType.IBS)!;
      expect(cbs.aliquota).toBe(0.088);
      expect(ibs.aliquota).toBe(0.001);
      expect(cbs.natureza).toBe(RateNature.DEVIDO);
    }
  });

  it('2029-2032: IBS em 10/20/30/40% de 17,7%', () => {
    const expected: Record<number, number> = {
      2029: 0.0177,
      2030: 0.0354,
      2031: 0.0531,
      2032: 0.0708,
    };
    for (const [ano, rate] of Object.entries(expected)) {
      const ibs = getAliquotaReferencia(Number(ano), ReformaTaxType.IBS)!;
      expect(ibs.aliquota).toBeCloseTo(rate, 4);
      expect(getAliquotaReferencia(Number(ano), ReformaTaxType.CBS)!.aliquota).toBe(0.088);
    }
  });

  it('2033: CBS 8,8% + IBS 17,7% = 26,5%', () => {
    const cbs = getAliquotaReferencia(2033, ReformaTaxType.CBS)!;
    const ibs = getAliquotaReferencia(2033, ReformaTaxType.IBS)!;
    expect(cbs.aliquota).toBe(0.088);
    expect(ibs.aliquota).toBe(0.177);
    expect(cbs.aliquota + ibs.aliquota).toBeCloseTo(0.265, 4);
  });
});
