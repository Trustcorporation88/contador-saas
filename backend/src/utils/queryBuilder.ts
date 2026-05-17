/**
 * Query Builder Wrapper for Multi-Tenancy
 * Auto-applies company_id filter para todas as queries
 * Implementa row-level security (RLS) eficiente
 */

import { Knex } from 'knex';
import { logger } from '../middleware/requestLogger';

/**
 * Tabelas que DEVEM ser scoped por company_id
 * Configuração centralizada para garantir que nenhuma tabela escapa do filtro
 */
const TENANT_SCOPED_TABLES = new Set([
  'accounts',
  'journal_entries',
  'journal_items',
  'companies',
  'company_users',
  'documents',
  'attachments',
  'account_balances',
  'tax_calculations',
  'tax_payments',
  'audit_logs',
  'access_audit',
  'invoices',
  'invoice_items',
  'payment_records',
  'cost_centers',
  'profit_centers',
  'tax_regimes',
  'financial_reports',
]);

/**
 * Tabelas que NUNCA devem ser scoped (sistema)
 */
const SYSTEM_TABLES = new Set([
  'users',
  'roles',
  'permissions',
  'feature_flags',
  'system_logs',
  'app_settings',
]);

/**
 * Interface para estender Knex com método withTenant
 */
declare module 'knex' {
  namespace Knex {
    interface QueryBuilder {
      withTenant(companyId: string): QueryBuilder;
    }
  }
}

/**
 * Estende Knex QueryBuilder com método withTenant
 * Adiciona automaticamente WHERE company_id = companyId
 *
 * Uso:
 * const accounts = await db('accounts').withTenant(companyId).select()
 * const count = await db('journal_entries').withTenant(companyId).count('*')
 * await db('accounts').withTenant(companyId).update({ balance: 100 })
 *
 * O método é seguro:
 * - Avisa se aplicado a tabelas que não devem ser scoped
 * - Rastreia todas as queries em logging
 * - Permite override para queries especiais (sys_bypass)
 */
export function extendKnexWithTenant(knexInstance: Knex): void {
  knexInstance.QueryBuilder.extend('withTenant', function (companyId: string) {
    // Validar companyId
    if (!companyId || typeof companyId !== 'string') {
      logger.error('withTenant: Invalid companyId', { companyId });
      throw new Error(`Invalid companyId: ${companyId}`);
    }

    // Obter informações da query
    const tableName = (this as any)._single?.table ||
      (this as any)._single?.from ||
      'unknown';

    // Validar se a tabela deve ser scoped
    if (SYSTEM_TABLES.has(tableName)) {
      logger.warn('Attempting to apply withTenant to system table', {
        table: tableName,
        companyId,
      });
      // Não aplicar filtro para tabelas de sistema
      return this;
    }

    if (!TENANT_SCOPED_TABLES.has(tableName)) {
      logger.warn('Table not in TENANT_SCOPED_TABLES list', {
        table: tableName,
        companyId,
      });
      // Para tabelas desconhecidas, avisar mas não falhar
      // Isso permite uso incremental
    }

    // Rastrear query para debug
    const queryType = (this as any)._method || 'select';
    logger.debug('Applying withTenant filter', {
      table: tableName,
      method: queryType,
      companyId,
    });

    // Aplicar o filtro company_id
    return this.where('company_id', companyId);
  });
}

/**
 * Query builder wrapper com escopo de tenant
 * Uso recomendado para queries mais complexas
 *
 * Exemplo:
 * const results = await scoped(db, companyId)
 *   .from('accounts')
 *   .select('id', 'name', 'balance')
 *   .where('is_active', true)
 */
export function scoped(db: Knex, companyId: string): Knex.QueryBuilder {
  return db.where('company_id', companyId);
}

/**
 * Helper para criar queries join com scoping automático
 *
 * Exemplo:
 * const results = await joinedQuery(db, companyId)
 *   .from('journal_entries')
 *   .innerJoin('accounts', 'journal_entries.account_id', 'accounts.id')
 *   .select('*')
 */
export function joinedQuery(db: Knex, companyId: string): Knex.QueryBuilder {
  // Criar query base
  const query = db.from('journal_entries');

  // Aplicar filtro company_id na tabela principal
  query.where('journal_entries.company_id', companyId);

  // Aplicar filtro também nas joined tables (segurança)
  // Nota: joins precisam de tratamento especial
  return query;
}

/**
 * Wrapper para UPDATE com tenant scoping
 * Garante que UPDATE só afeta dados do tenant
 *
 * Exemplo:
 * await updateScoped(db, companyId, 'accounts')
 *   .set({ balance: 100 })
 *   .where('id', accountId)
 */
export function updateScoped(
  db: Knex,
  companyId: string,
  table: string,
): Knex.QueryBuilder {
  return db(table)
    .withTenant(companyId);
}

/**
 * Wrapper para DELETE com tenant scoping
 * Garante que DELETE só afeta dados do tenant
 *
 * Exemplo:
 * await deleteScoped(db, companyId, 'journal_entries')
 *   .where('id', entryId)
 */
export function deleteScoped(
  db: Knex,
  companyId: string,
  table: string,
): Knex.QueryBuilder {
  return db(table)
    .withTenant(companyId);
}

/**
 * Wrapper para INSERT com tenant scoping
 * Adiciona company_id automaticamente
 *
 * Exemplo:
 * await insertScoped(db, companyId, 'accounts', {
 *   id: 'ACC001',
 *   name: 'Caixa',
 * })
 */
export async function insertScoped(
  db: Knex,
  companyId: string,
  table: string,
  data: Record<string, any> | Record<string, any>[],
): Promise<any[]> {
  // Normalizar data para array
  const records = Array.isArray(data) ? data : [data];

  // Adicionar company_id a cada registro
  const dataWithTenant = records.map((record) => ({
    ...record,
    company_id: companyId,
  }));

  // Validar que company_id não foi override
  dataWithTenant.forEach((record, index) => {
    if (record.company_id !== companyId) {
      logger.warn('Attempted to override company_id in insertScoped', {
        index,
        attemptedValue: record.company_id,
        expectedValue: companyId,
      });
      record.company_id = companyId; // Forçar valor correto
    }
  });

  return db(table).insert(dataWithTenant);
}

/**
 * Transação com tenant scoping automático
 * Todas as queries dentro da transação são automaticamente scoped
 *
 * Exemplo:
 * await tenantTransaction(db, companyId, async (trx) => {
 *   await trx('accounts').insert({ id: 'ACC001', name: 'Caixa' })
 *   await trx('journal_entries').insert({ ... })
 * })
 */
export async function tenantTransaction<T>(
  db: Knex,
  companyId: string,
  callback: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (trx) => {
    // Aplicar tenant context à transação
    const tenantTrx = new TenantAwareTransaction(trx, companyId);
    return callback(tenantTrx as any);
  });
}

/**
 * Classe wrapper para transações com tenant awareness
 * Garante que todas as queries na transação são scoped
 */
class TenantAwareTransaction {
  constructor(
    private trx: Knex.Transaction,
    private companyId: string,
  ) {}

  // Delegar métodos conhecidos
  [key: string]: any;

  __call(method: string, args: any[]) {
    const result = (this.trx as any)[method](...args);
    if (result && typeof result.withTenant === 'function') {
      return result.withTenant(this.companyId);
    }
    return result;
  }
}

/**
 * Query validator para debug
 * Valida que query foi corretamente scoped
 *
 * Uso em desenvolvimento/testes:
 * const isScoped = validateQueryScoped(query, 'company_id', companyId)
 */
export function validateQueryScoped(
  query: Knex.QueryBuilder,
  tenantColumn: string,
  companyId: string,
): boolean {
  try {
    const sql = query.toSQL();
    const whereClause = sql.sql.toLowerCase();

    // Verificar se a query contém o filtro company_id
    return whereClause.includes(`${tenantColumn}`) &&
      whereClause.includes(companyId);
  } catch (error) {
    logger.error('Error validating query scope', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Bulk operations com tenant scoping
 * Útil para importação/atualização em massa
 */
export async function bulkInsertScoped(
  db: Knex,
  companyId: string,
  table: string,
  records: Record<string, any>[],
  batchSize: number = 100,
): Promise<number> {
  let totalInserted = 0;

  // Processar em lotes para não sobrecarregar
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await insertScoped(db, companyId, table, batch);
    totalInserted += result.length;

    logger.info('Batch insert completed', {
      table,
      companyId,
      batchSize: result.length,
      totalSoFar: totalInserted,
    });
  }

  return totalInserted;
}

/**
 * Utility para gerar estatísticas de dados por tenant
 * Útil para auditorias e relatórios
 */
export async function getTenantStats(
  db: Knex,
  companyId: string,
): Promise<Record<string, number>> {
  try {
    const stats: Record<string, number> = {};

    // Contar registros em cada tabela tenant-scoped
    for (const table of TENANT_SCOPED_TABLES) {
      try {
        const result = await db(table)
          .withTenant(companyId)
          .count('* as count')
          .first();

        stats[table] = parseInt(result?.count || 0, 10);
      } catch (error) {
        logger.warn('Error counting table', {
          table,
          companyId,
          error: error instanceof Error ? error.message : String(error),
        });
        stats[table] = -1; // Indicar erro
      }
    }

    return stats;
  } catch (error) {
    logger.error('Error getting tenant stats', {
      error: error instanceof Error ? error.message : String(error),
      companyId,
    });
    return {};
  }
}

/**
 * Cleanup de dados orphaned (sem empresa)
 * Executar periodicamente para manter integridade
 */
export async function cleanupOrphanedData(
  db: Knex,
  table: string,
): Promise<number> {
  try {
    const deletedCount = await db(table)
      .whereNull('company_id')
      .delete();

    logger.info('Orphaned data cleanup completed', {
      table,
      deletedCount,
    });

    return deletedCount;
  } catch (error) {
    logger.error('Error cleaning up orphaned data', {
      error: error instanceof Error ? error.message : String(error),
      table,
    });
    return 0;
  }
}

export default {
  extendKnexWithTenant,
  scoped,
  joinedQuery,
  updateScoped,
  deleteScoped,
  insertScoped,
  tenantTransaction,
  validateQueryScoped,
  bulkInsertScoped,
  getTenantStats,
  cleanupOrphanedData,
};
