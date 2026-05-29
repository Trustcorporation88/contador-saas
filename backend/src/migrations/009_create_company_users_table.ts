/**
 * Migration: Create company_users table
 * Associa usuários a empresas com roles e permissões
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('company_users');
  if (exists) {
    console.log('[MIGRATIONS] Skipping company_users table (already exists)');
    return;
  }

  console.log('[MIGRATIONS] Creating company_users table...');
  
  await knex.schema.createTable('company_users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.string('role', 50).notNullable().defaultTo('user');
    table.json('permissions').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['user_id']);
    table.index(['company_id']);
    table.unique(['user_id', 'company_id']);
  });

  console.log('✓ company_users table created');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('company_users');
  console.log('✓ company_users table dropped');
}
