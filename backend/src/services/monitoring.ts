/**
 * MonitoringService — Coleta de métricas de saúde e performance
 *
 * Padrão Singleton: uma única instância por processo Node.js.
 * Uso no middleware de request para registrar duração e erros.
 * Expõe métricas via /api/v1/health e /api/v1/metrics.
 */

/** Estrutura de métricas exportadas pelo serviço */
export interface HealthMetrics {
  /** Tempo de atividade do processo em segundos */
  uptime: number;
  /** Total acumulado de requisições recebidas */
  totalRequests: number;
  /** Taxa de erro (0–1) calculada como rolling average */
  errorRate: number;
  /** Tempo médio de resposta em milissegundos (rolling average) */
  avgResponseTime: number;
  /** Taxa de acerto do cache Redis (0–1) */
  cacheHitRate: number;
  /** Timestamp da última atualização das métricas */
  lastUpdated: string;
}

/** Snapshot por status HTTP (para análise de erros por tipo) */
interface StatusCodeMap {
  [statusCode: number]: number;
}

export class MonitoringService {
  private static instance: MonitoringService;

  private totalRequests = 0;
  private totalErrors = 0;
  private totalResponseTime = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private statusCodes: StatusCodeMap = {};
  private startTime = Date.now();

  // ─── Construtor privado (Singleton) ─────────────────────────
  private constructor() {}

  /**
   * Retorna a instância única do MonitoringService.
   * Cria na primeira chamada, reutiliza nas seguintes.
   */
  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // ─── Registro de requests ─────────────────────────────────

  /**
   * Registra uma requisição HTTP concluída.
   *
   * @param durationMs  Duração em milissegundos
   * @param statusCode  Código de status HTTP (ex: 200, 404, 500)
   */
  recordRequest(durationMs: number, statusCode: number): void {
    this.totalRequests++;
    this.totalResponseTime += durationMs;

    // Contagem por status code
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] ?? 0) + 1;

    // Erros = 5xx
    if (statusCode >= 500) {
      this.totalErrors++;
    }
  }

  /**
   * Registra um hit ou miss no cache Redis.
   *
   * @param hit  true se o cache serviu a resposta, false se foi miss
   */
  recordCacheEvent(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  // ─── Leitura de métricas ──────────────────────────────────

  /**
   * Retorna o snapshot atual de todas as métricas de saúde.
   */
  getMetrics(): HealthMetrics {
    const totalCacheEvents = this.cacheHits + this.cacheMisses;

    return {
      uptime: process.uptime(),
      totalRequests: this.totalRequests,
      errorRate: this.totalRequests > 0
        ? this.totalErrors / this.totalRequests
        : 0,
      avgResponseTime: this.totalRequests > 0
        ? Math.round(this.totalResponseTime / this.totalRequests)
        : 0,
      cacheHitRate: totalCacheEvents > 0
        ? this.cacheHits / totalCacheEvents
        : 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Retorna a contagem de requests agrupada por código HTTP.
   * Útil para dashboards de observabilidade.
   */
  getStatusCodeBreakdown(): StatusCodeMap {
    return { ...this.statusCodes };
  }

  /**
   * Retorna métricas de cache separadas.
   */
  getCacheMetrics(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  /**
   * Retorna o tempo total de atividade em milissegundos.
   */
  getUptimeMs(): number {
    return Date.now() - this.startTime;
  }

  // ─── Reset (útil em testes) ───────────────────────────────

  /**
   * Reseta todos os contadores para zero.
   * Use apenas em testes — nunca em produção.
   */
  reset(): void {
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.totalResponseTime = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.statusCodes = {};
    this.startTime = Date.now();
  }
}

// ─── Middleware Express ──────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware Express que registra automaticamente duração e
 * status code de cada requisição no MonitoringService.
 *
 * Uso:
 * ```ts
 * import { requestMonitoringMiddleware } from './services/monitoring';
 * app.use(requestMonitoringMiddleware);
 * ```
 */
export function requestMonitoringMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const monitoring = MonitoringService.getInstance();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    monitoring.recordRequest(durationMs, res.statusCode);
  });

  next();
}

// ─── Handler de health check ─────────────────────────────────

/**
 * Handler Express para o endpoint GET /api/v1/health.
 *
 * Retorna HTTP 200 com métricas quando saudável,
 * HTTP 503 se o processo estiver em estado crítico.
 *
 * Uso:
 * ```ts
 * import { healthCheckHandler } from './services/monitoring';
 * router.get('/health', healthCheckHandler);
 * ```
 */
export function healthCheckHandler(req: Request, res: Response): void {
  const monitoring = MonitoringService.getInstance();
  const metrics = monitoring.getMetrics();

  // Considera crítico se taxa de erro > 50% nas últimas métricas
  const isCritical = metrics.totalRequests > 10 && metrics.errorRate > 0.5;
  const status = isCritical ? 503 : 200;

  res.status(status).json({
    status: isCritical ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: process.env['APP_VERSION'] ?? '1.0.0',
    environment: process.env['NODE_ENV'] ?? 'development',
    metrics: {
      uptime: `${Math.floor(metrics.uptime)}s`,
      totalRequests: metrics.totalRequests,
      errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
      avgResponseTime: `${metrics.avgResponseTime}ms`,
      cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
    },
  });
}
