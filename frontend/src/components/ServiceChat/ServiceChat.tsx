import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bot, Send, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import api from "../../config/api";
import type { ServiceHelpV2 } from "../../config/servicesHelp";

interface Message {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

interface ServiceChatProps {
  serviceName: string;
  serviceDescription: string;
  helpV2?: ServiceHelpV2;
  helpV1?: any;
}

async function callServiceChat(
  message: string,
  serviceContext: object,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string | null> {
  try {
    const res = await api.post("/copiloto/chat", {
      message,
      context: { serviceContext },
      history,
    });
    if (res.data.fallback) return null;
    return res.data.reply ?? null;
  } catch {
    return null;
  }
}

function localAnswer(
  question: string,
  helpV2?: ServiceHelpV2,
  helpV1?: any
): string {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (q.match(/o que e|o que eh|para que serve|finalidade|descricao/)) {
    const whatIs = helpV2?.whatIs ?? helpV1?.whatIs;
    if (whatIs) return whatIs;
  }
  if (q.match(/quando usar|quando devo|qual momento|situacao/)) {
    const whenToUse = helpV2?.whenToUse ?? helpV1?.whenToUse;
    if (whenToUse) return whenToUse;
  }
  if (q.match(/quanto tempo|demora|prazo|tempo/)) {
    if (helpV2?.estimatedTime)
      return `O tempo estimado para este servico e: **${helpV2.estimatedTime}**.`;
  }
  if (q.match(/preciso|necessario|obrigatorio|campos|dados|informacoes/)) {
    const fields = helpV2?.fields ?? helpV1?.variables ?? [];
    const required = fields.filter((f: any) => f.required);
    if (required.length > 0) {
      return (
        `Voce precisara dos seguintes dados obrigatorios:\n\n` +
        required
          .map(
            (f: any) =>
              `• **${f.label}**${f.example ? ` (ex.: ${f.example})` : ""}`
          )
          .join("\n")
      );
    }
  }
  if (q.match(/erro|problema|nao funciona|dificuldade|falha/)) {
    const errorsV2: string[] = helpV2?.commonErrors ?? [];
    const errorsV1: Array<{ error: string; solution: string }> =
      helpV1?.commonErrors ?? [];
    if (errorsV2.length > 0 || errorsV1.length > 0) {
      const lines = [
        ...errorsV2.map((e) => `• ${e}`),
        ...errorsV1.map((e) => `• **${e.error}**: ${e.solution}`),
      ];
      return `Erros comuns neste servico:\n\n${lines.join("\n")}`;
    }
  }
  if (q.match(/dica|tip|sugestao|recomend|conselho/)) {
    const tips: string[] = helpV2?.tips ?? helpV1?.tips ?? [];
    if (tips.length > 0)
      return `Dicas para este servico:\n\n${tips.map((t) => `• ${t}`).join("\n")}`;
  }
  if (q.match(/faq|pergunta|frequente/)) {
    const faqs: Array<{ question: string; answer: string }> =
      helpV1?.faqs ?? [];
    if (faqs.length > 0)
      return faqs
        .slice(0, 3)
        .map((f) => `**${f.question}**\n${f.answer}`)
        .join("\n\n");
  }

  return `Nao encontrei uma resposta especifica. Tente perguntar:\n\n• "O que e este servico?"\n• "Quando devo usar?"\n• "Quais dados preciso?"\n• "Quanto tempo leva?"\n• "Quais sao os erros comuns?"`;
}

const SUGGESTIONS = [
  "O que e este servico?",
  "Quando devo usar?",
  "Quais dados preciso ter?",
  "Quanto tempo leva?",
  "Quais sao os erros comuns?",
];

export function ServiceChat({
  serviceName,
  serviceDescription,
  helpV2,
  helpV1,
}: ServiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Ola! Posso tirar suas duvidas sobre **${serviceName}**. O que voce gostaria de saber?`,
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const serviceContext = useMemo(
    () => ({
      serviceName,
      serviceDescription,
      whatIs: helpV2?.whatIs ?? helpV1?.whatIs,
      whenToUse: helpV2?.whenToUse ?? helpV1?.whenToUse,
      estimatedTime: helpV2?.estimatedTime,
      tips: helpV2?.tips ?? helpV1?.tips ?? [],
      commonErrors: helpV2?.commonErrors ?? [],
      requiredFields: (helpV2?.fields ?? helpV1?.variables ?? [])
        .filter((f: any) => f.required)
        .map((f: any) => ({ label: f.label, example: f.example })),
    }),
    [serviceName, serviceDescription, helpV2, helpV1]
  );

  const historyForApi = useMemo(
    () =>
      messages.slice(-10).map((m) => ({ role: m.role, content: m.text })),
    [messages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      setMessages((prev) => [
        ...prev,
        { role: "user", text, ts: Date.now() },
      ]);
      setInput("");
      setLoading(true);

      try {
        const aiReply = await callServiceChat(
          text,
          serviceContext,
          historyForApi
        );
        const reply = localAnswer(text, helpV2, helpV1);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: reply, ts: Date.now() },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, serviceContext, historyForApi, helpV2, helpV1]
  );

  const renderText = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n• /g, "<br/>• ")
      .replace(/\n(\d+)\./g, "<br/>$1.")
      .replace(/\n/g, "<br/>");

  return (
    <div className="flex flex-col h-[480px]">
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 pr-1">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.ts}
              className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isUser
                    ? "bg-primary-600"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                {isUser ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  isUser
                    ? "bg-primary-600 text-white rounded-tr-sm"
                    : "bg-gray-50 border border-gray-200 text-gray-800 rounded-tl-sm dark:bg-gray-900/40 dark:border-gray-700 dark:text-gray-200"
                }`}
              >
                <p dangerouslySetInnerHTML={{ __html: renderText(m.text) }} />
                <p
                  className={`text-xs mt-1 ${
                    isUser ? "text-primary-200 text-right" : "text-gray-400"
                  }`}
                >
                  {format(new Date(m.ts), "HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-700">
              <Bot className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 dark:bg-gray-900/40 dark:border-gray-700">
              <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="py-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-40 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Tire sua duvida sobre este servico..."
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          disabled={loading}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          aria-label="Enviar"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default ServiceChat;

