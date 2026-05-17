/**
 * DeepSeek AI Service
 * Integração com a API DeepSeek (compatível com OpenAI) para o Copiloto Contábil.
 * Modelos: deepseek-chat (V3, custo-benefício) | deepseek-reasoner (R1, raciocínio)
 */

import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FinancialContext {
  companyName: string;
  balance?: {
    ativoTotal:        number;
    passivoTotal:      number;
    patrimonioLiquido: number;
    ativoCirculante:   number;
    passivoCirculante: number;
  };
  dre?: {
    receitaLiquida: number;
    lucroLiquido:   number;
    custoVendas:    number;
    impostos:       number;
  };
  healthScore?: {
    total: number;
    grade: string;
    label: string;
  };
}

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResponse {
  reply:    string;
  model:    string;
  tokens:   number;
  fallback: false;
}

export interface FallbackResponse {
  fallback: true;
  reason:   'no_api_key' | 'api_error';
}

export type CopilotoResponse = DeepSeekResponse | FallbackResponse;

// ─── Configuração ─────────────────────────────────────────────────────────────

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// ─── Prompt do sistema ────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: FinancialContext): string {
  const brl = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

  const lines: string[] = [
    `Você é o Copiloto Contábil de "O Contador", um sistema de contabilidade brasileiro de nível enterprise.`,
    `Você está assistindo o contador ou gestor da empresa "${ctx.companyName}".`,
    `Responda sempre em português brasileiro claro, direto e profissional.`,
    `Use terminologia contábil brasileira (Lei 6.404/76, CPC, NBC TG).`,
    `Seja conciso mas completo. Use listas e marcações ** negrito ** para facilitar a leitura.`,
    `Nunca invente dados — use apenas os números fornecidos abaixo.`,
    ``,
    `── DADOS FINANCEIROS ATUAIS ──────────────────────────────────────────`,
  ];

  if (ctx.balance) {
    const b = ctx.balance;
    const lc = b.passivoCirculante > 0
      ? (b.ativoCirculante / b.passivoCirculante).toFixed(2)
      : 'N/D';
    const endiv = b.ativoTotal > 0
      ? ((b.passivoTotal / b.ativoTotal) * 100).toFixed(1) + '%'
      : 'N/D';

    lines.push(
      `Balanço Patrimonial:`,
      `  • Ativo Total: ${brl(b.ativoTotal)}`,
      `  • Ativo Circulante: ${brl(b.ativoCirculante)}`,
      `  • Passivo Total: ${brl(b.passivoTotal)}`,
      `  • Passivo Circulante: ${brl(b.passivoCirculante)}`,
      `  • Patrimônio Líquido: ${brl(b.patrimonioLiquido)}`,
      `  • Liquidez Corrente: ${lc}`,
      `  • Grau de Endividamento: ${endiv}`,
    );
  } else {
    lines.push(`Balanço Patrimonial: não disponível para o período atual.`);
  }

  if (ctx.dre) {
    const d = ctx.dre;
    const margem = d.receitaLiquida > 0
      ? ((d.lucroLiquido / d.receitaLiquida) * 100).toFixed(1) + '%'
      : 'N/D';
    const carga = d.receitaLiquida > 0
      ? ((d.impostos / d.receitaLiquida) * 100).toFixed(1) + '%'
      : 'N/D';

    lines.push(
      `DRE (Demonstração do Resultado):`,
      `  • Receita Líquida: ${brl(d.receitaLiquida)}`,
      `  • Custo das Vendas/Serviços: ${brl(d.custoVendas)}`,
      `  • Impostos: ${brl(d.impostos)} (carga: ${carga})`,
      `  • Lucro/Prejuízo Líquido: ${brl(d.lucroLiquido)}`,
      `  • Margem Líquida: ${margem}`,
    );
  } else {
    lines.push(`DRE: não disponível para o período atual.`);
  }

  if (ctx.healthScore) {
    const hs = ctx.healthScore;
    lines.push(`Score de Saúde Financeira: ${hs.total}/1000 (${hs.grade}) — ${hs.label}`);
  }

  lines.push(
    `────────────────────────────────────────────────────────────────────`,
    ``,
    `Se o usuário perguntar algo que não tem relação com os dados acima ou contabilidade, `,
    `explique educadamente que você é especializado em análise contábil e financeira.`,
  );

  return lines.join('\n');
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class DeepSeekService {
  /**
   * Verifica se a API key está configurada.
   */
  static isConfigured(): boolean {
    return !!envConfig.deepseekApiKey;
  }

  /**
   * Envia uma mensagem para o DeepSeek e retorna a resposta.
   * Se a API key não estiver configurada, retorna `fallback: true`.
   */
  static async chat(
    userMessage: string,
    financialContext: FinancialContext,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<CopilotoResponse> {
    if (!DeepSeekService.isConfigured()) {
      return { fallback: true, reason: 'no_api_key' };
    }

    const systemPrompt = buildSystemPrompt(financialContext);

    // Monta o array de mensagens (máximo 10 turnos de histórico para controlar tokens)
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${envConfig.deepseekApiKey}`,
        },
        body: JSON.stringify({
          model:       envConfig.deepseekModel,
          messages,
          max_tokens:  1024,
          temperature: 0.3, // Baixa temperatura para respostas mais precisas em contabilidade
          stream:      false,
        }),
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error('DeepSeek API error', { status: response.status, body });
        return { fallback: true, reason: 'api_error' };
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        model:   string;
        usage:   { total_tokens: number };
      };

      const reply  = data.choices?.[0]?.message?.content ?? '';
      const tokens = data.usage?.total_tokens ?? 0;

      logger.info('DeepSeek chat success', { model: data.model, tokens });

      return {
        reply,
        model:    data.model ?? envConfig.deepseekModel,
        tokens,
        fallback: false,
      };
    } catch (err) {
      logger.error('DeepSeek fetch error', { err });
      return { fallback: true, reason: 'api_error' };
    }
  }
}

export default DeepSeekService;
