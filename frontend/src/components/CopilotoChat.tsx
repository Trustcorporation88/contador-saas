import React, { useState, useEffect, useRef } from 'react';
import './CopilotoChat.css';
import api from '../config/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface FinancialContext {
  companyName: string;
  balance: {
    ativoTotal: number;
    passivoTotal: number;
    patrimonioLiquido: number;
    ativoCirculante: number;
    passivoCirculante: number;
  };
  dre: {
    receitaLiquida: number;
    custoVendas: number;
    impostos: number;
    lucroLiquido: number;
  };
}

interface CopilotoChatProps {
  companyName: string;
  financialData: FinancialContext;
  onExport?: (sessionId: string) => void;
}

export const CopilotoChat: React.FC<CopilotoChatProps> = ({
  companyName,
  financialData,
  onExport,
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const createSession = async () => {
      try {
        const res = await api.post('/copiloto/session', { companyName });
        setSessionId(res.data.sessionId);
      } catch {
        setError('Erro ao criar sessao');
      }
    };
    createSession();
  }, [companyName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setError(null);

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    try {
      const res = await api.post('/copiloto/chat', {
        sessionId,
        message: userMessage,
        context: financialData,
      });

      if (res.data.fallback) {
        setError(res.data.message);
        return;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        timestamp: new Date(),
      }]);
    } catch {
      setError('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!sessionId) return;
    setExporting(true);

    try {
      const res = await api.post(
        `/copiloto/export/${sessionId}/analysis`,
        { financialData },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analise-${sessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onExport?.(sessionId);
    } catch {
      setError('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="copiloto-chat">
      <div className="copiloto-header">
        <div>
          <h2>🤖 Copiloto Contabil</h2>
          <p>{companyName}</p>
        </div>
        {sessionId && (
          <button
            className="btn-export"
            onClick={handleExportPDF}
            disabled={exporting || messages.length === 0}
            title="Exportar conversa como PDF"
          >
            {exporting ? '⏳ Exportando...' : '📄 Exportar'}
          </button>
        )}
      </div>

      <div className="copiloto-messages">
        {messages.length === 0 && (
          <div className="copiloto-empty">
            <p>Faca uma pergunta sobre a saude financeira da empresa</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <p>{msg.content}</p>
              <span className="message-time">
                {msg.timestamp.toLocaleTimeString('pt-BR')}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="message message-assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="copiloto-error">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSendMessage} className="copiloto-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Faca uma pergunta..."
          disabled={loading || !sessionId}
          className="copiloto-input"
        />
        <button
          type="submit"
          disabled={loading || !sessionId || !input.trim()}
          className="copiloto-send"
        >
          {loading ? '⏳' : '➤'}
        </button>
      </form>
    </div>
  );
};

export default CopilotoChat;
