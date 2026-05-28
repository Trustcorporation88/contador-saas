export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
  };
}

export class ValidationService {
  static validateFinancialContext(context: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const b = context.balance || {};
    const d = context.dre || {};

    const ativoTotal = b.ativoTotal || 0;
    const passivoTotal = b.passivoTotal || 0;
    const pl = b.patrimonioLiquido || 0;
    const diferenca = Math.abs(ativoTotal - (passivoTotal + pl));

    if (diferenca > 0.01) {
      errors.push(
        `❌ Ativo (R$ ${ativoTotal}) ≠ Passivo (R$ ${passivoTotal}) + PL (R$ ${pl})`
      );
    }

    const receitaLiquida = d.receitaLiquida || 0;
    const custoVendas = d.custoVendas || 0;
    const impostos = d.impostos || 0;
    const lucroCalculado = receitaLiquida - custoVendas - impostos;
    const lucroReportado = d.lucroLiquido || 0;
    const difLucro = Math.abs(lucroCalculado - lucroReportado);

    if (difLucro > 0.01) {
      errors.push(
        `❌ Lucro calculado (R$ ${lucroCalculado.toFixed(2)}) ≠ Lucro reportado (R$ ${lucroReportado.toFixed(2)})`
      );
    }

    if (b.ativoCirculante > b.ativoTotal) {
      errors.push(`❌ Ativo Circulante > Ativo Total`);
    }

    if (b.passivoCirculante > b.passivoTotal) {
      errors.push(`❌ Passivo Circulante > Passivo Total`);
    }

    if (ativoTotal < 0) errors.push(`❌ Ativo Total negativo`);
    if (passivoTotal < 0) errors.push(`❌ Passivo Total negativo`);
    if (pl < 0) warnings.push(`⚠️ Patrimônio Líquido negativo`);
    if (receitaLiquida < 0) errors.push(`❌ Receita Líquida negativa`);
    if (lucroReportado < 0) warnings.push(`⚠️ Lucro Líquido negativo`);

    if (custoVendas === 0 && receitaLiquida > 0) {
      warnings.push(`⚠️ Custo das Vendas = 0. Verifique se é correto.`);
    }

    if (receitaLiquida > 0) {
      const margem = (lucroReportado / receitaLiquida) * 100;
      if (margem > 50) {
        warnings.push(`⚠️ Margem Líquida muito alta (${margem.toFixed(1)}%)`);
      }
    }

    if (b.passivoCirculante > 0) {
      const liquidez = b.ativoCirculante / b.passivoCirculante;
      if (liquidez > 5) {
        warnings.push(`⚠️ Liquidez Corrente muito alta (${liquidez.toFixed(2)})`);
      }
    }

    if (ativoTotal > 0) {
      const endividamento = (passivoTotal / ativoTotal) * 100;
      if (endividamento < 5) {
        warnings.push(`⚠️ Endividamento muito baixo (${endividamento.toFixed(1)}%)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
      },
    };
  }
}
