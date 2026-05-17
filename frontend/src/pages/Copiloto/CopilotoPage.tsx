/**
 * CopilotoPage.tsx — Copiloto Contábil em Português Natural
 * Modo primário:  DeepSeek V3 via API (quando DEEPSEEK_API_KEY configurada)
 * Modo fallback:  Motor NLP local — zero latência, zero custo.
 * INÉDITO no mundo da contabilidade.
 */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, Send, Sparkles, User, Cpu, Zap, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';
import { calcHealthScore } from '../../services/healthScoreService';
import api from '../../config/api';
import type { BalanceSheet, DRE } from '../../types';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Message {
  role:      'user' | 'assistant';
  text:      string;
  ts:        number;
  aiMode?:   'deepseek' | 'local'; // fonte da resposta
  tokens?:   number;
}

type AiMode = 'deepseek' | 'local' | 'unknown';

// ─── Motor de perguntas e respostas ──────────────────────────────────────────

interface Context {
  balance:  BalanceSheet | undefined;
  dre:      DRE          | undefined;
  company:  string;
}

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function answer(question: string, ctx: Context): string {
  const q   = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const b   = ctx.balance;
  const d   = ctx.dre;

  const sumItems = (items: { balance?: number }[] | undefined) =>
    (items ?? []).reduce((a, i) => a + (i.balance ?? 0), 0);

  const receita    = d?.receitaLiquida    ?? 0;
  const lucro      = d?.lucroLiquido      ?? 0;
  const ativo      = b?.ativo?.total      ?? 0;
  const passivo    = b?.passivo?.total    ?? 0;
  const pl         = b?.patrimonioLiquido?.total ?? 0;
  const acirculante = sumItems(b?.ativo?.circulante);
  const pcirculante = sumItems(b?.passivo?.circulante);
  const impostos   = d?.impostos          ?? 0;
  const custos     = d?.custoVendas       ?? 0;
  const lc         = pcirculante > 0 ? acirculante / pcirculante : null;
  const margem     = receita > 0 ? (lucro / receita) * 100 : null;
  const endiv      = ativo > 0 ? (passivo / ativo) * 100 : null;

  const hs = calcHealthScore(b, d);

  // ── Perguntas sobre caixa/liquidez ──────────────────────────────────────
  if (q.match(/caixa|liquidez|pagar.*folha|folha.*pagar|vou ter.*dinheiro|sobra.*dinheiro/)) {
    if (lc === null) return 'Ainda não há dados suficientes no balanço para calcular a liquidez. Lance o balanço patrimonial para uma análise completa.';
    if (lc >= 1.5) return `✅ Sim! Sua liquidez corrente é **${lc.toFixed(2)}** — isso significa que para cada R$1 de dívida de curto prazo, você tem **R$${lc.toFixed(2)} em ativos circulantes**. A empresa tem capacidade de pagar suas obrigações imediatas com folga.`;
    if (lc >= 1.0) return `⚠️ A liquidez corrente é **${lc.toFixed(2)}** — adequada, mas sem muito espaço. Ativo circulante de ${brl(acirculante)} contra passivo circulante de ${brl(pcirculante)}. Monitore de perto.`;
    return `🔴 Atenção: liquidez corrente de **${lc.toFixed(2)}** é preocupante. Ativo circulante (${brl(acirculante)}) é menor que o passivo circulante (${brl(pcirculante)}). Risco de dificuldade para honrar compromissos.`;
  }

  // ── Perguntas sobre lucro/resultado ────────────────────────────────────
  if (q.match(/lucro|resultado|ganhe|ganhei|faturei|sobrou|prejuizo/)) {
    if (!d) return 'Ainda não há dados de DRE disponíveis para o período atual. Lance as receitas e despesas do mês para calcular o resultado.';
    if (lucro > 0) return `💰 No período atual, a empresa registrou **lucro líquido de ${brl(lucro)}** sobre uma receita de ${brl(receita)}. A margem líquida é de **${margem?.toFixed(1)}%**. ${margem! >= 15 ? 'Excelente performance!' : margem! >= 5 ? 'Resultado saudável.' : 'Margem baixa — revise os custos.'}`;
    if (lucro === 0) return 'O resultado líquido do período está zerado. Verifique se todos os lançamentos de receita e despesa foram registrados.';
    return `🔴 A empresa está em **prejuízo de ${brl(Math.abs(lucro))}** no período. Receita: ${brl(receita)}, Custos: ${brl(custos)}, Impostos: ${brl(impostos)}. Analise onde estão os custos mais elevados.`;
  }

  // ── Perguntas sobre impostos ────────────────────────────────────────────
  if (q.match(/imposto|tributo|das|irpj|csll|pis|cofins|carga|tributari/)) {
    if (!d) return 'Sem dados de DRE disponíveis para calcular impostos. Lance as receitas do período.';
    const carga = receita > 0 ? (impostos / receita) * 100 : 0;
    return `📊 Impostos do período: **${brl(impostos)}**, representando **${carga.toFixed(1)}% da receita**. ${carga <= 10 ? '✅ Carga tributária eficiente.' : carga <= 20 ? '⚠️ Carga moderada — verifique o regime mais adequado no Simulador Fiscal.' : '🔴 Carga tributária elevada — considere revisar o regime tributário no Simulador de Cenários.'}`;
  }

  // ── Perguntas sobre score/saúde ────────────────────────────────────────
  if (q.match(/score|saude|saudavel|nota|situacao|como.*empresa|empresa.*como|bem|mal/)) {
    return `🏥 O **Score de Saúde Financeira** da empresa é **${hs.total}/1000 (${hs.grade})** — ${hs.label}.\n\n${hs.dimensions.map((d) => `• **${d.label}**: ${d.value} — ${d.description}`).join('\n')}`;
  }

  // ── Perguntas sobre dívidas/endividamento ──────────────────────────────
  if (q.match(/divida|debito|endivid|passivo|devendo/)) {
    if (!b) return 'Sem dados de balanço disponíveis para analisar o endividamento.';
    return `🏦 O passivo total da empresa é **${brl(passivo)}** (${endiv?.toFixed(1)}% do ativo). O patrimônio líquido é de **${brl(pl)}**. ${endiv! <= 50 ? '✅ Nível de endividamento saudável.' : endiv! <= 70 ? '⚠️ Endividamento moderado — monitore novas captações.' : '🔴 Alavancagem elevada — considere reduzir o passivo.'}`;
  }

  // ── Perguntas sobre ativo/patrimônio ────────────────────────────────────
  if (q.match(/ativo|patrimonio|quanto.*vale|valor.*empresa|bens/)) {
    if (!b) return 'Sem dados de balanço para calcular o ativo.';
    return `📈 O **ativo total** da empresa é **${brl(ativo)}**. Desses, ${brl(acirculante)} são ativos circulantes (disponíveis no curto prazo) e o **patrimônio líquido** é de **${brl(pl)}**.`;
  }

  // ── Perguntas sobre receita/faturamento ────────────────────────────────
  if (q.match(/receita|faturamento|vendeu|vendas|faturou|renda/)) {
    if (!d) return 'Sem dados de DRE disponíveis. Lance as receitas do período para ver o faturamento.';
    return `💵 A **receita líquida** do período é de **${brl(receita)}**. Após custos (${brl(custos)}) e impostos (${brl(impostos)}), o resultado é ${lucro >= 0 ? `lucro de ${brl(lucro)}` : `prejuízo de ${brl(Math.abs(lucro))}`}.`;
  }

  // ── Perguntas sobre o que fazer / conselhos ─────────────────────────────
  if (q.match(/o que fazer|como melhorar|conselho|dica|recomend|sugest/)) {
    const probs: string[] = [];
    if (lc !== null && lc < 1.0) probs.push('aumentar a liquidez corrente (atual: ' + lc.toFixed(2) + ')');
    if (margem !== null && margem < 5) probs.push('melhorar a margem líquida (atual: ' + margem.toFixed(1) + '%)');
    if (endiv !== null && endiv > 70) probs.push('reduzir o endividamento (atual: ' + endiv.toFixed(1) + '%)');
    if (probs.length === 0) return `✅ A empresa está em boa situação (Score ${hs.total}/1000). Continue monitorando mensalmente e use o Simulador Fiscal para otimizar o regime tributário.`;
    return `Para melhorar a saúde financeira da empresa, priorize:\n\n${probs.map((p, i) => `${i + 1}. **${p.charAt(0).toUpperCase() + p.slice(1)}**`).join('\n')}\n\nAcesse o **Score de Saúde** para o detalhamento completo.`;
  }

  // ── Ajuda / comandos ────────────────────────────────────────────────────
  if (q.match(/ajuda|help|o que.*perguntar|como usar|exemplos/)) {
    return `Posso responder perguntas como:\n\n• "Vou ter caixa para pagar a folha?"\n• "Qual foi o lucro este mês?"\n• "Qual é a carga tributária?"\n• "Como está a saúde financeira da empresa?"\n• "Quanto a empresa está endividada?"\n• "Qual o faturamento do período?"\n• "O que devo fazer para melhorar?"\n\nUse linguagem natural — não precisa ser técnico!`;
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return `Não entendi exatamente sua pergunta. Tente algo como:\n\n• "Qual foi o lucro este mês?"\n• "Vou ter caixa para pagar as contas?"\n• "Como está a saúde financeira?"\n• "Qual a carga tributária?"\n\nOu digite **ajuda** para ver todos os exemplos.`;
}

// ─── Chamada à API DeepSeek via backend ──────────────────────────────────────

async function callDeepSeekAPI(
  message: string,
  ctx: Context,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ reply: string; tokens?: number } | null> {
  const b = ctx.balance;
  const d = ctx.dre;

  const sumItems = (items: { balance?: number }[] | undefined) =>
    (items ?? []).reduce((a, i) => a + (i.balance ?? 0), 0);

  const context = {
    companyName: ctx.company,
    balance: b ? {
      ativoTotal:        b.ativo?.total ?? 0,
      passivoTotal:      b.passivo?.total ?? 0,
      patrimonioLiquido: b.patrimonioLiquido?.total ?? 0,
      ativoCirculante:   sumItems(b.ativo?.circulante),
      passivoCirculante: sumItems(b.passivo?.circulante),
    } : undefined,
    dre: d ? {
      receitaLiquida: d.receitaLiquida ?? 0,
      lucroLiquido:   d.lucroLiquido   ?? 0,
      custoVendas:    d.custoVendas    ?? 0,
      impostos:       d.impostos       ?? 0,
    } : undefined,
  };

  try {
    const res = await api.post('/copiloto/chat', { message, context, history });
    if (res.data.fallback) return null;
    return { reply: res.data.reply, tokens: res.data.tokens };
  } catch {
    return null;
  }
}

// ─── Sugestões iniciais ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Como está a saúde financeira da empresa?',
  'Qual foi o lucro este mês?',
  'Vou ter caixa para pagar as contas?',
  'Qual é a carga tributária atual?',
  'Quanto a empresa está endividada?',
  'O que devo fazer para melhorar?',
];

// ─── Componente de mensagem ───────────────────────────────────────────────────

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  // Renderiza markdown simples (bold, bullet)
  const html = msg.text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n• /g, '<br/>• ')
    .replace(/\n(\d+)\./g, '<br/>$1.')
    .replace(/\n/g, '<br/>');

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-primary-600' : 'bg-gray-100'
      }`}>
        {isUser
          ? <User className="h-4 w-4 text-white" />
          : <Bot  className="h-4 w-4 text-primary-600" />
        }
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
        isUser
          ? 'bg-primary-600 text-white rounded-tr-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
      }`}>
        <p dangerouslySetInnerHTML={{ __html: html }} />
        <div className={`flex items-center gap-2 text-xs mt-1 ${isUser ? 'text-primary-200 justify-end' : 'text-gray-400'}`}>
          <span>{format(new Date(msg.ts), 'HH:mm', { locale: ptBR })}</span>
          {!isUser && msg.aiMode === 'deepseek' && (
            <span className="inline-flex items-center gap-0.5 text-indigo-400">
              <Cpu className="h-2.5 w-2.5" /> DeepSeek
              {msg.tokens ? ` · ${msg.tokens} tokens` : ''}
            </span>
          )}
          {!isUser && msg.aiMode === 'local' && (
            <span className="inline-flex items-center gap-0.5 text-gray-300">
              <Zap className="h-2.5 w-2.5" /> local
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CopilotoPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Olá! Sou o **Copiloto O Contador** 🤖\n\nPosso responder perguntas sobre os dados financeiros da sua empresa em linguagem natural. Experimente perguntar algo!',
      ts: Date.now(),
    },
  ]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [aiMode,   setAiMode]   = useState<AiMode>('unknown');
  const bottomRef = useRef<HTMLDivElement>(null);

  const monthStart = useMemo(() => format(new Date(), 'yyyy-MM-01'), []);
  const today      = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['copiloto', 'balance', companyId],
    queryFn:  () => DashboardService.getBalanceSheet(companyId!),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qDRE = useQuery({
    queryKey: ['copiloto', 'dre', companyId, monthStart],
    queryFn:  () => DashboardService.getDRE(companyId!, monthStart, today),
    enabled:  !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qCompany = useQuery({
    queryKey: ['company', companyId],
    queryFn:  () => DashboardService.getCompany(companyId!),
    enabled:  !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  // Verificar se DeepSeek está configurado ao carregar
  const qAiStatus = useQuery({
    queryKey: ['copiloto', 'status'],
    queryFn:  async () => {
      const res = await api.get('/copiloto/status');
      return res.data as { aiEnabled: boolean; model: string | null };
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (qAiStatus.data) {
      setAiMode(qAiStatus.data.aiEnabled ? 'deepseek' : 'local');
    }
  }, [qAiStatus.data]);

  const ctx: Context = {
    balance: qBalance.data,
    dre:     qDRE.data,
    company: qCompany.data?.name ?? 'Empresa',
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Histórico para enviar ao DeepSeek (últimas 10 mensagens)
  const historyForApi = useMemo(() =>
    messages
      .filter((m) => m.role !== 'assistant' || m.ts > 0) // todas
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.text })),
    [messages],
  );

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Tenta API DeepSeek primeiro
      const aiResult = await callDeepSeekAPI(text, ctx, historyForApi);

      if (aiResult) {
        setAiMode('deepseek');
        setMessages((prev) => [...prev, {
          role:    'assistant',
          text:    aiResult.reply,
          ts:      Date.now(),
          aiMode:  'deepseek',
          tokens:  aiResult.tokens,
        }]);
      } else {
        // Fallback: motor local
        setAiMode('local');
        const resp = answer(text, ctx);
        setMessages((prev) => [...prev, {
          role:   'assistant',
          text:   resp,
          ts:     Date.now(),
          aiMode: 'local',
        }]);
      }
    } finally {
      setLoading(false);
    }
  }, [ctx, historyForApi, loading]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const modeLabel = aiMode === 'deepseek'
    ? { icon: <Cpu className="h-3 w-3" />, text: 'DeepSeek V3', cls: 'text-indigo-600 bg-indigo-50 border-indigo-200' }
    : aiMode === 'local'
    ? { icon: <Zap className="h-3 w-3" />, text: 'Motor local', cls: 'text-gray-500 bg-gray-50 border-gray-200' }
    : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col max-w-2xl mx-auto p-4">

      {/* Header */}
      <div className="pb-4 border-b border-gray-200 mb-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary-600" />
          Copiloto Contábil
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
          Perguntas em linguagem natural sobre seus dados financeiros.
          <span className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            <Sparkles className="h-3 w-3" /> Exclusivo O Contador
          </span>
          {modeLabel && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${modeLabel.cls}`}>
              {modeLabel.icon} {modeLabel.text}
            </span>
          )}
        </p>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2">
        {messages.map((m) => (
          <ChatMessage key={m.ts} msg={m} />
        ))}

        {/* Indicador de loading */}
        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100">
              <Bot className="h-4 w-4 text-primary-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sugestões */}
      {messages.length <= 1 && (
        <div className="py-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="pt-3 border-t border-gray-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre sua empresa..."
          className="input-field flex-1"
          disabled={!companyId || loading}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || !companyId || loading}
          className="btn btn-primary px-4 flex-shrink-0 disabled:opacity-40"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />
          }
        </button>
      </div>
      {!companyId && (
        <p className="text-xs text-gray-400 text-center mt-1">Selecione uma empresa para usar o Copiloto.</p>
      )}
    </div>
  );
}
