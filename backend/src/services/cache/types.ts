/**
 * Cache Service Types
 * TypeScript interfaces e types para sistema de cache Redis
 */

/**
 * Configuração do Redis
 */
export interface RedisConfig {
  /** URL completa de conexão (redis://host:port) */
  url: string;
  /** Host do Redis */
  host: string;
  /** Porta do Redis */
  port: number;
  /** Senha de autenticação (opcional) */
  password?: string;
  /** Database number (0-15) */
  db: number;
  /** Número máximo de tentativas de reconexão */
  maxRetries: number;
  /** Delay inicial entre tentativas (ms) - usa exponential backoff */
  retryDelay: number;
  /** Habilitar queue de comandos quando offline */
  enableOfflineQueue: boolean;
  /** Lazy connect (conectar apenas quando necessário) */
  lazyConnect: boolean;
}

/**
 * Configuração do sistema de cache
 */
export interface CacheConfig {
  /** Cache habilitado globalmente */
  enabled: boolean;
  /** TTL padrão em segundos */
  defaultTtl: number;
  /** TTL para relatórios (balance-sheet, income-statement, etc) */
  reportsTtl: number;
  /** TTL para plano de contas (accounts tree/list) */
  accountsTtl: number;
  /** TTL para cálculos de impostos */
  taxesTtl: number;
  /** TTL para dashboard summary */
  dashboardTtl: number;
}

/**
 * Estatísticas do cache
 */
export interface CacheStats {
  /** Total de hits (cache encontrado) */
  hits: number;
  /** Total de misses (cache não encontrado) */
  misses: number;
  /** Taxa de hits em porcentagem (hits / (hits + misses) * 100) */
  hitRate: number;
  /** Número total de keys no cache */
  keys: number;
  /** Memória utilizada pelo Redis (formato legível: "12.5MB") */
  memoryUsed: string;
  /** Tempo de uptime do Redis em segundos */
  uptime: number;
  /** Timestamp da coleta das estatísticas */
  timestamp: Date;
}

/**
 * Status de saúde do Redis
 */
export interface RedisHealth {
  /** Redis está conectado e respondendo */
  connected: boolean;
  /** Tempo de uptime em segundos */
  uptime: number;
  /** Memória utilizada (formato legível) */
  memoryUsed: string;
  /** Número de keys armazenadas */
  keys: number;
  /** Timestamp da verificação */
  timestamp: Date;
  /** Mensagem de erro (se houver) */
  error?: string;
}

/**
 * Interface principal do serviço de cache
 */
export interface ICacheService {
  /**
   * Recupera valor do cache
   * @param key - Chave única do cache
   * @returns Valor deserializado ou null se não encontrado
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Armazena valor no cache
   * @param key - Chave única do cache
   * @param value - Valor a ser armazenado (será serializado como JSON)
   * @param ttlSeconds - Time-to-live em segundos (opcional, usa default se não fornecido)
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Remove uma chave específica do cache
   * @param key - Chave a ser removida
   * @returns true se removida, false se não existia
   */
  del(key: string): Promise<boolean>;

  /**
   * Remove múltiplas chaves que correspondem ao pattern
   * Usa SCAN para evitar bloqueio do Redis
   * @param pattern - Pattern glob (ex: "reports:*", "accounts:uuid123:*")
   * @returns Número de chaves removidas
   */
  delPattern(pattern: string): Promise<number>;

  /**
   * Invalida (remove) múltiplas chaves de uma vez
   * @param keys - Array de chaves a serem removidas
   * @returns Número de chaves removidas
   */
  invalidate(keys: string[]): Promise<number>;

  /**
   * Limpa todo o cache (CUIDADO: usa FLUSHDB)
   * Apenas para uso em testes ou manutenção
   */
  flush(): Promise<void>;

  /**
   * Retorna estatísticas do cache
   * Inclui hit rate, memory usage, etc
   */
  getStats(): Promise<CacheStats>;

  /**
   * Verifica saúde do Redis
   * @returns Status de saúde com métricas
   */
  healthCheck(): Promise<RedisHealth>;
}

/**
 * Tipo para métricas internas de tracking
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  lastError?: Error;
  lastErrorTime?: Date;
}

/**
 * Opções para operações de cache
 */
export interface CacheOptions {
  /** TTL customizado em segundos */
  ttl?: number;
  /** Namespace/prefix para a chave */
  namespace?: string;
  /** Força refresh mesmo se existir no cache */
  forceRefresh?: boolean;
}

/**
 * Tipo para resultado de operação de cache
 */
export type CacheResult<T> = {
  /** Valor do cache (null se não encontrado) */
  value: T | null;
  /** Indica se foi cache hit */
  hit: boolean;
  /** Tempo de resposta da operação (ms) */
  responseTime: number;
};

/**
 * Enum para namespaces de cache (facilita consistência)
 */
export enum CacheNamespace {
  REPORTS = 'reports',
  ACCOUNTS = 'accounts',
  TAXES = 'taxes',
  DASHBOARD = 'dashboard',
  COMPANIES = 'companies',
  USERS = 'users',
  JOURNAL = 'journal',
}

/**
 * Enum para tipos de relatórios (usado nas cache keys)
 */
export enum ReportType {
  BALANCE_SHEET = 'balance-sheet',
  INCOME_STATEMENT = 'income-statement',
  TRIAL_BALANCE = 'trial-balance',
  LEDGER = 'ledger',
  CLIENT_MONTHLY = 'client-monthly',
  CLIENT_ANNUAL = 'client-annual',
  EXECUTIVE_SUMMARY = 'executive-summary',
}

/**
 * Tipo para construtor de cache key
 */
export type CacheKeyBuilder = (...args: any[]) => string;

/**
 * Interface para configuração de TTL por tipo
 */
export interface TTLConfig {
  [key: string]: number;
  REPORTS: number;
  ACCOUNTS: number;
  TAXES: number;
  DASHBOARD: number;
  DEFAULT: number;
}
