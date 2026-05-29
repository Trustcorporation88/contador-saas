import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../config/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CopilotoMiniChatProps {
  topic: string;
  onClose: () => void;
}

export const CopilotoMiniChat: React.FC<CopilotoMiniChatProps> = ({ topic, onClose }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const sessionRes = await api.post('/copiloto/session', { companyName: 'Consulta' });
        const sid = sessionRes.data.sessionId;
        setSessionId(sid);

        setLoading(true);
        const chatRes = await api.post('/copiloto/chat', {
          sessionId: sid,
          message: `Tenho duvidas sobre o seguinte tema contabil: "${topic}". Pode me explicar de forma clara e objetiva?`,
          context: { companyName: 'Consulta', topic },
        });

        if (!chatRes.data.fallback) {
          setMessages([{
            role: 'assistant',
            content: chatRes.data.reply,
            timestamp: new Date(),
          }]);
        }
      } catch {
        setError('Erro ao iniciar conversa');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [topic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (sessionId) inputRef.current?.focus();
  }, [sessionId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setError(null);

    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);

    try {
      const res = await api.post('/copiloto/chat', {
        sessionId,
        message: userMessage,
        context: { companyName: 'Consulta', topic },
      });

      if (!res.data.fallback) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: res.data.reply,
          timestamp: new Date(),
        }]);
      } else {
        setError(res.data.message);
      }
    } catch {
      setError('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Chat sobre: ${topic}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.18 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ height: '520px' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Copiloto Contabil</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{topic}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Fechar chat"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400 dark:text-gray-500">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Preparando resposta...</p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                msg.role === 'user'
                  ? 'bg-primary-100 dark:bg-primary-900/30'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {msg.role === 'user'
                  ? <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                  : <Bot className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                }
              </div>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
              }`}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <span className={`text-xs mt-1 block ${
                  msg.role === 'user' ? 'text-primary-200' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {loading && messages.length > 0 && (
            <div className="flex gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-3">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">⚠️ {error}</p>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faca uma pergunta sobre este tema..."
            disabled={loading || !sessionId}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !sessionId || !input.trim()}
            className="p-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(<AnimatePresence>{modal}</AnimatePresence>, document.body)
    : null;
};

export default CopilotoMiniChat;
