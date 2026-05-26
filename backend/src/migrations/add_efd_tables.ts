/**
 * Migration: Create EFD Tables
 * Creates tables for EFD (Escrituração Fiscal Digital) generation and management
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Table: efd_generations
  // Stores EFD generation history and metadata
  await knex.schema.createTable('efd_generations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.integer('month').notNullable().checkBetween([1, 12]); // 1-12
    table.integer('year').notNullable(); // 2024+
    table
      .enum('status', [
        'pending',
        'generating',
        'generated',
        'validating',
        'validated',
        'validation_failed',
        'sent',
        'rejected',
        'cancelled',
      ])
      .notNullable()
      .defaultTo('pending');
    
    table.timestamp('generated_at').nullable();
    table.timestamp('validated_at').nullable();
    table.timestamp('sent_at').nullable();
    table.string('file_path', 500).nullable();
    table.specificType('validation_errors', 'text[]').nullable().defaultTo('{}');
    table.jsonb('metadata').nullable();
    
    // Financial totals
    table.decimal('total_debit', 15, 2).defaultTo(0);
    table.decimal('total_credit', 15, 2).defaultTo(0);
    table.decimal('debit_credit_diff', 15, 2).defaultTo(0);
    table.boolean('debit_credit_balanced').defaultTo(false);
    
    // Record counts
    table.integer('record_count').defaultTo(0);
    table.integer('journal_entries_count').defaultTo(0);
    table.integer('inventory_items_count').defaultTo(0);
    
    // Audit
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    
    // Indexes for performance
    table.index(['company_id']);
    table.index(['status']);
    table.index(['year', 'month']);
    table.index(['created_at']);
    table.unique(['company_id', 'year', 'month']); // One EFD per company/month/year
  });

  // Table: efd_records
  // Individual records in the EFD file (E100, E110, E200, E990, etc)
  await knex.schema.createTable('efd_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('generation_id').notNullable().references('id').inTable('efd_generations').onDelete('CASCADE');
    
    table.string('record_type', 10).notNullable(); // E100, E110, E200, etc
    table.integer('sequence').notNullable(); // Position in file
    table.jsonb('fields').notNullable(); // All record fields as JSON
    
    // Record-specific data
    table.string('document_number', 50).nullable();
    table.date('document_date').nullable();
    table.decimal('debit_value', 15, 2).nullable();
    table.decimal('credit_value', 15, 2).nullable();
    
    table.text('raw_line').nullable(); // Raw RFB format line for debugging
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['generation_id']);
    table.index(['record_type']);
    table.index(['sequence']);
  });

  // Table: efd_validations
  // Validation history for each generation
  await knex.schema.createTable('efd_validations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('generation_id').notNullable().references('id').inTable('efd_generations').onDelete('CASCADE');
    
    table.boolean('is_valid').defaultTo(false);
    table.specificType('validation_errors', 'text[]').nullable().defaultTo('{}');
    table.specificType('validation_warnings', 'text[]').nullable().defaultTo('{}');
    
    // Totals verification
    table.decimal('total_debit', 15, 2).defaultTo(0);
    table.decimal('total_credit', 15, 2).defaultTo(0);
    table.decimal('debit_credit_diff', 15, 2).defaultTo(0);
    
    // Counts
    table.integer('total_records').defaultTo(0);
    table.integer('error_count').defaultTo(0);
    table.integer('warning_count').defaultTo(0);
    
    table.text('validation_report').nullable();
    table.timestamp('validated_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['generation_id']);
  });

  // Table: efd_account_balances
  // Account balances for each EFD period (for validation)
  await knex.schema.createTable('efd_account_balances', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('generation_id').notNullable().references('id').inTable('efd_generations').onDelete('CASCADE');
    table.uuid('account_id').notNullable();
    
    table.string('account_code', 50).notNullable();
    table.string('account_name', 255).notNullable();
    table.decimal('opening_balance', 15, 2).defaultTo(0);
    table.decimal('debit_total', 15, 2).defaultTo(0);
    table.decimal('credit_total', 15, 2).defaultTo(0);
    table.decimal('closing_balance', 15, 2).defaultTo(0);
    table.string('balance_type', 10).nullable(); // 'debit' or 'credit'
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['generation_id']);
    table.index(['account_code']);
  });

  // Table: efd_journal_entries
  // Journal entries included in EFD for audit trail
  await knex.schema.createTable('efd_journal_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('generation_id').notNullable().references('id').inTable('efd_generations').onDelete('CASCADE');
    table.uuid('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');
    
    table.integer('sequence').notNullable();
    table.uuid('account_from_id').nullable();
    table.uuid('account_to_id').nullable();
    table.string('account_from_code', 50).nullable();
    table.string('account_to_code', 50).nullable();
    
    table.text('description').notNullable();
    table.decimal('debit_value', 15, 2).defaultTo(0);
    table.decimal('credit_value', 15, 2).defaultTo(0);
    table.date('entry_date').notNullable();
    table.string('document_number', 50).nullable();
    table.string('reference_document', 100).nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['generation_id']);
    table.index(['journal_entry_id']);
    table.index(['account_from_code']);
    table.index(['account_to_code']);
  });

  // Table: efd_scheduler_config
  // Configuration for automatic EFD generation scheduling
  await knex.schema.createTable('efd_scheduler_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE').unique();
    
    table.boolean('enabled').defaultTo(true);
    table.integer('day_of_month').defaultTo(5); // 5th day
    table.integer('hour').defaultTo(8); // 08:00
    table.integer('minute').defaultTo(0);
    table.string('timezone', 50).defaultTo('America/Sao_Paulo');
    
    table.boolean('auto_generate').defaultTo(true);
    table.boolean('notify_on_completion').defaultTo(true);
    table.boolean('notify_on_error').defaultTo(true);
    table.string('notification_email', 255).nullable();
    
    // Advanced options
    table.boolean('include_operations').defaultTo(true);
    table.boolean('include_inventory').defaultTo(false);
    table.boolean('include_adjustments').defaultTo(true);
    table.integer('retention_days').defaultTo(90); // Keep EFD files for 90 days
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['company_id']);
  });

  // Table: efd_rfb_submissions
  // History of submissions to RFB (future integration)
  await knex.schema.createTable('efd_rfb_submissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('generation_id').notNullable().references('id').inTable('efd_generations').onDelete('CASCADE');
    
    table.enum('status', ['pending', 'submitted', 'accepted', 'rejected', 'processing']).defaultTo('pending');
    table.string('rfb_protocol', 100).nullable();
    table.string('submission_date', 50).nullable();
    table.text('rfb_response').nullable();
    
    table.specificType('rfb_errors', 'text[]').nullable().defaultTo('{}');
    
    table.timestamp('submitted_at').nullable();
    table.timestamp('response_received_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['generation_id']);
    table.index(['status']);
    table.index(['rfb_protocol']);
  });

  // Table: efd_audit_log
  // Audit trail for all EFD operations
  await knex.schema.createTable('efd_audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('generation_id').notNullable().references('id').inTable('efd_generations').onDelete('CASCADE');
    table.uuid('user_id').nullable();
    
    table.string('action', 50).notNullable(); // 'generate', 'validate', 'send', 'download', etc
    table.string('status', 50).notNullable(); // 'success', 'failed', 'pending'
    table.text('details').nullable();
    table.text('error_message').nullable();
    
    table.timestamp('performed_at').defaultTo(knex.fn.now());
    
    table.index(['generation_id']);
    table.index(['user_id']);
    table.index(['action']);
  });

  // Indexes for common queries
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_efd_company_period 
    ON efd_generations(company_id, year, month);
  `);

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_efd_status_date 
    ON efd_generations(status, created_at);
  `);

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_efd_record_generation_seq 
    ON efd_records(generation_id, sequence);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation
  await knex.schema.dropTableIfExists('efd_audit_log');
  await knex.schema.dropTableIfExists('efd_rfb_submissions');
  await knex.schema.dropTableIfExists('efd_scheduler_config');
  await knex.schema.dropTableIfExists('efd_journal_entries');
  await knex.schema.dropTableIfExists('efd_account_balances');
  await knex.schema.dropTableIfExists('efd_validations');
  await knex.schema.dropTableIfExists('efd_records');
  await knex.schema.dropTableIfExists('efd_generations');
}
