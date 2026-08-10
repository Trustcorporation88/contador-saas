/**
 * Lucro Real — base legal (LALUR) e periodicidade da apuração.
 *
 * Cobre três defeitos que estavam juntos no motor de cálculo:
 *
 *  1. A base do IRPJ era o lucro CONTÁBIL. Por lei é o lucro real: lucro líquido
 *     ± adições/exclusões do LALUR, e só então compensado com prejuízo fiscal de
 *     períodos anteriores, limitado a 30% (Lei 9.065/95 art. 15).
 *  2. As adições e exclusões não existiam de fato — o DTO estava no código, mas
 *     sem tabela, sem endpoint e sem nenhum consumidor.
 *  3. Não havia periodicidade de apuração. O limite do adicional de IRPJ vale por
 *     período de apuração, não por consulta: pedir o ano de quem apura
 *     trimestralmente tem de somar quatro apurações, cada uma com seu limite.
 *
 * Os valores esperados vêm da legislação, não do que o código devolve hoje.
 */

jest.mock('../../src/config/database', () => ({ getDatabase: jest.fn() }));

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getIncomeStatement = jest.fn();
jest.mock('../../src/services/reportService', () => ({
  ReportService: { getIncomeStatement: (...args: unknown[]) => getIncomeStatement(...args) },
}));

const totals = jest.fn();
jest.mock('../../src/services/taxAdjustmentService', () => ({
  TaxAdjustmentService: { totals: (...args: unknown[]) => totals(...args) },
}));

import {
  TaxCalculationService, janelasDeApuracao,
} from '../../src/services/taxCalculationService';
import { TaxType, TaxRegime, ApuracaoPeriodicidade } from '../../src/models/dtos/taxDTO';

const SEM_AJUSTES = { adicoes: 0, exclusoes: 0, quantidade: 0 };

/** DRE fixo para qualquer período. */
function dreFixo(netIncome: number, revenues = 1_000_000) {
  getIncomeStatement.mockImplementation(async () => ({
    revenues, expenses: revenues - netIncome, netIncome,
  }));
}

/** DRE que varia por janela — permite testar apuração trimestral de verdade. */
function drePorInicio(mapa: Record<string, number>, revenuesPorJanela = 250_000) {
  getIncomeStatement.mockImplementation(async (_id: string, inicio: string) => ({
    revenues: revenuesPorJanela,
    expenses: 0,
    netIncome: mapa[inicio] ?? 0,
  }));
}

const baseDTO = {
  companyId: 'company-1',
  regime: TaxRegime.LUCRO_REAL,
  issRate: 0.05,
  icmsRate: 0.12,
};

const irpjDe = (r: Awaited<ReturnType<typeof TaxCalculationService.calculate>>) =>
  r.taxes.find(t => t.tax_type === TaxType.IRPJ)!;
const csllDe = (r: Awaited<ReturnType<typeof TaxCalculationService.calculate>>) =>
  r.taxes.find(t => t.tax_type === TaxType.CSLL)!;

beforeEach(() => {
  getIncomeStatement.mockReset();
  totals.mockReset();
  totals.mockResolvedValue(SEM_AJUSTES);
});

// ── Item 3: base legal do Lucro Real ───────────────────────────────────────────

describe('lucroReal() — lucro contábil ajustado pelo LALUR', () => {

  it('sem ajustes nem prejuízo, o lucro real é o lucro contábil', () => {
    const m = TaxCalculationService.lucroReal(200_000, 0, 0, 0);
    expect(m.lucro_real).toBe(200_000);
    expect(m.prejuizo_compensado).toBe(0);
  });

  it('adições aumentam a base; exclusões reduzem', () => {
    const m = TaxCalculationService.lucroReal(200_000, 50_000, 30_000, 0);
    expect(m.lucro_ajustado).toBe(220_000);
    expect(m.lucro_real).toBe(220_000);
  });

  it('compensação de prejuízo é limitada a 30% do lucro ajustado', () => {
    // Lucro ajustado 200.000 → limite 60.000, ainda que haja 500.000 disponíveis.
    const m = TaxCalculationService.lucroReal(200_000, 0, 0, 500_000);
    expect(m.limite_compensacao).toBe(60_000);
    expect(m.prejuizo_compensado).toBe(60_000);
    expect(m.lucro_real).toBe(140_000);
  });

  it('compensa apenas o saldo existente quando ele é menor que o limite', () => {
    const m = TaxCalculationService.lucroReal(200_000, 0, 0, 10_000);
    expect(m.prejuizo_compensado).toBe(10_000);
    expect(m.lucro_real).toBe(190_000);
  });

  it('o limite de 30% incide sobre o lucro JÁ ajustado, não sobre o contábil', () => {
    // Contábil 100.000 + adições 100.000 = 200.000 → limite 60.000 (não 30.000).
    const m = TaxCalculationService.lucroReal(100_000, 100_000, 0, 500_000);
    expect(m.limite_compensacao).toBe(60_000);
    expect(m.lucro_real).toBe(140_000);
  });

  it('prejuízo do próprio período não vira base negativa', () => {
    const m = TaxCalculationService.lucroReal(-50_000, 0, 0, 100_000);
    expect(m.lucro_real).toBe(0);
    expect(m.prejuizo_compensado).toBe(0);
  });
});

describe('IRPJ e CSLL passam a incidir sobre o lucro real', () => {

  it('adições do LALUR aumentam o IRPJ e a CSLL', async () => {
    dreFixo(200_000);
    totals.mockResolvedValue({ adicoes: 100_000, exclusoes: 0, quantidade: 2 });

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
    });

    const irpj = irpjDe(r);
    // Base 300.000; limite anual 240.000 → adicional (300k − 240k) × 10% = 6.000
    expect(irpj.base).toBe(300_000);
    expect(irpj.surcharge).toBeCloseTo(6_000, 2);
    expect(irpj.amount).toBeCloseTo(300_000 * 0.15 + 6_000, 2);
    // A CSLL usa a mesma base ajustada.
    expect(csllDe(r).amount).toBeCloseTo(300_000 * 0.09, 2);
  });

  it('prejuízo informado reduz a base, respeitando os 30%', async () => {
    dreFixo(200_000);

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      prejuizo_fiscal_acumulado: 500_000,
    });

    // 200.000 − 60.000 (limite 30%) = 140.000
    expect(irpjDe(r).base).toBe(140_000);
    expect(irpjDe(r).amount).toBeCloseTo(140_000 * 0.15, 2);
  });

  it('sem ajustes registrados o número NÃO muda, e a nota diz por quê', async () => {
    dreFixo(200_000);

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
    });

    // Quem não usa o LALUR não pode ver o imposto mudar por causa desta feature.
    expect(irpjDe(r).base).toBe(200_000);
    expect(irpjDe(r).amount).toBeCloseTo(30_000, 2);
    expect(irpjDe(r).notes).toMatch(/Sem adições\/exclusões registradas/);
  });

  it('a nota traz a memória de cálculo da transição contábil → real', async () => {
    dreFixo(200_000);
    totals.mockResolvedValue({ adicoes: 50_000, exclusoes: 20_000, quantidade: 3 });

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      prejuizo_fiscal_acumulado: 100_000,
    });

    const notes = irpjDe(r).notes ?? '';
    expect(notes).toMatch(/Lucro contábil R\$ 200\.000,00/);
    expect(notes).toMatch(/adições R\$ 50\.000,00/);
    expect(notes).toMatch(/exclusões R\$ 20\.000,00/);
    expect(notes).toMatch(/Prejuízo compensado/);
  });

  it('falha de leitura dos ajustes NÃO é tratada como ausência de ajustes', async () => {
    dreFixo(200_000);
    totals.mockRejectedValue(new Error('connection terminated unexpectedly'));

    // Seguir adiante entregaria IRPJ sobre lucro contábil, menor, sem avisar.
    await expect(TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
    })).rejects.toThrow(/connection terminated/);
  });

  it('tabela ausente (ambiente sem a migração) é tolerada e registrada', async () => {
    dreFixo(200_000);
    totals.mockRejectedValue(new Error('relation "tax_adjustments" does not exist'));

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
    });
    expect(irpjDe(r).amount).toBeCloseTo(30_000, 2);
  });
});

// ── Item 1: periodicidade da apuração ─────────────────────────────────────────

describe('janelasDeApuracao()', () => {

  it('sem periodicidade informada, devolve o período como janela única', () => {
    const j = janelasDeApuracao('2025-01-01', '2025-12-31');
    expect(j).toHaveLength(1);
    expect(j[0]).toEqual({ inicio: '2025-01-01', fim: '2025-12-31', meses: 12 });
  });

  it('TRIMESTRAL divide o ano em 4 janelas de 3 meses', () => {
    const j = janelasDeApuracao('2025-01-01', '2025-12-31', ApuracaoPeriodicidade.TRIMESTRAL);
    expect(j).toHaveLength(4);
    expect(j[0]).toEqual({ inicio: '2025-01-01', fim: '2025-03-31', meses: 3 });
    expect(j[1]).toEqual({ inicio: '2025-04-01', fim: '2025-06-30', meses: 3 });
    expect(j[2]).toEqual({ inicio: '2025-07-01', fim: '2025-09-30', meses: 3 });
    expect(j[3]).toEqual({ inicio: '2025-10-01', fim: '2025-12-31', meses: 3 });
  });

  it('MENSAL divide o ano em 12 janelas', () => {
    const j = janelasDeApuracao('2025-01-01', '2025-12-31', ApuracaoPeriodicidade.MENSAL);
    expect(j).toHaveLength(12);
    expect(j[1]).toEqual({ inicio: '2025-02-01', fim: '2025-02-28', meses: 1 });
  });

  it('respeita ano bissexto no fim da janela de fevereiro', () => {
    const j = janelasDeApuracao('2024-01-01', '2024-03-31', ApuracaoPeriodicidade.MENSAL);
    expect(j[1].fim).toBe('2024-02-29');
  });

  it('ANUAL sobre o ano é janela única', () => {
    expect(janelasDeApuracao('2025-01-01', '2025-12-31', ApuracaoPeriodicidade.ANUAL)).toHaveLength(1);
  });

  it('período menor que a janela não é dividido (empresa recém-aberta)', () => {
    const j = janelasDeApuracao('2025-11-01', '2025-12-31', ApuracaoPeriodicidade.TRIMESTRAL);
    expect(j).toHaveLength(1);
    expect(j[0].meses).toBe(2);
  });

  it('preserva os dias informados nas pontas', () => {
    const j = janelasDeApuracao('2025-03-15', '2025-12-20', ApuracaoPeriodicidade.TRIMESTRAL);
    expect(j[0].inicio).toBe('2025-03-15');
    expect(j[j.length - 1].fim).toBe('2025-12-20');
  });
});

describe('Periodicidade muda o adicional devido — o caso que motivou o ajuste', () => {

  /**
   * Mesmo fato econômico, dois resultados legítimos e diferentes: R$ 100.000 de
   * lucro no 1º trimestre e R$ 100.000 no 4º.
   */
  const lucroConcentrado = {
    '2025-01-01': 100_000,
    '2025-04-01': 0,
    '2025-07-01': 0,
    '2025-10-01': 100_000,
  };

  it('TRIMESTRAL: cada trimestre excede R$ 60.000 → adicional de R$ 8.000', async () => {
    drePorInicio(lucroConcentrado);

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      apuracao: ApuracaoPeriodicidade.TRIMESTRAL,
    });

    const irpj = irpjDe(r);
    // (100.000 − 60.000) × 10% = 4.000 no 1º trimestre + 4.000 no 4º
    expect(irpj.surcharge).toBeCloseTo(8_000, 2);
    // IRPJ = 15% sobre 200.000 (soma dos trimestres) + 8.000
    expect(irpj.amount).toBeCloseTo(200_000 * 0.15 + 8_000, 2);
    expect(irpj.notes).toMatch(/Apuração em 4 janelas/);
  });

  it('ANUAL: R$ 200.000 fica sob o limite de R$ 240.000 → adicional zero', async () => {
    dreFixo(200_000);

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      apuracao: ApuracaoPeriodicidade.ANUAL,
    });

    expect(irpjDe(r).surcharge).toBe(0);
    expect(irpjDe(r).amount).toBeCloseTo(30_000, 2);
  });

  it('prejuízo em um trimestre não abate automaticamente o lucro de outro', async () => {
    drePorInicio({
      '2025-01-01': 200_000,
      '2025-04-01': -200_000,   // prejuízo
      '2025-07-01': 0,
      '2025-10-01': 0,
    });

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      apuracao: ApuracaoPeriodicidade.TRIMESTRAL,
    });

    // Somando o ano daria lucro zero e imposto zero. Na apuração trimestral o 1º
    // trimestre é tributado e o prejuízo do 2º vira saldo a compensar no futuro,
    // sujeito ao limite de 30% — não some.
    const irpj = irpjDe(r);
    expect(irpj.base).toBe(200_000);
    expect(irpj.surcharge).toBeCloseTo((200_000 - 60_000) * 0.10, 2);
  });

  it('o saldo de prejuízo informado não é usado duas vezes entre janelas', async () => {
    drePorInicio({
      '2025-01-01': 100_000,
      '2025-04-01': 100_000,
      '2025-07-01': 0,
      '2025-10-01': 0,
    });

    const r = await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      apuracao: ApuracaoPeriodicidade.TRIMESTRAL,
      prejuizo_fiscal_acumulado: 40_000,
    });

    // 1º tri: limite 30% de 100.000 = 30.000 → compensa 30.000, sobra 10.000.
    // 2º tri: sobra 10.000 → compensa 10.000. Total compensado = 40.000.
    // Base somada = (100.000−30.000) + (100.000−10.000) = 160.000
    expect(irpjDe(r).base).toBe(160_000);
  });

  it('cada janela consulta o DRE do seu próprio período', async () => {
    drePorInicio(lucroConcentrado);

    await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      apuracao: ApuracaoPeriodicidade.TRIMESTRAL,
    });

    // Sem isso a "apuração trimestral" usaria o resultado do ano em cada janela.
    expect(getIncomeStatement).toHaveBeenCalledTimes(4);
    expect(getIncomeStatement).toHaveBeenCalledWith('company-1', '2025-01-01', '2025-03-31');
    expect(getIncomeStatement).toHaveBeenCalledWith('company-1', '2025-10-01', '2025-12-31');
  });

  it('os ajustes do LALUR são buscados por janela, não pelo ano', async () => {
    drePorInicio(lucroConcentrado);

    await TaxCalculationService.calculate({
      ...baseDTO, periodStart: '2025-01-01', periodEnd: '2025-12-31',
      apuracao: ApuracaoPeriodicidade.TRIMESTRAL,
    });

    expect(totals).toHaveBeenCalledTimes(4);
    expect(totals).toHaveBeenCalledWith('company-1', '2025-04-01', '2025-06-30');
  });
});
