export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  companyName: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export class ChatHistoryService {
  private static sessions: Map<string, ChatSession> = new Map();

  /**
   * Cria nova sessão de chat
   */
  static createSession(companyName: string): string {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: ChatSession = {
      id,
      companyName,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(id, session);
    return id;
  }

  /**
   * Adiciona mensagem ao histórico
   */
  static addMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sessão ${sessionId} não encontrada`);

    session.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
    session.updatedAt = new Date();
  }

  /**
   * Retorna histórico formatado para DeepSeek
   */
  static getHistory(sessionId: string): Array<{ role: string; content: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sessão ${sessionId} não encontrada`);

    return session.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Retorna sessão completa
   */
  static getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Lista todas as sessões
   */
  static listSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Deleta sessão
   */
  static deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Exporta sessão como JSON
   */
  static exportSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sessão ${sessionId} não encontrada`);
    return JSON.stringify(session, null, 2);
  }
}
