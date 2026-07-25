export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  ownerUserId: string;
  companyName: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export class ChatHistoryService {
  private static sessions: Map<string, ChatSession> = new Map();

  /**
   * Remove sessões inativas há mais de SESSION_TTL_MS. Executado de forma
   * preguiçosa a cada criação de sessão — evita crescimento ilimitado do Map
   * em memória (não há persistência/expiração automática nesta implementação).
   */
  private static purgeExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt.getTime() > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Cria nova sessão de chat
   */
  static createSession(companyName: string, ownerUserId: string): string {
    this.purgeExpired();
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: ChatSession = {
      id,
      ownerUserId,
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
