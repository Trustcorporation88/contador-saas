/**
 * Reforma Tributária Service — motor de cálculo de CBS/IBS
 *
 * Paralelo e aditivo ao TaxCalculationService (IRPJ/CSLL/PIS/COFINS/ICMS/ISS
 * legados) — não altera nada do motor existente. As duas convivem lado a
 * lado durante toda a transição (2026-2032).
 *
 * Prioridade das alíquotas:
 *  1. Linha em `reforma_aliquotas_anuais` (cadastro oficial / admin)
 *  2. Fallback de referência de mercado (CBS ~8,8% / IBS cheio ~17,7% com
 *     curva 2026–2033 alinhada a LC 214/2025 + benchmarks de mercado)
 *
 * 2026 tem valores legais fixados (0,9% + 0,1%). Pós-2026 o Senado fixa
 * anualmente as alíquotas de referência (TCU / Comitê Gestor) — o fallback
 * serve só para simulação até o cadastro oficial.
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
  ReformaAliquotaFonte,
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

/** CBS de referência plena (projeção de mercado até resolução do Senado) */
const CBS_REF_CHEIA = 0.088;
/** IBS de referência plena (~17,7% → CBS+IBS ≈ 26,5% em 2033) */
const IBS_REF_CHEIA = 0.177;
/** Alíquotas legais da fase de testes (LC 214/2025) */
const CBS_TESTE = 0.009;
const IBS_TESTE = 0.001;

/**
 * Fração da alíquota cheia de IBS na transição ICMS/ISS (EC 132 / LC 214).
 * 2029–2032: 10% / 20% / 30% / 40%; legado ICMS/ISS: 90% / 80% / 70% / 60%.
 */
const TRANSICAO_IBS_FRACAO: Record<number, number> = {
  2029: 0.10,
  2030: 0.20,
  2031: 0.30,
  2032: 0.40,
};

interface ResolvedAliquota {
  aliquota: number;
  natureza: RateNature;
  aplicavel_simples: boolean;
  fonte_legal: string;
  fonte_aliquota: ReformaAliquotaFonte;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function faseLabel(ano: number): string {
  if (ano === FASE_TESTES_INICIO) return 'Fase de testes (compensável)';
  if (ano >= FASE_COBRANCA_INICIO && ano <= 2028) return 'CBS plena + IBS simbólico';
  if (ano >= FASE_TRANSICAO_ICMS_ISS_INICIO && ano <= FASE_TRANSICAO_ICMS_ISS_FIM) {
    const pct = (TRANSICAO_IBS_FRACAO[ano] ?? 0) * 100;
    return `Transição ICMS/ISS → IBS (${pct.toFixed(0)}%)`;
  }
  if (ano >= FASE_DEFINITIVA_INICIO) return 'Sistema definitivo (CBS + IBS)';
  return 'Fora do cronograma';
}

/**
 * Alíquotas de referência para simulação quando o banco ainda não tem
 * cadastro do ano. 2026 = fato legal; demais = benchmark de mercado.
 */
export function getAliquotaReferencia(ano: number, taxType: ReformaTaxType): ResolvedAliquota | null {
  if (ano < FASE_TESTES_INICIO) return null;
  if (taxType === ReformaTaxType.IS) return null;

  if (ano === FASE_TESTES_INICIO) {
    return {
      aliquota: taxType === ReformaTaxType.CBS ? CBS_TESTE : IBS_TESTE,
      natureza: RateNature.INFORMATIVO,
      aplicavel_simples: false,
      fonte_legal: 'LC 214/2025, art. 348 — fase de testes (valores legais)',
      fonte_aliquota: 'REFERENCIA_MERCADO',
    };
  }

  // 2027–2028: CBS cheia de referência; IBS permanece 0,1%
  if (ano <= 2028) {
    if (taxType === ReformaTaxType.CBS) {
      return {
        aliquota: CBS_REF_CHEIA,
        natureza: RateNature.DEVIDO,
        aplicavel_simples: true,
        fonte_legal: 'Referência de mercado CBS ~8,8% (Senado fixa anualmente — LC 214/2025 art. 18/349)',
        fonte_aliquota: 'REFERENCIA_MERCADO',
      };
    }
    return {
      aliquota: IBS_TESTE,
      natureza: RateNature.DEVIDO,
      aplicavel_simples: true,
      fonte_legal: 'LC 214/2025 — IBS 0,1% em 2027-2028',
      fonte_aliquota: 'REFERENCIA_MERCADO',
    };
  }

  // 2029–2032: CBS cheia + IBS fracionado da alíquota cheia
  if (ano <= FASE_TRANSICAO_ICMS_ISS_FIM) {
    if (taxType === ReformaTaxType.CBS) {
      return {
        aliquota: CBS_REF_CHEIA,
        natureza: RateNature.DEVIDO,
        aplicavel_simples: true,
        fonte_legal: 'Referência de mercado CBS ~8,8% (transição ICMS/ISS)',
        fonte_aliquota: 'REFERENCIA_MERCADO',
      };
    }
    const fracao = TRANSICAO_IBS_FRACAO[ano] ?? 0;
    return {
      aliquota: round4(IBS_REF_CHEIA * fracao),
      natureza: RateNature.DEVIDO,
      aplicavel_simples: true,
      fonte_legal: `Referência de mercado IBS ${(fracao * 100).toFixed(0)}% de ~17,7% (EC 132 / LC 214 transição)`,
      fonte_aliquota: 'REFERENCIA_MERCADO',
    };
  }

  // 2033+: sistema definitivo
  if (taxType === ReformaTaxType.CBS) {
    return {
      aliquota: CBS_REF_CHEIA,
      natureza: RateNature.DEVIDO,
      aplicavel_simples: true,
      fonte_legal: 'Referência de mercado CBS ~8,8% (sistema definitivo)',
      fonte_aliquota: 'REFERENCIA_MERCADO',
    };
  }
  return {
    aliquota: IBS_REF_CHEIA,
    natureza: RateNature.DEVIDO,
    aplicavel_simples: true,
    fonte_legal: 'Referência de mercado IBS ~17,7% (sistema definitivo; CBS+IBS ≈ 26,5%)',
    fonte_aliquota: 'REFERENCIA_MERCADO',
  };
}

function getTransicaoReferencia(ano: number): { percentual_ibs: number; percentual_icms_iss_legado: number } | null {
  if (ano >= FASE_DEFINITIVA_INICIO) {
    return { percentual_ibs: 1, percentual_icms_iss_legado: 0 };
  }
  const fracao = TRANSICAO_IBS_FRACAO[ano];
  if (fracao === undefined) return null;
  return {
    percentual_ibs: fracao,
    percentual_icms_iss_legado: round4(1 - fracao),
  };
}

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

  static async resolveAliquota(ano: number, taxType: ReformaTaxType): Promise<ResolvedAliquota | null> {
    const row = await this.getAliquota(ano, taxType);
    if (row) {
      return {
        aliquota: Number(row.aliquota),
        natureza: row.natureza,
        aplicavel_simples: Boolean(row.aplicavel_simples),
        fonte_legal: row.fonte_legal ?? 'Cadastro em reforma_aliquotas_anuais',
        fonte_aliquota: 'CADASTRADA',
      };
    }
    return getAliquotaReferencia(ano, taxType);
  }

  static async getTransicaoAno(ano: number): Promise<ReformaTransicaoAno | null> {
    const db = await getDatabase();
    const row = await db('reforma_transicao_icms_iss').where({ ano }).first();
    return (row as ReformaTransicaoAno) ?? null;
  }

  static async resolveTransicao(ano: number): Promise<{ percentual_ibs: number; percentual_icms_iss_legado: number } | null> {
    const row = await this.getTransicaoAno(ano);
    if (row) {
      return {
        percentual_ibs: Number(row.percentual_ibs),
        percentual_icms_iss_legado: Number(row.percentual_icms_iss_legado),
      };
    }
    return getTransicaoReferencia(ano);
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
    if (ano < FASE_TESTES_INICIO) {
      return {
        applicable: false,
        motivo: 'Reforma tributária ainda não vigente (início em 2026).',
        taxes: [],
      };
    }

    // 2026: Simples Nacional fica de fora da fase de testes (LC 214)
    if (ano === FASE_TESTES_INICIO && regime === TaxRegime.SIMPLES) {
      return {
        applicable: false,
        motivo: 'Simples Nacional fica fora da fase de testes de 2026 — entra no novo modelo a partir de 2027 (LC 214/2025).',
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
    const resolved = await this.resolveAliquota(ano, taxType);

    if (!resolved) {
      return {
        tax_type: taxType,
        base: revenues,
        rate: 0,
        amount: 0,
        natureza: RateNature.DEVIDO,
        collectible: false,
        aliquota_publicada: false,
        notes: `Alíquota de ${taxType} para ${ano} indisponível.`,
      };
    }

    const base = revenues;
    const notesParts: string[] = [];

    if (resolved.fonte_aliquota === 'REFERENCIA_MERCADO' && ano > FASE_TESTES_INICIO) {
      notesParts.push(
        `Alíquota de referência de mercado — o Senado ainda fixa anualmente o valor oficial (${resolved.fonte_legal}).`,
      );
    } else if (resolved.fonte_legal) {
      notesParts.push(resolved.fonte_legal);
    }

    // 2029-2032: anota a curva de substituição ICMS/ISS → IBS
    if (taxType === ReformaTaxType.IBS && ano >= FASE_TRANSICAO_ICMS_ISS_INICIO && ano <= FASE_TRANSICAO_ICMS_ISS_FIM) {
      const transicao = await this.resolveTransicao(ano);
      if (transicao) {
        const pctIbs = (transicao.percentual_ibs * 100).toFixed(0);
        const pctLegado = (transicao.percentual_icms_iss_legado * 100).toFixed(0);
        notesParts.push(`Transição: IBS ${pctIbs}% da alíquota cheia; ICMS/ISS legado ${pctLegado}%.`);
        if (icmsIssLegadoAmount > 0) {
          const parcelaMigrada = icmsIssLegadoAmount * transicao.percentual_ibs;
          notesParts.push(`Parcela migrada estimada do legado: R$ ${parcelaMigrada.toFixed(2)}.`);
        }
      }
    }

    if (regime === TaxRegime.SIMPLES && ano >= FASE_COBRANCA_INICIO) {
      notesParts.push(
        'Simples: projeção da carga CBS/IBS sobre a receita (opção pelo novo modelo / DAS híbrido conforme LC 214). Não substitui o cálculo do DAS por anexo.',
      );
    }

    const rate = resolved.aliquota;
    const amount = Math.round(base * rate * 100) / 100;
    const collectible = resolved.natureza === RateNature.DEVIDO;

    if (!collectible) {
      notesParts.unshift(`Fase de testes ${ano} — calculado e destacado, sem recolhimento em dinheiro (compensável).`);
    }

    return {
      tax_type: taxType,
      base,
      rate,
      amount,
      natureza: resolved.natureza,
      collectible,
      aliquota_publicada: true,
      fonte_aliquota: resolved.fonte_aliquota,
      notes: notesParts.join(' '),
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
    const aliquotaEfetiva = taxes.reduce((s, t) => s + (t.aliquota_publicada ? t.rate : 0), 0);

    const transicao = applicable ? await this.resolveTransicao(dto.ano) : null;

    return {
      ano: dto.ano,
      regime: dto.regime,
      applicable,
      motivo_nao_aplicavel: motivo,
      revenues,
      taxes,
      total_devido: Math.round(totalDevido * 100) / 100,
      total_informativo: Math.round(totalInformativo * 100) / 100,
      aliquota_efetiva: Math.round(aliquotaEfetiva * 10000) / 10000,
      fase: applicable ? faseLabel(dto.ano) : undefined,
      percentual_ibs_transicao: transicao?.percentual_ibs,
      percentual_icms_iss_legado: transicao?.percentual_icms_iss_legado,
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
