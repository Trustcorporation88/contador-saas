/**
 * indicadoresFinanceirosService.ts
 * Catálogo e cálculo dos principais indicadores financeiros (FP&A)
 * a partir de Balanço + DRE da empresa ativa.
 *
 * Indicadores de mercado (valuation / dividendos) ficam no catálogo
 * educacional até haver cotação ou política de dividendos cadastrada.
 */
import type { BalanceSheet, DRE } from '../types';
import { formatDecimalBR, formatPercentBR } from '../utils/formatters';

export type IndicadorCategoria =
  | 'margens'
  | 'rentabilidade'
  | 'capital'
  | 'estrutura'
  | 'dividendos'
  | 'valuation';

export type IndicadorStatus = 'great' | 'ok' | 'warning' | 'danger' | 'na';

export interface IndicadorResultado {
  id: string;
  categoria: IndicadorCategoria;
  nome: string;
  descricao: string;
  formula: string;
  /** Destaque no topo (margens principais) */
  destaque?: boolean;
  valor: number | null;
  valorFormatado: string;
  unidade: 'percent' | 'ratio' | 'years';
  status: IndicadorStatus;
  interpretacao: string;
  disponivel: boolean;
  motivoIndisponivel?: string;
}

export interface IndicadoresContexto {
  balance?: BalanceSheet;
  dre?: DRE;
}

export const CATEGORIA_META: Record<
  IndicadorCategoria,
  { titulo: string; subtitulo: string }
> = {
  margens: {
    titulo: 'Margens',
    subtitulo: 'Quanto da receita sobra em cada etapa do resultado',
  },
  rentabilidade: {
    titulo: 'Rentabilidade e retorno sobre o capital',
    subtitulo: 'Eficiência em gerar lucro sobre o capital empregado',
  },
  capital: {
    titulo: 'Intensidade de capital',
    subtitulo: 'Investimento em ativos frente à geração de receita e caixa',
  },
  estrutura: {
    titulo: 'Estrutura de capital e saúde financeira',
    subtitulo: 'Capacidade de pagar dívidas e grau de alavancagem',
  },
  dividendos: {
    titulo: 'Indicadores de dividendos',
    subtitulo: 'Política de distribuição de lucro aos sócios/acionistas',
  },
  valuation: {
    titulo: 'Indicadores de valuation',
    subtitulo: 'Valor de mercado relativo à capacidade de gerar resultado',
  },
};

function sumItems(items: { balance?: number }[] | undefined): number {
  return (items ?? []).reduce((a, i) => a + (i.balance ?? 0), 0);
}

function statusFromThresholds(
  value: number | null,
  { great, ok, warning }: { great: number; ok: number; warning: number },
  higherIsBetter = true,
): IndicadorStatus {
  if (value === null || !Number.isFinite(value)) return 'na';
  if (higherIsBetter) {
    if (value >= great) return 'great';
    if (value >= ok) return 'ok';
    if (value >= warning) return 'warning';
    return 'danger';
  }
  if (value <= great) return 'great';
  if (value <= ok) return 'ok';
  if (value <= warning) return 'warning';
  return 'danger';
}

function fmt(value: number | null, unidade: IndicadorResultado['unidade']): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (unidade === 'percent') return formatPercentBR(value);
  if (unidade === 'years') return formatDecimalBR(value, ' anos');
  return formatDecimalBR(value, 'x');
}

/**
 * Calcula o conjunto de principais indicadores financeiros.
 * Usa apenas dados contábeis já disponíveis (Balanço + DRE).
 */
export function calcIndicadoresFinanceiros(ctx: IndicadoresContexto): IndicadorResultado[] {
  const { balance, dre } = ctx;

  const receita = dre?.receitaLiquida ?? 0;
  const custoVendas = dre?.custoVendas ?? 0;
  const lucroBruto = dre?.lucroBruto ?? (receita - custoVendas);
  const ebit = dre?.resultadoOperacional ?? 0;
  const despFin = dre?.despesasFinanceiras ?? 0;
  const lucro = dre?.lucroLiquido ?? 0;
  const detalhado = dre?.hasDetailedBreakdown === true;

  const ativo = balance?.ativo?.total ?? 0;
  const ativoCirc = sumItems(balance?.ativo?.circulante);
  const passivo = balance?.passivo?.total ?? 0;
  const passivoCirc = sumItems(balance?.passivo?.circulante);
  const pl = balance?.patrimonioLiquido?.total ?? 0;

  // Capital investido aproximado: PL + dívida de longo prazo (passivo − PC)
  const dividaLp = Math.max(passivo - passivoCirc, 0);
  const capitalInvestido = pl + dividaLp;
  const capitalEmpregado = ativo - passivoCirc;

  // Proxy de FCL sem Capex explícito: lucro líquido do período
  const fclProxy = lucro;

  const resultados: IndicadorResultado[] = [];

  // ── Margens (destaques) ──────────────────────────────────────────────────
  // Sem CMV discriminado o DRE normalizado pode igualar lucro bruto à receita
  // (100% falso). Só calcula margem bruta com breakdown ou CMV > 0.
  const margemBruta =
    receita > 0 && (detalhado || custoVendas > 0)
      ? (lucroBruto / receita) * 100
      : null;

  resultados.push({
    id: 'margem-bruta',
    categoria: 'margens',
    nome: 'Margem Bruta',
    descricao: 'Quanto da receita sobra após o custo dos produtos/serviços vendidos.',
    formula: '(Receita − CMV) / Receita Líquida',
    destaque: true,
    valor: margemBruta,
    valorFormatado: fmt(margemBruta, 'percent'),
    unidade: 'percent',
    status: statusFromThresholds(margemBruta, { great: 40, ok: 25, warning: 10 }),
    interpretacao:
      margemBruta === null
        ? 'Requer CMV no DRE (lançamentos de custo de vendas).'
        : margemBruta >= 40
          ? 'Margem bruta elevada — boa cobertura dos custos diretos.'
          : margemBruta >= 25
            ? 'Margem bruta saudável para a maioria dos setores.'
            : 'Margem bruta pressionada — revise precificação e CMV.',
    disponivel: margemBruta !== null,
    motivoIndisponivel: margemBruta === null ? 'Sem CMV discriminado no DRE do período.' : undefined,
  });

  const margemEbit = receita > 0 ? (ebit / receita) * 100 : null;
  resultados.push({
    id: 'margem-ebit',
    categoria: 'margens',
    nome: 'Margem EBIT',
    descricao: 'Lucro operacional (antes de juros e impostos) sobre a receita.',
    formula: 'EBIT / Receita Líquida',
    destaque: true,
    valor: margemEbit,
    valorFormatado: fmt(margemEbit, 'percent'),
    unidade: 'percent',
    status: statusFromThresholds(margemEbit, { great: 15, ok: 8, warning: 0 }),
    interpretacao:
      margemEbit === null
        ? 'Sem receita no período.'
        : margemEbit >= 15
          ? 'Operação com boa rentabilidade operacional.'
          : margemEbit >= 8
            ? 'Margem operacional adequada.'
            : margemEbit >= 0
              ? 'Margem operacional baixa — revise despesas.'
              : 'Resultado operacional negativo.',
    disponivel: margemEbit !== null,
  });

  const margemFcl = receita > 0 ? (fclProxy / receita) * 100 : null;
  resultados.push({
    id: 'margem-fcl',
    categoria: 'margens',
    nome: 'Margem de Fluxo de Caixa Livre',
    descricao: 'Geração de caixa livre relativa à receita (proxy: lucro líquido até haver Capex).',
    formula: 'Fluxo de Caixa Livre / Receita Líquida',
    destaque: true,
    valor: margemFcl,
    valorFormatado: fmt(margemFcl, 'percent'),
    unidade: 'percent',
    status: statusFromThresholds(margemFcl, { great: 12, ok: 5, warning: 0 }),
    interpretacao:
      margemFcl === null
        ? 'Sem receita no período.'
        : 'Proxy com lucro líquido. FCL completo = caixa operacional − Capex.',
    disponivel: margemFcl !== null,
  });

  // ── Rentabilidade ────────────────────────────────────────────────────────
  const roe = pl > 0 ? (lucro / pl) * 100 : null;
  resultados.push({
    id: 'roe',
    categoria: 'rentabilidade',
    nome: 'ROE',
    descricao: 'Retorno sobre o patrimônio líquido dos sócios.',
    formula: 'Lucro Líquido / Patrimônio Líquido',
    valor: roe,
    valorFormatado: fmt(roe, 'percent'),
    unidade: 'percent',
    status: statusFromThresholds(roe, { great: 15, ok: 8, warning: 0 }),
    interpretacao:
      roe === null
        ? 'Sem patrimônio líquido cadastrado.'
        : roe >= 15
          ? 'Retorno atrativo sobre o capital próprio.'
          : roe >= 8
            ? 'Retorno moderado sobre o PL.'
            : 'Retorno baixo ou negativo sobre o capital dos sócios.',
    disponivel: roe !== null,
  });

  const roic = capitalInvestido > 0 ? (ebit / capitalInvestido) * 100 : null;
  resultados.push({
    id: 'roic',
    categoria: 'rentabilidade',
    nome: 'ROIC',
    descricao: 'Eficiência em gerar resultado operacional sobre o capital investido.',
    formula: 'NOPAT (≈ EBIT) / Capital Investido',
    valor: roic,
    valorFormatado: fmt(roic, 'percent'),
    unidade: 'percent',
    status: statusFromThresholds(roic, { great: 12, ok: 6, warning: 0 }),
    interpretacao:
      roic === null
        ? 'Capital investido insuficiente para o cálculo.'
        : 'Capital investido ≈ PL + dívida de longo prazo.',
    disponivel: roic !== null,
  });

  const roce = capitalEmpregado > 0 ? (ebit / capitalEmpregado) * 100 : null;
  resultados.push({
    id: 'roce',
    categoria: 'rentabilidade',
    nome: 'ROCE',
    descricao: 'Rentabilidade relativa ao capital empregado na operação.',
    formula: 'EBIT / Capital Empregado',
    valor: roce,
    valorFormatado: fmt(roce, 'percent'),
    unidade: 'percent',
    status: statusFromThresholds(roce, { great: 12, ok: 6, warning: 0 }),
    interpretacao:
      roce === null
        ? 'Capital empregado insuficiente (Ativo − Passivo Circulante).'
        : 'Capital empregado = Ativo total − Passivo circulante.',
    disponivel: roce !== null,
  });

  // ── Intensidade de capital ───────────────────────────────────────────────
  resultados.push({
    id: 'capex-receita',
    categoria: 'capital',
    nome: 'Capex sobre Receita',
    descricao: 'Proporção do investimento em ativos fixos em relação à receita.',
    formula: 'Capex / Receita Líquida',
    valor: null,
    valorFormatado: '—',
    unidade: 'percent',
    status: 'na',
    interpretacao: 'Disponível quando houver classificação de Capex no fluxo de caixa.',
    disponivel: false,
    motivoIndisponivel: 'Requer Capex identificado (investimentos em imobilizado).',
  });

  resultados.push({
    id: 'capex-caixa',
    categoria: 'capital',
    nome: 'Capex sobre Caixa das Operações',
    descricao: 'Quanto do caixa operacional é consumido por investimentos.',
    formula: 'Capex / Caixa das Operações',
    valor: null,
    valorFormatado: '—',
    unidade: 'ratio',
    status: 'na',
    interpretacao: 'Disponível com demonstração de fluxos de caixa completa.',
    disponivel: false,
    motivoIndisponivel: 'Requer Caixa das Operações e Capex no DFC.',
  });

  // ── Estrutura de capital ─────────────────────────────────────────────────
  const coberturaJuros =
    despFin > 0 ? ebit / despFin : ebit > 0 && despFin === 0 ? Infinity : null;
  resultados.push({
    id: 'cobertura-juros',
    categoria: 'estrutura',
    nome: 'Cobertura de Juros',
    descricao: 'Capacidade de pagar juros financeiros com o lucro operacional.',
    formula: 'EBIT / Despesa Financeira',
    valor: coberturaJuros === Infinity ? null : coberturaJuros,
    valorFormatado:
      coberturaJuros === Infinity
        ? 'Sem juros'
        : fmt(coberturaJuros, 'ratio'),
    unidade: 'ratio',
    status:
      coberturaJuros === Infinity
        ? 'great'
        : statusFromThresholds(coberturaJuros, { great: 3, ok: 1.5, warning: 1 }),
    interpretacao:
      coberturaJuros === Infinity
        ? 'Sem despesa financeira registrada — cobertura plena.'
        : coberturaJuros === null
          ? 'Sem dados de EBIT/juros.'
          : coberturaJuros >= 3
            ? 'Boa folga para honrar juros.'
            : 'Atenção à carga financeira.',
    disponivel: coberturaJuros !== null || coberturaJuros === Infinity,
  });

  const dividaLiquidaSobreFcl =
    fclProxy > 0 && passivo > 0 ? passivo / fclProxy : null;
  resultados.push({
    id: 'divida-fcl',
    categoria: 'estrutura',
    nome: 'Dívida Líquida sobre FCL',
    descricao: 'Anos necessários para liquidar a dívida com o fluxo de caixa livre atual.',
    formula: 'Dívida Líquida / Fluxo de Caixa Livre',
    valor: dividaLiquidaSobreFcl,
    valorFormatado: fmt(dividaLiquidaSobreFcl, 'years'),
    unidade: 'years',
    status: statusFromThresholds(dividaLiquidaSobreFcl, { great: 2, ok: 4, warning: 7 }, false),
    interpretacao:
      dividaLiquidaSobreFcl === null
        ? 'Requer passivo e geração de caixa positiva (proxy: lucro líquido).'
        : 'Proxy: Passivo total / Lucro líquido do período.',
    disponivel: dividaLiquidaSobreFcl !== null,
  });

  const endividamento = pl > 0 ? (passivo / pl) * 100 : ativo > 0 ? (passivo / ativo) * 100 : null;
  resultados.push({
    id: 'endividamento',
    categoria: 'estrutura',
    nome: 'Endividamento',
    descricao: 'Grau de alavancagem: dívida total frente ao patrimônio líquido.',
    formula: 'Dívida Total / Patrimônio Líquido',
    valor: endividamento,
    valorFormatado: fmt(endividamento, 'percent'),
    unidade: 'percent',
    status: statusFromThresholds(endividamento, { great: 50, ok: 100, warning: 150 }, false),
    interpretacao:
      endividamento === null
        ? 'Sem PL/ativo para calcular alavancagem.'
        : endividamento <= 50
          ? 'Alavancagem conservadora.'
          : endividamento <= 100
            ? 'Alavancagem moderada.'
            : 'Alavancagem elevada — monitore liquidez.',
    disponivel: endividamento !== null,
  });

  const liquidezCorrente =
    passivoCirc === 0 && ativoCirc === 0
      ? null
      : passivoCirc > 0
        ? ativoCirc / passivoCirc
        : Infinity;
  resultados.push({
    id: 'liquidez-corrente',
    categoria: 'estrutura',
    nome: 'Liquidez Corrente',
    descricao: 'Capacidade de pagar obrigações de curto prazo com ativos circulantes.',
    formula: 'Ativo Circulante / Passivo Circulante',
    valor: liquidezCorrente === Infinity ? null : liquidezCorrente,
    valorFormatado:
      liquidezCorrente === Infinity ? 'Sem dívida CP' : fmt(liquidezCorrente, 'ratio'),
    unidade: 'ratio',
    status:
      liquidezCorrente === Infinity
        ? 'great'
        : statusFromThresholds(liquidezCorrente, { great: 1.5, ok: 1.0, warning: 0.7 }),
    interpretacao:
      liquidezCorrente === Infinity
        ? 'Sem passivo circulante — liquidez plena de curto prazo.'
        : liquidezCorrente === null
          ? 'Sem dados de circulante.'
          : liquidezCorrente >= 1
            ? 'Solvência de curto prazo adequada.'
            : 'Passivo circulante supera o ativo circulante.',
    disponivel: liquidezCorrente !== null || liquidezCorrente === Infinity,
  });

  // ── Dividendos (educacional) ─────────────────────────────────────────────
  resultados.push({
    id: 'dividend-yield',
    categoria: 'dividendos',
    nome: 'Dividend Yield',
    descricao: 'Retorno em dividendos relativo ao preço da ação.',
    formula: 'Dividendo por Ação / Preço da Ação',
    valor: null,
    valorFormatado: '—',
    unidade: 'percent',
    status: 'na',
    interpretacao: 'Aplicável a empresas com cotação e política de dividendos.',
    disponivel: false,
    motivoIndisponivel: 'Requer preço de mercado e dividendos por ação.',
  });

  resultados.push({
    id: 'payout',
    categoria: 'dividendos',
    nome: 'Payout Ratio',
    descricao: 'Proporção do lucro líquido distribuída aos sócios/acionistas.',
    formula: 'Dividendos Totais / Lucro Líquido',
    valor: null,
    valorFormatado: '—',
    unidade: 'percent',
    status: 'na',
    interpretacao: 'Cadastre distribuição de lucros para calcular o payout.',
    disponivel: false,
    motivoIndisponivel: 'Requer registro de dividendos/distribuição de lucros.',
  });

  // ── Valuation (educacional) ──────────────────────────────────────────────
  resultados.push({
    id: 'preco-lucro',
    categoria: 'valuation',
    nome: 'Preço / Lucro (P/L)',
    descricao: 'Quanto o mercado paga por cada unidade de lucro.',
    formula: 'Preço da Ação / Lucro por Ação (EPS)',
    valor: null,
    valorFormatado: '—',
    unidade: 'ratio',
    status: 'na',
    interpretacao: 'Indicador de mercado — requer cotação e quantidade de ações.',
    disponivel: false,
    motivoIndisponivel: 'Requer cotação de mercado (empresas listadas).',
  });

  resultados.push({
    id: 'fcf-yield',
    categoria: 'valuation',
    nome: 'Yield de Fluxo de Caixa Livre',
    descricao: 'Retorno de caixa livre em relação ao valor de mercado.',
    formula: 'Fluxo de Caixa Livre / Valor de Mercado',
    valor: null,
    valorFormatado: '—',
    unidade: 'percent',
    status: 'na',
    interpretacao: 'Indicador de mercado — útil para análise de valuation.',
    disponivel: false,
    motivoIndisponivel: 'Requer valor de mercado e FCL completo.',
  });

  return resultados;
}

export function groupIndicadoresByCategoria(
  itens: IndicadorResultado[],
): Array<{ categoria: IndicadorCategoria; meta: (typeof CATEGORIA_META)[IndicadorCategoria]; itens: IndicadorResultado[] }> {
  const order: IndicadorCategoria[] = [
    'margens',
    'rentabilidade',
    'capital',
    'estrutura',
    'dividendos',
    'valuation',
  ];
  return order.map((categoria) => ({
    categoria,
    meta: CATEGORIA_META[categoria],
    itens: itens.filter((i) => i.categoria === categoria),
  }));
}
