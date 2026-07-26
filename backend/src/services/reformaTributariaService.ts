/**
 * Reforma Tributária Service — motor de cálculo de CBS/IBS
 *
 * Paralelo e aditivo ao TaxCalculationService (IRPJ/CSLL/PIS/COFINS/ICMS/ISS
 * legados) — não altera nada do motor existente. As duas convivem lado a
 * lado durante toda a transição (2026-2032).
 *
 * Alíquotas de CBS/IBS são lidas de `reforma_aliquotas_anuais` (versionadas
 * por ano-calendário) — nunca hardcoded, pois o governo ainda não fixou por
 * lei os valores de referência pós-2027.
 */

import { getDatabase } from '../config/database';
import { ReportService } from './reportService';
import { TaxCalculationService } from './taxCalculationService';
import { TaxRegime, TaxType, TaxLineResult, TaxCalculationResult } from '../models/dtos/taxDTO';
import {
  ReformaTaxType,
  RateNature,
  ReformaAliquotaAnual,
  ReformaTransicaoAno,
  CalculateReformaDTO,
  ProjecaoReformaDTO,
  ReformaCalculationResult,
  ReformaTaxLineResult,
  UpsertAliquotaReformaDTO,
} from '../models/dtos/reformaTributariaDTO';

const FASE_TESTES_INICIO = 2026;
const FASE_COBRANCA_INICIO = 2027;
const FASE_TRANSICAO_ICMS_ISS_INICIO = 2029;
const FASE_TRANSICAO_ICMS_ISS_FIM = 2032;
const FASE_DEFINITIVA_INICIO = 2033;

export class ReformaTributariaService {
  // ───────────────────────────────────────────────────────────────────────
  // Leitura das alíquotas versionadas
  // ───────────────────────────────────────────────────────────────────────

  static async getAliquota(ano: number, taxType: ReformaTaxType): Promise<ReformaAliquotaAnual | null> {
    const db = await getDatabase();
    const row = await db('reforma_aliquotas_anuais')
      .where({ ano, tax_type: taxType })
      .first();
    return (row as ReformaAliquotaAnual) ?? null;
  }

  static async getTransicaoAno(ano: number): Promise<ReformaTransicaoAno | null> {
    const db = await getDatabase();
    const row = await db('reforma_transicao_icms_iss').where({ ano }).first();
    return (row as ReformaTransicaoAno) ?? null;
  }

  static async upsertAliquota(dto: UpsertAliquotaReformaDTO): Promise<ReformaAliquotaAnual> {
    const db = await getDatabase();
    const [row] = await db('reforma_aliquotas_anuais')
      .insert({
        ano: dto.ano,
        tax_type: dto.tax_type,
        aliquota: dto.aliquota,
        natureza: dto.natureza,
        aplicavel_simples: dto.aplicavel_simples ?? false,
        fonte_legal: dto.fonte_legal ?? null,
        vigencia_inicio: dto.vigencia_inicio ?? null,
        vigencia_fim: dto.vigencia_fim ?? null,
      })
      .onConflict(['ano', 'tax_type'])
      .merge({
        aliquota: dto.aliquota,
        natureza: dto.natureza,
        aplicavel_simples: dto.aplicavel_simples ?? false,
        fonte_legal: dto.fonte_legal ?? null,
        vigencia_inicio: dto.vigencia_inicio ?? null,
        vigencia_fim: dto.vigencia_fim ?? null,
        updated_at: new Date(),
      })
      .returning('*');
    return row as ReformaAliquotaAnual;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Motor de cálculo — decide a regra vigente por ano-calendário
  // ───────────────────────────────────────────────────────────────────────

  static async calcReformaTributaria(
    revenues: number,
    ano: number,
    regime: TaxRegime,
    icmsIssLegadoAmount = 0,
  ): Promise<{ applicable: boolean; motivo?: string; taxes: ReformaTaxLineResult[] }> {
    // Antes de 2026: reforma ainda não vigente
    if (ano < FASE_TESTES_INICIO) {
      return {
        applicable: false,
        motivo: 'Reforma tributária ainda não vigente (início em 2026).',
        taxes: [],
      };
    }

    // 2026: Simples Nacional fica de fora da fase de testes
    if (ano === FASE_TESTES_INICIO && regime === TaxRegime.SIMPLES) {
      return {
        applicable: false,
        motivo: 'Simples Nacional fica fora da fase de testes de 2026 — só entra no novo modelo em 2027 (LC 214/2025).',
        taxes: [],
      };
    }

    const taxes: ReformaTaxLineResult[] = [];

    for (const taxType of [ReformaTaxType.CBS, ReformaTaxType.IBS]) {
      const linha = await this.calcularLinha(revenues, ano, regime, taxType, icmsIssLegadoAmount);
      taxes.push(linha);
    }

    return { applicable: true, taxes };
  }

  private static async calcularLinha(
    revenues: number,
    ano: number,
    regime: TaxRegime,
    taxType: ReformaTaxType,
    icmsIssLegadoAmount: number,
  ): Promise<ReformaTaxLineResult> {
    const aliquotaRow = await this.getAliquota(ano, taxType);

    if (!aliquotaRow) {
      // Alíquota do ano ainda não cadastrada — nunca "chuta" um valor.
      return {
        tax_type: taxType,
        base: revenues,
        rate: 0,
        amount: 0,
        natureza: RateNature.DEVIDO,
        collectible: false,
        aliquota_publicada: false,
        notes: `Alíquota de referência de ${taxType} para ${ano} ainda não publicada pelo Comitê Gestor do IBS/Receita Federal — cadastre em reforma_aliquotas_anuais assim que disponível.`,
      };
    }

    let base = revenues;
    let notes: string | undefined;

    // 2029-2032: fase de transição do IBS substituindo ICMS/ISS gradualmente.
    // A parcela de ICMS/ISS legado que já "virou" IBS é somada à base do IBS
    // "puro" da reforma, refletindo a curva de substituição na projeção.
    if (taxType === ReformaTaxType.IBS && ano >= FASE_TRANSICAO_ICMS_ISS_INICIO && ano <= FASE_TRANSICAO_ICMS_ISS_FIM) {
      const transicao = await this.getTransicaoAno(ano);
      if (transicao && icmsIssLegadoAmount > 0) {
        const parcelaMigrada = icmsIssLegadoAmount * Number(transicao.percentual_ibs);
        base = revenues; // alíquota de referência do IBS já incide sobre a receita
        notes = `Transição ${(Number(transicao.percentual_ibs) * 100).toFixed(0)}% ICMS/ISS→IBS neste ano. Parcela migrada estimada: R$ ${parcelaMigrada.toFixed(2)}.`;
      }
    }

    const rate = Number(aliquotaRow.aliquota);
    const amount = Math.round(base * rate * 100) / 100;
    const collectible = aliquotaRow.natureza === RateNature.DEVIDO;

    if (!notes) {
      notes = collectible
        ? undefined
        : `Fase de testes ${ano} — calculado e destacado, sem recolhimento em dinheiro (compensável).`;
    }

    return {
      tax_type: taxType,
      base,
      rate,
      amount,
      natureza: aliquotaRow.natureza,
      collectible,
      aliquota_publicada: true,
      notes,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Cálculo para uma empresa (busca DRE real ou usa override de simulação)
  // ───────────────────────────────────────────────────────────────────────

  static async calculate(dto: CalculateReformaDTO): Promise<ReformaCalculationResult> {
    const companyId = dto.company_id ?? '';
    let revenues = dto.revenues;

    if (revenues === undefined && companyId && dto.period_start && dto.period_end) {
      const dre = await ReportService.getIncomeStatement(companyId, dto.period_start, dto.period_end);
      revenues = (dre as any).gross_revenue ?? (dre as any).revenues ?? 0;
    }
    revenues = revenues ?? 0;

    const { applicable, motivo, taxes } = await this.calcReformaTributaria(
      revenues,
      dto.ano,
      dto.regime,
      dto.icms_iss_legado_amount ?? 0,
    );

    const totalDevido = taxes.filter(t => t.collectible).reduce((s, t) => s + t.amount, 0);
    const totalInformativo = taxes.filter(t => !t.collectible).reduce((s, t) => s + t.amount, 0);

    return {
      ano: dto.ano,
      regime: dto.regime,
      applicable,
      motivo_nao_aplicavel: motivo,
      revenues,
      taxes,
      total_devido: Math.round(totalDevido * 100) / 100,
      total_informativo: Math.round(totalInformativo * 100) / 100,
      generated_at: new Date().toISOString(),
    };
  }

  static async projetar(dto: ProjecaoReformaDTO): Promise<ReformaCalculationResult[]> {
    const anoInicio = Math.min(dto.ano_inicio, dto.ano_fim);
    const anoFim = Math.max(dto.ano_inicio, dto.ano_fim);

    let revenues = dto.revenues;
    if (revenues === undefined && dto.company_id && dto.period_start && dto.period_end) {
      const dre = await ReportService.getIncomeStatement(dto.company_id, dto.period_start, dto.period_end);
      revenues = (dre as any).gross_revenue ?? (dre as any).revenues ?? 0;
    }
    revenues = revenues ?? 0;

    const resultados: ReformaCalculationResult[] = [];
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      resultados.push(
        await this.calculate({
          company_id: dto.company_id,
          ano,
          regime: dto.regime,
          revenues,
        }),
      );
    }
    return resultados;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Persistência — reaproveita tax_calculations via TaxCalculationService.save()
  // ───────────────────────────────────────────────────────────────────────

  static async save(
    result: ReformaCalculationResult,
    companyId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    if (!result.applicable) {
      throw Object.assign(
        new Error(result.motivo_nao_aplicavel ?? 'Reforma tributária não aplicável neste ano/regime.'),
        { status: 422 },
      );
    }

    const legacyResult: TaxCalculationResult = {
      company_id: companyId,
      tax_regime: result.regime,
      period_start: periodStart,
      period_end: periodEnd,
      generated_at: result.generated_at,
      revenues: result.revenues,
      expenses: 0,
      net_income: result.revenues,
      taxes: result.taxes.map((t): TaxLineResult => ({
        tax_type: t.tax_type as unknown as TaxType, // CBS/IBS/IS aceitos pelo CHECK constraint estendido (019b)
        base: t.base,
        rate: t.rate,
        amount: t.amount,
        notes: t.notes,
      })),
      total_tax: result.total_devido + result.total_informativo,
      effective_rate: result.revenues > 0
        ? (result.total_devido + result.total_informativo) / result.revenues
        : 0,
    };

    return TaxCalculationService.save(legacyResult);
  }
}
