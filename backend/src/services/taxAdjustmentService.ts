/**
 * Tax Adjustment Service — adições e exclusões do LALUR
 *
 * O lucro real não é o lucro contábil: é o lucro líquido do período ajustado
 * pelas adições (despesas indedutíveis, multas não compensatórias, brindes) e
 * exclusões (receitas não tributáveis, dividendos recebidos) previstas em lei,
 * e só então compensado com prejuízo fiscal de períodos anteriores.
 *
 * Antes deste serviço o TaxAdjustmentDTO existia sem nada atrás: sem tabela no
 * migrationRunner, sem endpoint e sem nenhum consumidor. O IRPJ do Lucro Real
 * saía calculado sobre o lucro contábil.
 */

import { getDatabase } from '../config/database';
import {
  AdjustmentType, CreateTaxAdjustmentDTO, TaxAdjustment,
} from '../models/dtos/taxDTO';

/** Soma de adições e exclusões de um período. */
export interface AdjustmentTotals {
  adicoes:   number;
  exclusoes: number;
  /** Quantidade de lançamentos considerados — distingue "zero" de "nenhum". */
  quantidade: number;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function assertPeriodo(periodStart: string, periodEnd: string): void {
  if (!DATA_ISO.test(periodStart ?? '') || !DATA_ISO.test(periodEnd ?? '')) {
    throw Object.assign(
      new Error('period_start e period_end são obrigatórios no formato YYYY-MM-DD.'),
      { status: 400 },
    );
  }
  if (periodEnd < periodStart) {
    throw Object.assign(
      new Error(`Período invertido: period_end (${periodEnd}) é anterior a period_start (${periodStart}).`),
      { status: 400 },
    );
  }
}

export class TaxAdjustmentService {

  static async create(
    companyId: string,
    userId: string | null,
    dto: CreateTaxAdjustmentDTO,
  ): Promise<TaxAdjustment> {
    assertPeriodo(dto.period_start, dto.period_end);

    if (!Object.values(AdjustmentType).includes(dto.adjustment_type)) {
      throw Object.assign(
        new Error(`adjustment_type inválido. Use: ${Object.values(AdjustmentType).join(', ')}`),
        { status: 400 },
      );
    }
    // Valor sempre positivo: o sinal vem do tipo. Aceitar negativo permitiria
    // registrar uma adição que se comporta como exclusão.
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw Object.assign(new Error('amount deve ser um número maior que zero.'), { status: 400 });
    }
    // O LALUR é livro fiscal: valor sem fundamentação não se sustenta em
    // fiscalização, então a justificativa é obrigatória de verdade.
    if (!dto.justification?.trim()) {
      throw Object.assign(
        new Error('justification é obrigatória — o LALUR exige a fundamentação de cada ajuste.'),
        { status: 400 },
      );
    }

    const db = await getDatabase();
    const [row] = await db('tax_adjustments')
      .insert({
        company_id:      companyId,
        period_start:    dto.period_start,
        period_end:      dto.period_end,
        adjustment_type: dto.adjustment_type,
        amount:          dto.amount,
        justification:   dto.justification.trim(),
        account_id:      dto.account_id ?? null,
        created_by:      userId,
      })
      .returning('*');

    return row as TaxAdjustment;
  }

  static async list(
    companyId: string,
    filtros?: { period_start?: string; period_end?: string },
  ): Promise<TaxAdjustment[]> {
    const db = await getDatabase();
    let q = db('tax_adjustments').where({ company_id: companyId });
    // Contidos na janela pedida — um ajuste do 1º trimestre aparece ao apurar o
    // trimestre e também ao apurar o ano.
    if (filtros?.period_start) q = q.where('period_start', '>=', filtros.period_start);
    if (filtros?.period_end)   q = q.where('period_end',   '<=', filtros.period_end);
    return q.orderBy(['period_start', 'created_at']) as Promise<TaxAdjustment[]>;
  }

  /**
   * Totais de adições e exclusões contidos na janela — o que o motor de cálculo
   * consome para chegar do lucro contábil ao lucro real.
   */
  static async totals(
    companyId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<AdjustmentTotals> {
    assertPeriodo(periodStart, periodEnd);
    const db = await getDatabase();

    const rows = await db('tax_adjustments')
      .where({ company_id: companyId })
      .where('period_start', '>=', periodStart)
      .where('period_end',   '<=', periodEnd)
      .select('adjustment_type')
      .sum({ total: 'amount' })
      .count({ qtd: 'id' })
      .groupBy('adjustment_type');

    const totals: AdjustmentTotals = { adicoes: 0, exclusoes: 0, quantidade: 0 };
    for (const row of rows as Array<Record<string, unknown>>) {
      const total = Number(row.total ?? 0);
      const qtd   = Number(row.qtd ?? 0);
      totals.quantidade += qtd;
      if (row.adjustment_type === AdjustmentType.ADDITION) totals.adicoes += total;
      else if (row.adjustment_type === AdjustmentType.EXCLUSION) totals.exclusoes += total;
    }
    return totals;
  }

  static async remove(companyId: string, id: string): Promise<boolean> {
    const db = await getDatabase();
    // company_id no WHERE, não só o id: sem isso um id de outra empresa seria
    // apagável a partir de qualquer tenant.
    const removed = await db('tax_adjustments').where({ id, company_id: companyId }).del();
    if (removed === 0) {
      throw Object.assign(new Error('Ajuste não encontrado.'), { status: 404 });
    }
    return true;
  }
}

export default TaxAdjustmentService;
