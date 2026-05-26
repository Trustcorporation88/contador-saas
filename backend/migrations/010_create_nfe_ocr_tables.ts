/**
 * Migration: Create NF-e OCR tables
 * Creates nfe_uploads and nfe_registry tables for OCR functionality
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if tables exist
  const hasNfeUploads = await knex.schema.hasTable('nfe_uploads');
  const hasNfeRegistry = await knex.schema.hasTable('nfe_registry');

  if (!hasNfeUploads) {
    await knex.schema.createTable('nfe_uploads', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').notNullable();
      table.string('file_name', 255).notNullable();
      table.string('file_path', 500).nullable();
      table.enum('file_type', ['pdf', 'image']).notNullable();
      table.integer('file_size').notNullable();
      table.jsonb('ocr_data').notNullable().defaultTo('{}');
      table.enum('status', ['uploaded', 'extracted', 'confirmed', 'error']).notNullable().defaultTo('uploaded');
      table.decimal('extraction_confidence', 3, 2).notNullable().defaultTo(0);
      table.text('error_message').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      // Indexes
      table.index('company_id');
      table.index('status');
      table.index('created_at');

      // Foreign key
      table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    });
    console.log('✓ Created nfe_uploads table');
  }

  if (!hasNfeRegistry) {
    await knex.schema.createTable('nfe_registry', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').notNullable();
      table.string('invoice_key', 44).notNullable().unique();
      table.string('nf_number', 20).notNullable();
      table.string('nf_series', 10).notNullable();
      table.string('issuer_cnpj', 14).notNullable();
      table.decimal('total_value', 15, 2).notNullable();
      table.date('emission_date').notNullable();
      table.uuid('journal_entry_id').nullable();
      table.enum('sefaz_status', ['valid', 'invalid', 'pending']).notNullable().defaultTo('pending');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      // Indexes
      table.index('company_id');
      table.index('invoice_key');
      table.index('issuer_cnpj');
      table.index('sefaz_status');

      // Foreign keys
      table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
      table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');
    });
    console.log('✓ Created nfe_registry table');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order due to foreign keys
  await knex.schema.dropTableIfExists('nfe_registry');
  await knex.schema.dropTableIfExists('nfe_uploads');
  console.log('✓ Dropped nfe_uploads and nfe_registry tables');
}
