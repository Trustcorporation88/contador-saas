/**
 * Tax Calculation Service
 * Motor de cálculo: IRPJ, CSLL, PIS, COFINS, ICMS, ISS
 * Regimes: Lucro Real, Lucro Presumido, Simples Nacional
 */

import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import { ReportService } from './reportService';
import { exportBalanceSheetToPdf, exportIncomeStatementToPdf } from './exportService';
import { TaxAdjustmentService } from './taxAdjustmentService';
import {
  TaxType, TaxRegime, TaxStatus, ApuracaoPeriodicidade,
  TAX_RATES, SIMPLES_ANEXO_I, SIMPLES_ANEXO_III,
  CalculateTaxDTO, TaxLineResult, TaxCalculationResult, SavedTaxCalculation,
  LucroRealMemoria,
} from '../models/dtos/taxDTO';

/**
 * Número de meses do período de apuração — o multiplicador do limite do adicional
 * de IRPJ (Lei 9.430/96 art. 4º): R$ 20.000 por mês apurado.
 *
 * Conta meses-calendário abrangidos, inclusive nas pontas: 01/01 a 31/03 = 3.
 * É o que a lei pede — o mês em que a empresa iniciou conta inteiro, ainda que
 * o período comece no dia 15.
 *
 * As datas são lidas da string YYYY-MM-DD, sem passar por new Date(): construir
 * Date a partir de 'YYYY-MM-DD' interpreta em UTC e, em fuso negativo, pode
 * devolver o mês anterior — a mesma classe de erro que já trocou a competência
 * do DAS neste projeto.
 *
 * Lança quando o período é ausente ou incoerente: um adicional de IRPJ calculado
 * sobre um limite adivinhado é pior que uma falha explícita.
 */
export function mesesDoPeriodo(periodStart: string, periodEnd: string): number {
  const parse = (valor: string, campo: string): { ano: number; mes: number } => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((valor ?? '').trim());
    if (!match) {
      throw Object.assign(
        new Error(
          `${campo} ausente ou inválido ("${valor}"). O adicional de IRPJ depende ` +
          'do número de meses apurados (R$ 20.000 por mês), então o período é ' +
          'obrigatório no formato YYYY-MM-DD.',
        ),
        { status: 400 },
      );
    }
    const ano = Number(match[1]);
    const mes = Number(match[2]);
    if (mes < 1 || mes > 12) {
      throw Object.assign(new Error(`${campo} tem mês inválido ("${valor}").`), { status: 400 });
    }
    return { ano, mes };
  };

  const inicio = parse(periodStart, 'period_start');
  const fim    = parse(periodEnd,   'period_end');

  const meses = (fim.ano - inicio.ano) * 12 + (fim.mes - inicio.mes) + 1;

  if (meses < 1) {
    throw Object.assign(
      new Error(`Período invertido: period_end (${periodEnd}) é anterior a period_start (${periodStart}).`),
      { status: 400 },
    );
  }

  // Apuração de IRPJ é mensal, trimestral ou anual — nunca mais de 12 meses.
  // Não bloqueio (pode ser uma consulta exploratória), mas registro: um período
  // longo por erro de digitação inflaria o limite e esconderia o adicional.
  if (meses > 12) {
    logger.warn('Período de apuração maior que 12 meses', {
      periodStart, periodEnd, meses,
      aviso: 'limite do adicional de IRPJ proporcional a um período fora do padrão legal',
    });
  }

  return meses;
}

/** Uma janela de apuração: o período sobre o qual IRPJ/CSLL são apurados. */
export interface JanelaApuracao {
  inicio: string;   // YYYY-MM-DD
  fim:    string;   // YYYY-MM-DD
  meses:  number;
}

/** Último dia do mês, sem passar por Date (evita deslocamento de fuso). */
function ultimoDiaDoMes(ano: number, mes: number): string {
  const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const dias = mes === 2 && bissexto ? 29 : diasPorMes[mes - 1];
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dias).padStart(2, '0')}`;
}

/**
 * Divide o período pedido nas janelas de apuração da periodicidade informada.
 *
 * O limite do adicional de IRPJ vale por período de apuração, não por consulta.
 * Pedir o ano inteiro de uma empresa que apura TRIMESTRALMENTE tem de produzir
 * quatro apurações somadas — cada uma com seu limite de R$ 60.000 — e não uma
 * apuração anual com limite de R$ 240.000. Com lucro de R$ 100.000 no 1º
 * trimestre e R$ 100.000 no 4º, a diferença é R$ 8.000 contra zero.
 *
 * Sem periodicidade informada, devolve uma única janela: o período como veio, que
 * é o comportamento histórico.
 */
export function janelasDeApuracao(
  periodStart: string,
  periodEnd: string,
  apuracao?: ApuracaoPeriodicidade,
): JanelaApuracao[] {
  const mesesTotais = mesesDoPeriodo(periodStart, periodEnd);

  if (!apuracao) {
    return [{ inicio: periodStart, fim: periodEnd, meses: mesesTotais }];
  }

  const passo = apuracao === ApuracaoPeriodicidade.MENSAL ? 1
    : apuracao === ApuracaoPeriodicidade.TRIMESTRAL ? 3
      : 12;

  // Janela única quando o período cabe nela — inclusive um período parcial
  // (empresa que abriu no meio do trimestre apura o trimestre que viveu).
  if (mesesTotais <= passo) {
    return [{ inicio: periodStart, fim: periodEnd, meses: mesesTotais }];
  }

  const [anoInicio, mesInicio] = periodStart.split('-').map(Number);
  const janelas: JanelaApuracao[] = [];

  for (let offset = 0; offset < mesesTotais; offset += passo) {
    const mesAbsoluto = (mesInicio - 1) + offset;
    const ano = anoInicio + Math.floor(mesAbsoluto / 12);
    const mes = (mesAbsoluto % 12) + 1;

    const mesesRestantes = Math.min(passo, mesesTotais - offset);
    const fimAbsoluto = (mesInicio - 1) + offset + mesesRestantes - 1;
    const anoFim = anoInicio + Math.floor(fimAbsoluto / 12);
    const mesFim = (fimAbsoluto % 12) + 1;

    // A primeira janela preserva o dia de início informado; as demais começam no
    // dia 1. A última preserva o dia final informado.
    const inicio = offset === 0 ? periodStart : `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fim = offset + mesesRestantes >= mesesTotais
      ? periodEnd
      : ultimoDiaDoMes(anoFim, mesFim);

    janelas.push({ inicio, fim, meses: mesesRestantes });
  }

  return janelas;
}

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

    const prejuizoAcumulado =
      dto.prejuizo_fiscal_acumulado ?? dto.prejuizoFiscalAcumulado ?? 0;

    // Simples não tem adicional de IRPJ nem LALUR: caminho curto, sem exigir
    // período e sem apuração por janela.
    if (taxRegime === TaxRegime.SIMPLES) {
      const dreSimples = await ReportService.getIncomeStatement(companyId, periodStart, periodEnd);
      const receita = dto.revenues
        ?? (dreSimples as any).gross_revenue ?? (dreSimples as any).revenues ?? 0;
      return TaxCalculationService.montarResultado({
        companyId, taxRegime, periodStart, periodEnd,
        revenues: receita,
        expenses:  (dreSimples as any).total_expenses ?? (dreSimples as any).expenses ?? 0,
        netIncome: (dreSimples as any).net_income     ?? (dreSimples as any).netIncome ?? 0,
        taxes: TaxCalculationService.calcSimples(receita, dto.rbt12 ?? receita),
      });
    }

    // Lucro Real e Presumido: uma apuração por janela, somadas. Com periodicidade
    // omitida há uma janela só — o comportamento histórico.
    const janelas = janelasDeApuracao(periodStart, periodEnd, dto.apuracao);

    let receitaTotal   = 0;
    let despesaTotal   = 0;
    let lucroTotal     = 0;
    let prejuizoRestante = prejuizoAcumulado;
    const porJanela: TaxLineResult[][] = [];

    for (const janela of janelas) {
      const dre = await ReportService.getIncomeStatement(companyId, janela.inicio, janela.fim);

      // dto.revenues sobrescreve o DRE (override de teste/simulação). Com mais de
      // uma janela ele valeria para cada uma, o que multiplicaria a receita — por
      // isso só é aceito quando a apuração é de janela única.
      const revenues = (janelas.length === 1 ? dto.revenues : undefined)
        ?? (dre as any).gross_revenue ?? (dre as any).revenues ?? 0;
      const expenses  = (dre as any).total_expenses ?? (dre as any).expenses ?? 0;
      const netIncome = (dre as any).net_income     ?? (dre as any).netIncome ?? 0;

      receitaTotal += revenues;
      despesaTotal += expenses;
      lucroTotal   += netIncome;

      if (taxRegime === TaxRegime.LUCRO_PRESUMIDO) {
        porJanela.push(TaxCalculationService.calcLucroPresumido(
          revenues, dto.atividade ?? 'servicos', janela.meses, issRate, icmsRate,
        ));
        continue;
      }

      // Lucro Real: adições/exclusões do LALUR registradas na janela, e prejuízo
      // fiscal consumido janela a janela (o saldo não pode ser usado duas vezes).
      const ajustes = await TaxCalculationService.ajustesDaJanela(companyId, janela);
      const memoria = TaxCalculationService.lucroReal(
        netIncome, ajustes.adicoes, ajustes.exclusoes, prejuizoRestante,
      );
      prejuizoRestante = Math.max(0, prejuizoRestante - memoria.prejuizo_compensado);

      porJanela.push(TaxCalculationService.calcLucroReal(
        revenues, memoria, ajustes.quantidade > 0, janela.meses, issRate, icmsRate,
      ));
    }

    return TaxCalculationService.montarResultado({
      companyId, taxRegime, periodStart, periodEnd,
      revenues: receitaTotal, expenses: despesaTotal, netIncome: lucroTotal,
      taxes: TaxCalculationService.somarJanelas(porJanela, janelas),
    });
  }

  /**
   * Ajustes do LALUR da janela. Falha de leitura não pode virar "sem ajustes":
   * seguir adiante calcularia IRPJ sobre lucro contábil como se não houvesse
   * LALUR registrado, entregando um número menor sem avisar ninguém.
   */
  private static async ajustesDaJanela(
    companyId: string,
    janela: JanelaApuracao,
  ): Promise<{ adicoes: number; exclusoes: number; quantidade: number }> {
    try {
      return await TaxAdjustmentService.totals(companyId, janela.inicio, janela.fim);
    } catch (error) {
      // Tabela ausente (ambiente sem a migração 024) é o único caso tolerado, e
      // mesmo assim fica registrado.
      const message = (error as Error).message ?? '';
      if (/tax_adjustments/i.test(message) && /does not exist|no such table/i.test(message)) {
        logger.warn('tax_adjustments indisponível — apurando sem ajustes do LALUR', {
          companyId, janela: `${janela.inicio}..${janela.fim}`,
        });
        return { adicoes: 0, exclusoes: 0, quantidade: 0 };
      }
      throw error;
    }
  }

  /**
   * Soma as apurações das janelas por tipo de imposto.
   *
   * Somar é o que a apuração trimestral significa: o IRPJ do ano é a soma dos
   * quatro trimestres, cada um com seu limite de adicional. Mantém UMA linha por
   * imposto porque tax_calculations tem chave única
   * (company_id, tax_type, period_start, period_end) — quatro linhas de IRPJ com
   * o mesmo período colidiriam no save().
   */
  private static somarJanelas(
    porJanela: TaxLineResult[][],
    janelas: JanelaApuracao[],
  ): TaxLineResult[] {
    if (porJanela.length === 1) return porJanela[0];

    const agregado = new Map<TaxType, TaxLineResult>();
    const notasPorTipo = new Map<TaxType, string[]>();

    porJanela.forEach((linhas, indice) => {
      const janela = janelas[indice];
      for (const linha of linhas) {
        const atual = agregado.get(linha.tax_type);
        if (!atual) {
          agregado.set(linha.tax_type, { ...linha, notes: undefined });
        } else {
          atual.base      += linha.base;
          atual.amount     = Math.round((atual.amount + linha.amount) * 100) / 100;
          atual.surcharge  = Math.round(((atual.surcharge ?? 0) + (linha.surcharge ?? 0)) * 100) / 100;
        }
        if (linha.notes) {
          const lista = notasPorTipo.get(linha.tax_type) ?? [];
          lista.push(`${janela.inicio}..${janela.fim}: ${linha.notes}`);
          notasPorTipo.set(linha.tax_type, lista);
        }
      }
    });

    return [...agregado.values()].map(linha => ({
      ...linha,
      notes: [
        `Apuração em ${janelas.length} janelas`,
        ...(notasPorTipo.get(linha.tax_type) ?? []),
      ].join(' | '),
    }));
  }

  /** Monta o envelope do resultado (aliases camelCase e totais). */
  private static montarResultado(dados: {
    companyId: string;
    taxRegime: TaxRegime;
    periodStart: string;
    periodEnd: string;
    revenues: number;
    expenses: number;
    netIncome: number;
    taxes: TaxLineResult[];
  }): TaxCalculationResult {
    // Aliases camelCase para compatibilidade com testes e API
    const taxes = dados.taxes.map(t => ({ ...t, type: t.tax_type, taxableBase: t.base }));

    // totalTax = soma dos amounts (surcharge já incluso no amount de cada imposto)
    const totalTax = taxes.reduce((s, t) => s + t.amount, 0);
    const effectiveRate = dados.revenues > 0 ? totalTax / dados.revenues : 0;

    return {
      company_id:   dados.companyId,
      companyId:    dados.companyId,
      tax_regime:   dados.taxRegime,
      regime:       dados.taxRegime,
      period_start: dados.periodStart,
      periodStart:  dados.periodStart,
      period_end:   dados.periodEnd,
      periodEnd:    dados.periodEnd,
      generated_at: new Date().toISOString(),
      revenues:     dados.revenues,
      expenses:     dados.expenses,
      net_income:   dados.netIncome,
      taxes,
      total_tax:    totalTax,
      totalAmount:  totalTax,
      effective_rate: Math.round(effectiveRate * 10000) / 10000,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LUCRO CONTÁBIL → LUCRO REAL (LALUR)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Lucro real = lucro líquido contábil + adições − exclusões − compensação de
   * prejuízo fiscal, esta limitada a 30% do lucro já ajustado (Lei 9.065/95
   * art. 15).
   *
   * Antes, o IRPJ do Lucro Real era calculado direto sobre o net_income do DRE —
   * lucro contábil tratado como se fosse lucro real. Quando não há ajustes
   * registrados nem prejuízo informado, o resultado é o mesmo de antes: quem não
   * usa o LALUR não vê número mudar.
   */
  static lucroReal(
    lucroContabil: number,
    adicoes: number,
    exclusoes: number,
    prejuizoDisponivel: number,
  ): LucroRealMemoria {
    const lucroAjustado = lucroContabil + adicoes - exclusoes;

    // Compensação só faz sentido sobre lucro positivo, e o limite de 30% incide
    // sobre o lucro ajustado, não sobre o lucro contábil.
    const base = Math.max(0, lucroAjustado);
    const limiteCompensacao = base * TAX_RATES.PREJUIZO_FISCAL.limite_compensacao;
    const prejuizoCompensado = Math.min(Math.max(0, prejuizoDisponivel), limiteCompensacao);

    return {
      lucro_contabil:      lucroContabil,
      adicoes,
      exclusoes,
      lucro_ajustado:      lucroAjustado,
      prejuizo_disponivel: Math.max(0, prejuizoDisponivel),
      prejuizo_compensado: prejuizoCompensado,
      limite_compensacao:  limiteCompensacao,
      lucro_real:          base - prejuizoCompensado,
    };
  }

  /** Nota auditável da transição contábil → real, para o contador conferir. */
  private static notaLucroReal(m: LucroRealMemoria, houveAjustes: boolean): string | undefined {
    const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const partes: string[] = [];

    if (houveAjustes) {
      partes.push(
        `Lucro contábil R$ ${brl(m.lucro_contabil)} + adições R$ ${brl(m.adicoes)} ` +
        `− exclusões R$ ${brl(m.exclusoes)} = R$ ${brl(m.lucro_ajustado)}`,
      );
    } else {
      // Explicitar a ausência importa: o número é igual ao lucro contábil porque
      // não há LALUR registrado, e não porque a base seja essa por definição.
      partes.push('Sem adições/exclusões registradas no período — base igual ao lucro contábil');
    }

    if (m.prejuizo_disponivel > 0) {
      partes.push(
        `Prejuízo compensado R$ ${brl(m.prejuizo_compensado)} ` +
        `(disponível R$ ${brl(m.prejuizo_disponivel)}, limite 30% = R$ ${brl(m.limite_compensacao)})`,
      );
    }

    return partes.join(' | ');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ADICIONAL DE IRPJ — regra única, usada por Lucro Real e Lucro Presumido
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Adicional de 10% sobre o que exceder R$ 20.000 por mês do período apurado.
   *
   * Existe como helper para a regra viver em um só lugar: antes ela estava
   * duplicada em calcLucroReal e calcLucroPresumido, e as duas cópias erravam
   * igual — aplicavam o limite mensal sobre o lucro do período inteiro.
   */
  private static adicionalIrpj(
    baseIrpj: number,
    mesesApurados: number,
  ): { limite: number; excedente: number; adicional: number } {
    const limite    = TAX_RATES.IRPJ.surcharge_threshold_monthly * mesesApurados;
    const excedente = Math.max(0, baseIrpj - limite);
    return { limite, excedente, adicional: excedente * TAX_RATES.IRPJ.surcharge_rate };
  }

  /**
   * Nota auditável: o contador precisa conseguir conferir o limite aplicado sem
   * abrir o código. Também explicita quando NÃO houve adicional e por quê — antes
   * esse caso ficava sem nota nenhuma e era indistinguível de um cálculo faltando.
   */
  private static notaAdicionalIrpj(
    limite: number,
    excedente: number,
    mesesApurados: number,
  ): string {
    const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const mes = mesesApurados === 1 ? 'mês' : 'meses';
    const memoria = `limite R$ ${brl(limite)} = R$ ${brl(TAX_RATES.IRPJ.surcharge_threshold_monthly)} × ${mesesApurados} ${mes}`;
    return excedente > 0
      ? `Adicional 10% sobre R$ ${brl(excedente)} (${memoria})`
      : `Sem adicional de IRPJ — lucro dentro do ${memoria}`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LUCRO REAL
  // ───────────────────────────────────────────────────────────────────────────

  private static calcLucroReal(
    revenues: number,
    memoria: LucroRealMemoria,
    houveAjustes: boolean,
    mesesApurados: number,
    issRate = 0.05,
    icmsRate = 0.12,
  ): TaxLineResult[] {
    const results: TaxLineResult[] = [];
    // Base legal: lucro real (contábil ± LALUR − prejuízo), não lucro contábil.
    const lucroTributavel = Math.max(0, memoria.lucro_real);

    // IRPJ: 15% + adicional de 10% sobre o que exceder R$ 20.000 POR MÊS apurado.
    const irpjBase = lucroTributavel;
    const irpjAmount = irpjBase * TAX_RATES.IRPJ.base_rate;
    const { limite, excedente, adicional } =
      TaxCalculationService.adicionalIrpj(irpjBase, mesesApurados);
    const notaBase = TaxCalculationService.notaLucroReal(memoria, houveAjustes);
    // amount inclui a sobretaxa (total IRPJ a pagar)
    results.push({
      tax_type: TaxType.IRPJ,
      base: irpjBase,
      rate: TAX_RATES.IRPJ.base_rate,
      amount: Math.round((irpjAmount + adicional) * 100) / 100,
      surcharge: Math.round(adicional * 100) / 100,
      notes: [notaBase, TaxCalculationService.notaAdicionalIrpj(limite, excedente, mesesApurados)]
        .filter(Boolean).join(' | '),
    });

    // CSLL: 9% sobre a mesma base ajustada (a base de cálculo da CSLL também é o
    // lucro ajustado, não o lucro contábil).
    results.push({
      tax_type: TaxType.CSLL,
      base: lucroTributavel,
      rate: TAX_RATES.CSLL.rate,
      amount: Math.round(lucroTributavel * TAX_RATES.CSLL.rate * 100) / 100,
      notes: notaBase,
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
    mesesApurados: number,
    issRate = 0.05,
    icmsRate = 0.12,
  ): TaxLineResult[] {
    const results: TaxLineResult[] = [];
    const presuncao = TAX_RATES.PRESUNCAO[atividade];
    const lucroPresumido = revenues * presuncao;

    // IRPJ: 15% sobre o lucro presumido + adicional de 10% sobre o que exceder
    // R$ 20.000 por mês apurado (mesma regra do Lucro Real).
    const irpjAmount = lucroPresumido * TAX_RATES.IRPJ.base_rate;
    const { limite, excedente, adicional } =
      TaxCalculationService.adicionalIrpj(lucroPresumido, mesesApurados);
    // amount inclui a sobretaxa (total IRPJ a pagar)
    const notaAdicional = TaxCalculationService.notaAdicionalIrpj(limite, excedente, mesesApurados);
    results.push({
      tax_type: TaxType.IRPJ,
      base: lucroPresumido,
      rate: TAX_RATES.IRPJ.base_rate,
      amount: Math.round((irpjAmount + adicional) * 100) / 100,
      surcharge: Math.round(adicional * 100) / 100,
      notes: `Presunção ${(presuncao * 100).toFixed(0)}% sobre R$ ${revenues.toFixed(2)}`
        + (notaAdicional ? ` | ${notaAdicional}` : ''),
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
      // tax.amount já inclui a sobretaxa (surcharge) — não somar novamente
      const amount = tax.amount;
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

  static async generateDASGuide(result: TaxCalculationResult): Promise<{ filename: string; buffer: Buffer }> {
    const total = result.total_tax ?? result.totalAmount ?? 0;
    const period = `${result.period_start}__${result.period_end}`;
    const filename = `das_${result.company_id}_${period}.pdf`;

    const report = {
      date_from: result.period_start,
      date_to: result.period_end,
      revenues: [{ code: 'DAS', name: 'DAS Simples Nacional', balance: total }],
      expenses: [],
      gross_revenue: result.revenues ?? 0,
      total_expenses: 0,
      net_income: total,
    } as any;

    const buffer = exportIncomeStatementToPdf(report);
    return { filename, buffer };
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
