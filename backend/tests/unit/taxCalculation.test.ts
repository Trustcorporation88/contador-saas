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

// Sem ajustes do LALUR registrados: a base do Lucro Real é o próprio lucro
// contábil, que é o cenário destes testes. O comportamento COM ajustes tem
// arquivo próprio (lucroRealApuracao.test.ts).
jest.mock('../../src/services/taxAdjustmentService', () => ({
  TaxAdjustmentService: {
    totals: jest.fn().mockResolvedValue({ adicoes: 0, exclusoes: 0, quantidade: 0 }),
  },
}));

import { TaxCalculationService, mesesDoPeriodo } from '../../src/services/taxCalculationService';
import { TaxType, TaxRegime } from '../../src/models/dtos/taxDTO';

describe('TaxCalculationService', () => {

  /**
   * Alíquotas em DECIMAL. Antes estavam como inteiro (issRate: 5, icmsRate: 12) e
   * o serviço as trata como decimal — o ICMS saía a 1200% da receita (R$ 6 milhões
   * sobre R$ 500 mil). Nenhuma asserção pegava isso porque o único teste de total
   * comparava a soma dos impostos com ela mesma. O frontend sempre enviou decimal
   * (ImpostosPage usa '0.05'), então era erro só da fixture.
   */
  const baseDTO = {
    companyId:  'company-uuid-1',
    periodStart: '2025-01-01',
    periodEnd:   '2025-12-31',
    revenues:    500000,
    atividade:   'comercio' as const,
    issRate:     0.05,
    icmsRate:    0.12,
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

  // ── Adicional de IRPJ — limite por mês apurado ─────────────────────────────

  /**
   * Lei 9.430/96 art. 4º e RIR/2018 art. 622: o adicional de 10% incide sobre o
   * que exceder R$ 20.000 MULTIPLICADO pelo número de meses do período apurado.
   * Logo: R$ 20.000 no mês, R$ 60.000 no trimestre, R$ 240.000 no ano.
   *
   * Os valores abaixo vêm da legislação, não do que o código devolve hoje. O
   * mock do DRE fixa netIncome em R$ 200.000, então o período é a variável.
   */
  describe('Adicional de IRPJ — limite proporcional aos meses apurados', () => {

    const irpjDe = async (periodStart: string, periodEnd: string) => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO, periodStart, periodEnd, regime: TaxRegime.LUCRO_REAL,
      });
      return result.taxes.find(t => t.type === TaxType.IRPJ)!;
    };

    it('ano inteiro: lucro de R$ 200.000 NÃO gera adicional (limite R$ 240.000)', async () => {
      const irpj = await irpjDe('2025-01-01', '2025-12-31');
      // Era exatamente aqui que o cálculo errava: o limite fixo de R$ 20.000
      // cobrava R$ 18.000 de adicional de quem não devia nada.
      expect(irpj.surcharge).toBe(0);
      expect(irpj.amount).toBeCloseTo(30000, 2);   // 200.000 × 15%
      expect(irpj.notes).toMatch(/Sem adicional/);
      expect(irpj.notes).toMatch(/240\.000,00/);
    });

    it('trimestre: limite R$ 60.000 → adicional de R$ 14.000', async () => {
      const irpj = await irpjDe('2025-01-01', '2025-03-31');
      // (200.000 − 60.000) × 10% = 14.000
      expect(irpj.surcharge).toBeCloseTo(14000, 2);
      expect(irpj.amount).toBeCloseTo(44000, 2);   // 30.000 + 14.000
      expect(irpj.notes).toMatch(/3 meses/);
    });

    it('mês único: limite R$ 20.000 → adicional de R$ 18.000', async () => {
      const irpj = await irpjDe('2025-05-01', '2025-05-31');
      // (200.000 − 20.000) × 10% = 18.000
      expect(irpj.surcharge).toBeCloseTo(18000, 2);
      expect(irpj.amount).toBeCloseTo(48000, 2);
      expect(irpj.notes).toMatch(/1 mês/);
    });

    it('período parcial conta o mês de início inteiro (15/03 a 31/12 = 10 meses)', async () => {
      const irpj = await irpjDe('2025-03-15', '2025-12-31');
      // Limite 10 × 20.000 = 200.000; lucro 200.000 → nada excede.
      expect(irpj.surcharge).toBe(0);
      expect(irpj.notes).toMatch(/10 meses/);
    });

    it('Lucro Presumido usa a mesma regra do Lucro Real', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO,
        revenues: 5_000_000,          // presunção comércio 8% → base R$ 400.000
        periodStart: '2025-01-01',
        periodEnd:   '2025-12-31',
        regime: TaxRegime.LUCRO_PRESUMIDO,
      });
      const irpj = result.taxes.find(t => t.type === TaxType.IRPJ)!;
      expect(irpj.taxableBase).toBeCloseTo(400000, 2);
      // (400.000 − 240.000) × 10% = 16.000
      expect(irpj.surcharge).toBeCloseTo(16000, 2);
      expect(irpj.amount).toBeCloseTo(400000 * 0.15 + 16000, 2);
    });

    it('a nota registra a memória de cálculo do limite', async () => {
      const irpj = await irpjDe('2025-01-01', '2025-03-31');
      // O contador precisa conferir o limite sem abrir o código.
      expect(irpj.notes).toMatch(/R\$ 20\.000,00 × 3 meses/);
      expect(irpj.notes).toMatch(/60\.000,00/);
    });
  });

  // ── Contagem de meses do período ───────────────────────────────────────────

  describe('mesesDoPeriodo()', () => {

    it('conta meses-calendário inclusive nas pontas', () => {
      expect(mesesDoPeriodo('2025-01-01', '2025-12-31')).toBe(12);
      expect(mesesDoPeriodo('2025-01-01', '2025-03-31')).toBe(3);
      expect(mesesDoPeriodo('2025-05-01', '2025-05-31')).toBe(1);
      expect(mesesDoPeriodo('2025-10-01', '2026-03-31')).toBe(6);  // vira o ano
    });

    it('não desloca o mês por fuso horário', () => {
      // new Date('2025-03-01') é meia-noite UTC = 21h de 28/02 em Brasília. Ler
      // da string evita essa classe de erro, que já trocou a competência do DAS.
      expect(mesesDoPeriodo('2025-03-01', '2025-03-31')).toBe(1);
      expect(mesesDoPeriodo('2025-01-01', '2025-01-01')).toBe(1);
    });

    it('recusa período ausente, inválido ou invertido', () => {
      expect(() => mesesDoPeriodo('', '2025-12-31')).toThrow(/period_start/);
      expect(() => mesesDoPeriodo('2025-01-01', '')).toThrow(/period_end/);
      expect(() => mesesDoPeriodo('01/01/2025', '2025-12-31')).toThrow(/YYYY-MM-DD/);
      expect(() => mesesDoPeriodo('2025-13-01', '2025-12-31')).toThrow(/mês inválido/);
      expect(() => mesesDoPeriodo('2025-12-31', '2025-01-01')).toThrow(/invertido/);
    });

    it('apuração sem período falha em vez de adivinhar o limite', async () => {
      // Um adicional de IRPJ calculado sobre limite adivinhado é pior que erro.
      await expect(TaxCalculationService.calculate({
        ...baseDTO, periodStart: '', periodEnd: '', regime: TaxRegime.LUCRO_REAL,
      })).rejects.toThrow(/período é\s+obrigatório|period_start/);
    });

    it('Simples não exige período — não tem adicional de IRPJ', async () => {
      const result = await TaxCalculationService.calculate({
        ...baseDTO, periodStart: '', periodEnd: '',
        regime: TaxRegime.SIMPLES, rbt12: 600000, revenues: 50000,
      });
      expect(result.totalAmount).toBeGreaterThan(0);
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
