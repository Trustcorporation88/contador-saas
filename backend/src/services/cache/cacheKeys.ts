/**
 * Cache Keys Helper
 * Funções utilitárias para gerar cache keys consistentes e multi-tenant aware
 */

import crypto from 'crypto';
import { CacheNamespace, ReportType } from './types';

/**
 * Gera hash MD5 de um objeto para usar em cache key
 * Útil para criar keys únicas baseadas em filtros complexos
 */
function hashObject(obj: any): string {
  const str = JSON.stringify(obj);
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
}

/**
 * Sanitiza string para uso em cache key
 * Remove caracteres especiais e limita tamanho
 */
function sanitize(str: string, maxLength: number = 50): string {
  return str
    .replace(/[^a-zA-Z0-9-_.]/g, '-')
    .substring(0, maxLength)
    .toLowerCase();
}

/**
 * Cache Keys Generator
 * Todas as funções seguem o pattern: {namespace}:{companyId}:{resource}:{params}
 */
export class CacheKeys {
  // ============================================
  // REPORTS CACHE KEYS
  // ============================================

  /**
   * Cache key para Balanço Patrimonial
   * @param companyId - UUID da empresa
   * @param dateTo - Data de corte (YYYY-MM-DD ou 'today')
   */
  static balanceSheet(companyId: string, dateTo?: string): string {
    const date = dateTo || 'today';
    return `${CacheNamespace.REPORTS}:${companyId}:${ReportType.BALANCE_SHEET}:${sanitize(date)}`;
  }

  /**
   * Cache key para DRE (Income Statement)
   * @param companyId - UUID da empresa
   * @param dateFrom - Data inicial (YYYY-MM-DD)
   * @param dateTo - Data final (YYYY-MM-DD)
   */
  static incomeStatement(
    companyId: string,
    dateFrom: string,
    dateTo: string
  ): string {
    return `${CacheNamespace.REPORTS}:${companyId}:${ReportType.INCOME_STATEMENT}:${sanitize(dateFrom)}:${sanitize(dateTo)}`;
  }

  /**
   * Cache key para Balancete (Trial Balance)
   * @param companyId - UUID da empresa
   * @param dateFrom - Data inicial (YYYY-MM-DD)
   * @param dateTo - Data final (YYYY-MM-DD)
   */
  static trialBalance(
    companyId: string,
    dateFrom: string,
    dateTo: string
  ): string {
    return `${CacheNamespace.REPORTS}:${companyId}:${ReportType.TRIAL_BALANCE}:${sanitize(dateFrom)}:${sanitize(dateTo)}`;
  }

  /**
   * Cache key para Livro Razão
   */
  static ledger(companyId: string, dateFrom: string, dateTo: string): string {
    return `${CacheNamespace.REPORTS}:${companyId}:${ReportType.LEDGER}:${sanitize(dateFrom)}:${sanitize(dateTo)}`;
  }

  /**
   * Cache key para Client Monthly Summary
   */
  static clientMonthlySummary(companyId: string, period: string): string {
    return `${CacheNamespace.REPORTS}:${companyId}:${ReportType.CLIENT_MONTHLY}:${sanitize(period)}`;
  }

  /**
   * Cache key para Client Annual Summary
   */
  static clientAnnualSummary(companyId: string, year: number): string {
    return `${CacheNamespace.REPORTS}:${companyId}:${ReportType.CLIENT_ANNUAL}:${year}`;
  }

  /**
   * Cache key para Executive Summary
   */
  static executiveSummary(
    companyId: string,
    dateFrom: string,
    dateTo: string
  ): string {
    return `${CacheNamespace.REPORTS}:${companyId}:${ReportType.EXECUTIVE_SUMMARY}:${sanitize(dateFrom)}:${sanitize(dateTo)}`;
  }

  // ============================================
  // ACCOUNTS CACHE KEYS
  // ============================================

  /**
   * Cache key para árvore de contas (hierarchy)
   * @param companyId - UUID da empresa
   */
  static accountsTree(companyId: string): string {
    return `${CacheNamespace.ACCOUNTS}:${companyId}:tree`;
  }

  /**
   * Cache key para lista de contas com filtros
   * @param companyId - UUID da empresa
   * @param filters - Objeto com filtros aplicados
   */
  static accountsList(companyId: string, filters: any): string {
    const filtersHash = hashObject(filters);
    return `${CacheNamespace.ACCOUNTS}:${companyId}:list:${filtersHash}`;
  }

  /**
   * Cache key para uma conta específica
   */
  static account(companyId: string, accountCode: string): string {
    return `${CacheNamespace.ACCOUNTS}:${companyId}:account:${sanitize(accountCode)}`;
  }

  // ============================================
  // TAXES CACHE KEYS
  // ============================================

  /**
   * Cache key para cálculo de impostos
   * @param companyId - UUID da empresa
   * @param periodStart - Data inicial (YYYY-MM-DD)
   * @param periodEnd - Data final (YYYY-MM-DD)
   * @param regime - Regime tributário (SIMPLES, LUCRO_PRESUMIDO, etc)
   */
  static taxCalculation(
    companyId: string,
    periodStart: string,
    periodEnd: string,
    regime: string
  ): string {
    return `${CacheNamespace.TAXES}:${companyId}:calculation:${sanitize(periodStart)}:${sanitize(periodEnd)}:${sanitize(regime)}`;
  }

  /**
   * Cache key para lista de apurações fiscais
   * @param companyId - UUID da empresa
   * @param filters - Filtros aplicados
   */
  static taxAppraisalList(companyId: string, filters: any): string {
    const filtersHash = hashObject(filters);
    return `${CacheNamespace.TAXES}:${companyId}:appraisal:list:${filtersHash}`;
  }

  /**
   * Cache key para apuração fiscal específica
   */
  static taxAppraisal(companyId: string, appraisalId: string): string {
    return `${CacheNamespace.TAXES}:${companyId}:appraisal:${sanitize(appraisalId)}`;
  }

  // ============================================
  // DASHBOARD CACHE KEYS
  // ============================================

  /**
   * Cache key para dashboard summary
   * @param companyId - UUID da empresa
   * @param period - Período (YYYY-MM ou YYYY)
   */
  static dashboardSummary(companyId: string, period: string): string {
    return `${CacheNamespace.DASHBOARD}:${companyId}:summary:${sanitize(period)}`;
  }

  /**
   * Cache key para métricas do dashboard
   */
  static dashboardMetrics(companyId: string, metricType: string): string {
    return `${CacheNamespace.DASHBOARD}:${companyId}:metrics:${sanitize(metricType)}`;
  }

  // ============================================
  // JOURNAL CACHE KEYS
  // ============================================

  /**
   * Cache key para journal entries
   */
  static journalEntries(companyId: string, filters: any): string {
    const filtersHash = hashObject(filters);
    return `${CacheNamespace.JOURNAL}:${companyId}:entries:${filtersHash}`;
  }

  // ============================================
  // PATTERNS FOR INVALIDATION
  // ============================================

  /**
   * Pattern para invalidar TODOS os caches de uma empresa
   */
  static companyPattern(companyId: string): string {
    return `*:${companyId}:*`;
  }

  /**
   * Pattern para invalidar todos os relatórios de uma empresa
   */
  static reportsPattern(companyId: string): string {
    return `${CacheNamespace.REPORTS}:${companyId}:*`;
  }

  /**
   * Pattern para invalidar todas as accounts de uma empresa
   */
  static accountsPattern(companyId: string): string {
    return `${CacheNamespace.ACCOUNTS}:${companyId}:*`;
  }

  /**
   * Pattern para invalidar todos os taxes de uma empresa
   */
  static taxesPattern(companyId: string): string {
    return `${CacheNamespace.TAXES}:${companyId}:*`;
  }

  /**
   * Pattern para invalidar dashboard de uma empresa
   */
  static dashboardPattern(companyId: string): string {
    return `${CacheNamespace.DASHBOARD}:${companyId}:*`;
  }

  /**
   * Pattern para invalidar journal entries de uma empresa
   */
  static journalPattern(companyId: string): string {
    return `${CacheNamespace.JOURNAL}:${companyId}:*`;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Extrai companyId de uma cache key
   * Útil para debugging
   */
  static extractCompanyId(key: string): string | null {
    const parts = key.split(':');
    if (parts.length >= 2) {
      return parts[1];
    }
    return null;
  }

  /**
   * Extrai namespace de uma cache key
   */
  static extractNamespace(key: string): string | null {
    const parts = key.split(':');
    if (parts.length >= 1) {
      return parts[0];
    }
    return null;
  }

  /**
   * Valida se uma cache key está no formato correto
   */
  static isValidKey(key: string): boolean {
    const parts = key.split(':');
    // Mínimo: namespace:companyId:resource
    return parts.length >= 3;
  }
}

/**
 * Export default
 */
export default CacheKeys;
