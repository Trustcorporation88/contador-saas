/**
 * healthScoreService.ts
 * Calcula o Score de Saúde Financeira (0–1000) a partir dos dados
 * já disponíveis no backend (BalanceSheet + DRE).
 *
 * Nenhum sistema de contabilidade no mundo faz isso em tempo real.
 */
import type { BalanceSheet, DRE } from '../types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface HealthDimension {
  label:       string;
  score:       number;   // 0–250
  maxScore:    number;   // 250
  value:       string;   // valor formatado p/ exibição
  description: string;   // explicação curta
  status:      'great' | 'ok' | 'warning' | 'danger';
}

export interface HealthScore {
  total:      number;   // 0–1000
  grade:      'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  label:      string;
  color:      string;   // tailwind text color
  bgColor:    string;   // tailwind bg color
  ringColor:  string;   // stroke color para SVG
  dimensions: HealthDimension[];
  updatedAt:  string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sumItems(items: { balance?: number }[] | undefined): number {
  return (items ?? []).reduce((a, i) => a + (i.balance ?? 0), 0);
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function ratio(value: number): string {
  return value.toFixed(2);
}

function dimStatus(score: number, max: number): HealthDimension['status'] {
  const r = score / max;
  if (r >= 0.8)  return 'great';
  if (r >= 0.5)  return 'ok';
  if (r >= 0.25) return 'warning';
  return 'danger';
}

// ─── Dimensões ───────────────────────────────────────────────────────────────

function calcLiquidez(balance: BalanceSheet | undefined): HealthDimension {
  const ac = sumItems(balance?.ativo?.circulante);
  const pc = sumItems(balance?.passivo?.circulante);
  const lc = pc > 0 ? ac / pc : null;

  let score = 0;
  if      (lc === null) score = 0;
  else if (lc >= 2.0)   score = 250;
  else if (lc >= 1.5)   score = 210;
  else if (lc >= 1.0)   score = 160;
  else if (lc >= 0.5)   score = 80;
  else                  score = 20;

  return {
    label:       'Liquidez Corrente',
    score,
    maxScore:    250,
    value:       lc !== null ? ratio(lc) : '—',
    description: lc === null
      ? 'Sem dados suficientes'
      : lc >= 1.5 ? 'Excelente capacidade de pagar dívidas de curto prazo'
      : lc >= 1.0 ? 'Liquidez adequada para honrar compromissos'
      : 'Atenção: passivo circulante elevado em relação ao ativo',
    status: dimStatus(score, 250),
  };
}

function calcRentabilidade(
  balance: BalanceSheet | undefined,
  dre:     DRE         | undefined,
): HealthDimension {
  const receita = dre?.receitaLiquida    ?? 0;
  const lucro   = dre?.lucroLiquido      ?? 0;
  const ativo   = balance?.ativo?.total  ?? 0;

  // Margem líquida (principal) + ROA como bônus
  const margem = receita > 0 ? (lucro / receita) * 100 : null;
  const roa    = ativo   > 0 ? (lucro / ativo)   * 100 : null;

  let score = 0;
  if      (margem === null) score = 0;
  else if (margem >= 20)    score = 250;
  else if (margem >= 10)    score = 200;
  else if (margem >= 5)     score = 150;
  else if (margem >= 0)     score = 80;
  else                      score = 10;

  return {
    label:       'Rentabilidade',
    score,
    maxScore:    250,
    value:       margem !== null ? pct(margem) : '—',
    description: margem === null
      ? 'Sem dados suficientes'
      : margem >= 15 ? `Margem excelente${roa ? ` · ROA ${roa.toFixed(1)}%` : ''}`
      : margem >=  5 ? 'Margem positiva e saudável'
      : margem >=  0 ? 'Margem baixa — monitorar custos'
      : 'Empresa operando com prejuízo',
    status: dimStatus(score, 250),
  };
}

function calcEndividamento(balance: BalanceSheet | undefined): HealthDimension {
  const passivo = balance?.passivo?.total ?? 0;
  const ativo   = balance?.ativo?.total   ?? 0;
  const endiv   = ativo > 0 ? (passivo / ativo) * 100 : null;

  let score = 0;
  if      (endiv === null) score = 125; // sem dados → neutro
  else if (endiv <= 30)    score = 250;
  else if (endiv <= 50)    score = 200;
  else if (endiv <= 70)    score = 130;
  else if (endiv <= 90)    score = 60;
  else                     score = 10;

  return {
    label:       'Endividamento',
    score,
    maxScore:    250,
    value:       endiv !== null ? pct(endiv) : '—',
    description: endiv === null
      ? 'Sem dados suficientes'
      : endiv <= 40 ? 'Nível de dívida saudável e controlado'
      : endiv <= 70 ? 'Endividamento moderado — acompanhar'
      : 'Alavancagem elevada — risco financeiro alto',
    status: dimStatus(score, 250),
  };
}

function calcEficiencia(
  balance: BalanceSheet | undefined,
  dre:     DRE         | undefined,
): HealthDimension {
  const receita = dre?.receitaLiquida   ?? 0;
  const ativo   = balance?.ativo?.total ?? 0;
  const giro    = ativo > 0 ? receita / ativo : null;

  // Despesas operacionais como % da receita
  const despesas = (dre?.custoVendas ?? 0) + (dre?.despesasFinanceiras ?? 0);
  const efOp     = receita > 0 ? (1 - despesas / receita) * 100 : null;

  let score = 0;
  if      (giro === null) score = 0;
  else if (giro >= 1.5)   score = 250;
  else if (giro >= 1.0)   score = 200;
  else if (giro >= 0.5)   score = 140;
  else if (giro >= 0.2)   score = 70;
  else                    score = 20;

  return {
    label:       'Eficiência Operacional',
    score,
    maxScore:    250,
    value:       giro !== null ? ratio(giro) : '—',
    description: giro === null
      ? 'Sem dados suficientes'
      : giro >= 1.0 ? `Bom aproveitamento dos ativos${efOp ? ` · Ef. ${efOp.toFixed(0)}%` : ''}`
      : giro >= 0.5 ? 'Eficiência operacional adequada'
      : 'Ativos subutilizados em relação à receita gerada',
    status: dimStatus(score, 250),
  };
}

// ─── Grade ───────────────────────────────────────────────────────────────────

function toGrade(total: number): HealthScore['grade'] {
  if (total >= 900) return 'A+';
  if (total >= 750) return 'A';
  if (total >= 600) return 'B';
  if (total >= 450) return 'C';
  if (total >= 300) return 'D';
  return 'F';
}

function gradeLabel(grade: HealthScore['grade']): string {
  const map: Record<HealthScore['grade'], string> = {
    'A+': 'Saúde Financeira Excelente',
    'A':  'Saúde Financeira Muito Boa',
    'B':  'Saúde Financeira Boa',
    'C':  'Saúde Financeira Regular',
    'D':  'Saúde Financeira Fraca',
    'F':  'Saúde Financeira Crítica',
  };
  return map[grade];
}

function gradeColors(grade: HealthScore['grade']) {
  const map: Record<HealthScore['grade'], { text: string; bg: string; ring: string }> = {
    'A+': { text: 'text-emerald-700', bg: 'bg-emerald-50',  ring: '#10b981' },
    'A':  { text: 'text-green-700',   bg: 'bg-green-50',    ring: '#22c55e' },
    'B':  { text: 'text-blue-700',    bg: 'bg-blue-50',     ring: '#3b82f6' },
    'C':  { text: 'text-amber-700',   bg: 'bg-amber-50',    ring: '#f59e0b' },
    'D':  { text: 'text-orange-700',  bg: 'bg-orange-50',   ring: '#f97316' },
    'F':  { text: 'text-red-700',     bg: 'bg-red-50',      ring: '#ef4444' },
  };
  return map[grade];
}

// ─── Exportação principal ────────────────────────────────────────────────────

export function calcHealthScore(
  balance: BalanceSheet | undefined,
  dre:     DRE         | undefined,
): HealthScore {
  const d1 = calcLiquidez(balance);
  const d2 = calcRentabilidade(balance, dre);
  const d3 = calcEndividamento(balance);
  const d4 = calcEficiencia(balance, dre);

  const total = d1.score + d2.score + d3.score + d4.score;
  const grade = toGrade(total);
  const { text, bg, ring } = gradeColors(grade);

  return {
    total,
    grade,
    label:      gradeLabel(grade),
    color:      text,
    bgColor:    bg,
    ringColor:  ring,
    dimensions: [d1, d2, d3, d4],
    updatedAt:  new Date().toISOString(),
  };
}
