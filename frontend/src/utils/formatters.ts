const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  compactDisplay: 'short',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrencyBRL(value: number, options?: { compact?: boolean }): string {
  return options?.compact ? compactCurrencyFormatter.format(value) : currencyFormatter.format(value);
}

export function formatSignedCurrencyDelta(value: number, options?: { compact?: boolean }): string {
  const signal = value >= 0 ? '+' : '-';
  return `${signal}${formatCurrencyBRL(Math.abs(value), options)}`;
}

export function formatDecimalBR(value: number, suffix = ''): string {
  return `${decimalFormatter.format(value)}${suffix}`;
}

export function formatPercentBR(value: number): string {
  return `${percentFormatter.format(value)}%`;
}