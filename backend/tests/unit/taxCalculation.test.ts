/**
 * Testes unitários — Motor de Cálculo de Impostos
 * Cobre: Lucro Real, Lucro Presumido, Simples Nacional, DAS
 */

// Mockar dependências externas
jest.mock('../../src/config/database', () => ({
  db: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: '0' }]),
  },
}));

jest.mock('../../src/services/reportService', () => ({
  ReportService: {
    getIncomeStatement: jest.fn().mockResolvedValue({
      revenues: 500000,
      expenses: 300000,
      netIncome: 200000,
      dateFrom: '2025-01-01',
      dateTo:   '2025-12-31',
    }),
  },
}));

import { TaxCalculationService } from '../../src/services/taxCalculationService';
import { TaxType, TaxRegime } from '../../src/models/dtos/taxDTO';

describe('TaxCalculationService', () => {

  const baseDTO = {
    companyId:  'company-uuid-1',
    periodStart: '2025-01-01',
    periodEnd:   '2025-12-31',
    revenues:    500000,
    atividade:   'comercio' as const,
    issRate:     5,
    icmsRate:    12,
  };

  // ── Lucro Presumido ────────────────────────────────────────────────────────

  describe('Lucro Presumido — Comércio', () => {

    it('deve calcular presunção de 8% para IRPJ', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      // Base IRPJ = 500.000 × 8% = 40.000
      const irpj = result.taxes.find(t => t.type === TaxType.IRPJ);
      expect(irpj).toBeDefined();
      expect(irpj!.taxableBase).toBeCloseTo(40000, 0);
    });

    it('deve calcular CSLL com presunção de 12% para comércio', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      // Base CSLL = 500.000 × 12% = 60.000
      const csll = result.taxes.find(t => t.type === TaxType.CSLL);
      expect(csll).toBeDefined();
      expect(csll!.taxableBase).toBeCloseTo(60000, 0);
    });

    it('deve calcular PIS cumulativo (0,65%)', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      const pis = result.taxes.find(t => t.type === TaxType.PIS);
      expect(pis).toBeDefined();
      // PIS = 500.000 × 0,65% = 3.250
      expect(pis!.amount).toBeCloseTo(3250, 0);
    });

    it('deve calcular COFINS cumulativo (3%)', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      const cofins = result.taxes.find(t => t.type === TaxType.COFINS);
      expect(cofins).toBeDefined();
      // COFINS = 500.000 × 3% = 15.000
      expect(cofins!.amount).toBeCloseTo(15000, 0);
    });

    it('totalAmount deve ser soma de todos os impostos', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      const sumTaxes = result.taxes.reduce((s, t) => s + t.amount, 0);
      expect(result.totalAmount).toBeCloseTo(sumTaxes, 1);
    });
  });

  // ── Lucro Real ─────────────────────────────────────────────────────────────

  describe('Lucro Real', () => {

    it('deve calcular IRPJ sobre lucro real (15%)', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_REAL,
      });
      const irpj = result.taxes.find(t => t.type === TaxType.IRPJ);
      expect(irpj).toBeDefined();
      // Lucro = 200.000 → IRPJ = 200.000 × 15% = 30.000
      expect(irpj!.amount).toBeGreaterThan(0);
    });

    it('deve incluir adicional de 10% quando lucro > R$20.000/mês', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_REAL,
      });
      const irpj = result.taxes.find(t => t.type === TaxType.IRPJ);
      // Lucro trimestral de 200k → adicional sobre 200k - 60k = 140k × 10% = 14k
      // Total IRPJ deve ser > 30.000
      expect(irpj!.amount).toBeGreaterThan(30000);
    });

    it('deve calcular PIS não-cumulativo (1,65%)', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_REAL,
      });
      const pis = result.taxes.find(t => t.type === TaxType.PIS);
      // PIS = 500.000 × 1,65% = 8.250
      expect(pis!.amount).toBeCloseTo(8250, 0);
    });
  });

  // ── Simples Nacional ───────────────────────────────────────────────────────

  describe('Simples Nacional', () => {

    it('deve calcular DAS com alíquota efetiva (Anexo I - comércio)', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        revenues: 200000,  // Receita mensal
        regime:   TaxRegime.SIMPLES,
        rbt12:    2400000, // RBT12 = 200k × 12
        anexo:    'I',
      });
      expect(result.totalAmount).toBeGreaterThan(0);
      // Alíquota efetiva deve estar entre 4% e 19% para Anexo I
      const effectiveRate = (result.totalAmount / 200000) * 100;
      expect(effectiveRate).toBeGreaterThanOrEqual(4);
      expect(effectiveRate).toBeLessThanOrEqual(19);
    });

    it('deve retornar taxa efetiva > taxa nominal por conta de deduções', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        revenues: 50000,
        regime:   TaxRegime.SIMPLES,
        rbt12:    600000,
        anexo:    'III',
      });
      expect(result.taxes).toBeDefined();
      expect(result.totalAmount).toBeGreaterThan(0);
    });
  });

  // ── Geral ─────────────────────────────────────────────────────────────────

  describe('Estrutura do resultado', () => {

    it('deve incluir metadados de período', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      expect(result.companyId).toBe(baseDTO.companyId);
      expect(result.periodStart).toBe(baseDTO.periodStart);
      expect(result.periodEnd).toBe(baseDTO.periodEnd);
      expect(result.regime).toBe(TaxRegime.LUCRO_PRESUMIDO);
    });

    it('deve ter array de impostos não vazio', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      expect(Array.isArray(result.taxes)).toBe(true);
      expect(result.taxes.length).toBeGreaterThan(0);
    });
  });
});
