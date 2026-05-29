/**
 * Migration: Add missing columns and tables
 * Adiciona fiscal_year_start em companies e cria audit_logs
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Adicionar coluna fiscal_year_start em companies
  const companiesHasColumn = await knex.schema.hasColumn('companies', 'fiscal_year_start');
  if (!companiesHasColumn) {
    console.log('[MIGRATIONS] Adding fiscal_year_start to companies table...');
    await knex.schema.alterTable('companies', (table) => {
      table.integer('fiscal_year_start').defaultTo(1).nullable();
    });
  }

  // Adicionar coluna tax_regime em companies
  const companiesHasTaxRegime = await knex.schema.hasColumn('companies', 'tax_regime');
  if (!companiesHasTaxRegime) {
    console.log('[MIGRATIONS] Adding tax_regime to companies table...');
    await knex.schema.alterTable('companies', (table) => {
      table.string('tax_regime', 50).nullable();
    });
  }

  // Criar tabela audit_logs
  const auditLogsExists = await knex.schema.hasTable('audit_logs');
  if (!auditLogsExists) {
    console.log('[MIGRATIONS] Creating audit_logs table...');
    await knex.schema.createTable('audit_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').nullable();
      table.string('action', 50).notNullable();
      table.string('entity_type', 100).notNullable();
      table.uuid('entity_id').notNullable();
      table.json('old_value').nullable();
      table.json('new_value').nullable();
      table.string('status', 50).notNullable();
      table.string('ip_address', 50).nullable();
      table.string('user_agent', 500).nullable();
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.index(['user_id']);
      table.index(['entity_type']);
      table.index(['entity_id']);
      table.index(['timestamp']);
    });
  }

  console.log('✅ Migration: Add missing columns and tables completed');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
  
  const companiesHasColumn = await knex.schema.hasColumn('companies', 'fiscal_year_start');
  if (companiesHasColumn) {
    await knex.schema.alterTable('companies', (table) => {
      table.dropColumn('fiscal_year_start');
    });
  }

  const companiesHasTaxRegime = await knex.schema.hasColumn('companies', 'tax_regime');
  if (companiesHasTaxRegime) {
    await knex.schema.alterTable('companies', (table) => {
      table.dropColumn('tax_regime');
    });
  }

  console.log('✅ Migration: Add missing columns and tables rolled back');
}
