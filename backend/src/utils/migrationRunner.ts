/**
 * Database Migration Runner
 * Automatically detects and runs missing migrations
 * Safe to call multiple times (idempotent)
 */

import { Knex } from 'knex';

// Track which migrations have been run
const executedMigrations = new Set<string>();

/**
 * Simple migration runner
 * Each migration is a function that takes knex instance
 */
export async function runMigrationsIfNeeded(db: Knex): Promise<void> {
  try {
    // Ensure migrations tracking table exists
    const migrationsTableExists = await db.schema.hasTable('migrations_executed');
    if (!migrationsTableExists) {
      console.log('[MIGRATIONS] Creating migrations tracking table...');
      await db.schema.createTable('migrations_executed', (table) => {
        table.increments('id').primary();
        table.string('migration_name').unique().notNullable();
        table.timestamp('executed_at').defaultTo(db.fn.now());
      });
    }

    // Load list of executed migrations
    const executed = await db('migrations_executed').select('migration_name');
    executed.forEach((row: any) => executedMigrations.add(row.migration_name));

    // Define migrations in order
    const migrations: Array<{ name: string; up: (db: Knex) => Promise<void> }> = [
      {
        name: '001_create_auth_tables',
        up: async (db) => {
          const usersExists = await db.schema.hasTable('users');
          const companiesExists = await db.schema.hasTable('companies');

          if (usersExists && companiesExists) {
            console.log('[MIGRATIONS] Skipping 001_create_auth_tables (already exists)');
            return;
          }

          if (!usersExists) {
            console.log('[MIGRATIONS] Creating users table...');
            await db.schema.createTable('users', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('company_id').notNullable();
              table.string('email', 255).notNullable().unique();
              table.string('password_hash', 255).notNullable();
              table.string('full_name', 255);
              table.string('role', 50).defaultTo('user');
              table.boolean('is_active').defaultTo(true);
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
              table.index(['company_id']);
              table.index(['email']);
            });
          }

          if (!companiesExists) {
            console.log('[MIGRATIONS] Creating companies table...');
            await db.schema.createTable('companies', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.string('cnpj', 14).unique().notNullable();
              table.string('legal_name', 255).notNullable();
              table.string('trade_name', 255);
              table.string('email', 255);
              table.string('phone', 20);
              table.string('address', 255);
              table.string('city', 100);
              table.string('state', 2);
              table.string('postal_code', 10);
              table.string('status', 50).defaultTo('active');
              table.boolean('is_active').defaultTo(true);
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
              table.index(['cnpj']);
            });
          }

          console.log('✓ 001_create_auth_tables completed');
        },
      },
      {
        name: '002_create_documentos_fiscais_tables',
        up: async (db) => {
          const exists = await db.schema.hasTable('documentos_fiscais');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 002_create_documentos_fiscais_tables (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Running 002_create_documentos_fiscais_tables...');

          // Main table
          await db.schema.createTable('documentos_fiscais', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('company_id').notNullable();
            table.uuid('created_by').notNullable();
            table.string('tipo', 50).notNullable(); // nfe, boleto, recibo, cupom_fiscal
            table.string('numero', 50).notNullable();
            table.string('serie', 20).notNullable();
            table.text('descricao');
            table.date('data_emissao').notNullable();
            table.date('data_vencimento');
            table.decimal('valor_total', 15, 2);
            table.decimal('valor_impostos', 15, 2).defaultTo(0);
            table.decimal('valor_desconto', 15, 2).defaultTo(0);
            table.string('contraparte_cnpj', 14);
            table.string('contraparte_nome', 255);
            table.string('contraparte_email', 255);
            table.string('contraparte_telefone', 20);
            table.string('status', 50).defaultTo('rascunho'); // rascunho, registrado, cancelado
            table.boolean('registrado_no_diario').defaultTo(false);
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());

            // Indices
            table.index(['company_id']);
            table.index(['created_by']);
            table.index(['tipo']);
            table.index(['status']);
            table.index(['data_emissao']);
            table.index(['contraparte_cnpj']);

            // Unique constraint
            table.unique(['company_id', 'tipo', 'serie', 'numero']);
          });

          // Items table
          await db.schema.createTable('itens_documentos_fiscais', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('documento_fiscal_id').notNullable().references('id').inTable('documentos_fiscais').onDelete('CASCADE');
            table.text('descricao').notNullable();
            table.string('codigo_produto', 50);
            table.decimal('quantidade', 15, 6).notNullable();
            table.decimal('valor_unitario', 15, 2).notNullable();
            table.decimal('valor_total', 15, 2).notNullable();
            table.decimal('aliquota_icms', 5, 2).defaultTo(0);
            table.decimal('valor_icms', 15, 2).defaultTo(0);
            table.decimal('aliquota_ipi', 5, 2).defaultTo(0);
            table.decimal('valor_ipi', 15, 2).defaultTo(0);
            table.decimal('aliquota_pis', 5, 2).defaultTo(0);
            table.decimal('aliquota_cofins', 5, 2).defaultTo(0);
            table.integer('ordem').defaultTo(0);
            table.timestamp('created_at').defaultTo(db.fn.now());

            // Indices
            table.index(['documento_fiscal_id']);
          });

          // Attachments table
          await db.schema.createTable('anexos_documentos_fiscais', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('documento_fiscal_id').notNullable().references('id').inTable('documentos_fiscais').onDelete('CASCADE');
            table.string('arquivo_nome', 255).notNullable();
            table.string('arquivo_mime', 100);
            table.integer('arquivo_tamanho');
            table.string('tipo', 50); // xml, imagem, pdf, outro
            table.string('arquivo_url', 255);
            table.timestamp('created_at').defaultTo(db.fn.now());

            // Indices
            table.index(['documento_fiscal_id']);
          });

          console.log('✓ 002_create_documentos_fiscais_tables completed');
        },
      },
      {
        name: '003_create_contas_receber_tables',
        up: async (db) => {
          const exists = await db.schema.hasTable('contas_receber');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 003_create_contas_receber_tables (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Running 003_create_contas_receber_tables...');

          await db.schema.createTable('contas_receber', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('company_id').notNullable();
            table.uuid('created_by').notNullable();
            table.uuid('updated_by').nullable();
            table.uuid('documento_fiscal_id').nullable();
            table.string('categoria', 40).notNullable();
            table.string('numero_titulo', 60).notNullable();
            table.text('descricao').notNullable();
            table.string('cliente_nome', 255).notNullable();
            table.string('cliente_cnpj', 14).nullable();
            table.string('cliente_email', 255).nullable();
            table.string('cliente_telefone', 30).nullable();
            table.date('data_emissao').notNullable();
            table.date('data_vencimento').notNullable();
            table.decimal('valor_original', 15, 2).notNullable();
            table.decimal('valor_recebido', 15, 2).defaultTo(0);
            table.decimal('juros', 15, 2).defaultTo(0);
            table.decimal('multa', 15, 2).defaultTo(0);
            table.decimal('desconto', 15, 2).defaultTo(0);
            table.string('status', 30).defaultTo('pendente');
            table.text('observacoes').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            table.index(['company_id']);
            table.index(['status']);
            table.index(['categoria']);
            table.index(['data_vencimento']);
            table.index(['cliente_cnpj']);
            table.unique(['company_id', 'numero_titulo']);
          });

          await db.schema.createTable('recebimentos_contas_receber', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('conta_receber_id').notNullable().references('id').inTable('contas_receber').onDelete('CASCADE');
            table.date('data_recebimento').notNullable();
            table.decimal('valor_recebido', 15, 2).notNullable();
            table.decimal('juros', 15, 2).defaultTo(0);
            table.decimal('multa', 15, 2).defaultTo(0);
            table.decimal('desconto', 15, 2).defaultTo(0);
            table.string('forma_recebimento', 30).notNullable();
            table.text('observacoes').nullable();
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.uuid('created_by').notNullable();
            table.index(['conta_receber_id']);
            table.index(['data_recebimento']);
          });

          console.log('✓ 003_create_contas_receber_tables completed');
        },
      },
      {
        name: '004_create_contas_pagar_tables',
        up: async (db) => {
          const exists = await db.schema.hasTable('contas_pagar');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 004_create_contas_pagar_tables (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Running 004_create_contas_pagar_tables...');

          await db.schema.createTable('contas_pagar', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('company_id').notNullable();
            table.uuid('created_by').notNullable();
            table.uuid('updated_by').nullable();
            table.uuid('documento_fiscal_id').nullable();
            table.string('categoria', 40).notNullable();
            table.string('numero_titulo', 60).notNullable();
            table.text('descricao').notNullable();
            table.string('fornecedor_nome', 255).notNullable();
            table.string('fornecedor_cnpj', 14).nullable();
            table.string('fornecedor_email', 255).nullable();
            table.string('fornecedor_telefone', 30).nullable();
            table.date('data_emissao').notNullable();
            table.date('data_vencimento').notNullable();
            table.decimal('valor_original', 15, 2).notNullable();
            table.decimal('valor_pago', 15, 2).defaultTo(0);
            table.decimal('juros', 15, 2).defaultTo(0);
            table.decimal('multa', 15, 2).defaultTo(0);
            table.decimal('desconto', 15, 2).defaultTo(0);
            table.string('status', 30).defaultTo('pendente');
            table.text('observacoes').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            table.index(['company_id']);
            table.index(['status']);
            table.index(['categoria']);
            table.index(['data_vencimento']);
            table.index(['fornecedor_cnpj']);
            table.unique(['company_id', 'numero_titulo']);
          });

          await db.schema.createTable('pagamentos_contas_pagar', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('conta_pagar_id').notNullable().references('id').inTable('contas_pagar').onDelete('CASCADE');
            table.date('data_pagamento').notNullable();
            table.decimal('valor_pago', 15, 2).notNullable();
            table.decimal('juros', 15, 2).defaultTo(0);
            table.decimal('multa', 15, 2).defaultTo(0);
            table.decimal('desconto', 15, 2).defaultTo(0);
            table.string('forma_pagamento', 30).notNullable();
            table.text('observacoes').nullable();
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.uuid('created_by').notNullable();
            table.index(['conta_pagar_id']);
            table.index(['data_pagamento']);
          });

          console.log('✓ 004_create_contas_pagar_tables completed');
        },
      },
      {
        name: '005_create_bank_reconciliation_tables',
        up: async (db) => {
          const exists = await db.schema.hasTable('bank_reconciliation_uploads');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 005_create_bank_reconciliation_tables (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Running 005_create_bank_reconciliation_tables...');

          await db.schema.createTable('bank_reconciliation_uploads', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
            table.string('file_name', 255).notNullable();
            table.string('bank_name', 100);
            table.integer('transaction_count').defaultTo(0);
            table.enum('status', ['uploaded', 'processed', 'reconciled', 'failed']).defaultTo('uploaded');
            table.timestamp('uploaded_at').defaultTo(db.fn.now());
            table.timestamp('processed_at').nullable();
            table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            table.text('notes');
            table.index(['company_id']);
            table.index(['status']);
            table.index(['created_by']);
            table.index(['uploaded_at']);
          });

          await db.schema.createTable('bank_transactions', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('upload_id').notNullable().references('id').inTable('bank_reconciliation_uploads').onDelete('CASCADE');
            table.date('transaction_date').notNullable();
            table.string('description', 500).notNullable();
            table.decimal('amount', 15, 2).notNullable();
            table.enum('type', ['debit', 'credit']).notNullable();
            table.decimal('bank_balance', 15, 2).nullable();
            table.string('document_number', 50).nullable();
            table.string('bank_branch_code', 10).nullable();
            table.string('bank_account_number', 20).nullable();
            table.text('raw_data').nullable();
            table.index(['upload_id']);
            table.index(['transaction_date']);
            table.index(['description']);
          });

          await db.schema.createTable('reconciliation_matches', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('upload_id').notNullable().references('id').inTable('bank_reconciliation_uploads').onDelete('CASCADE');
            table.uuid('bank_transaction_id').notNullable().references('id').inTable('bank_transactions').onDelete('CASCADE');
            table.uuid('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
            table.decimal('confidence', 5, 4).notNullable().defaultTo(0);
            table.enum('match_type', ['automatic', 'manual', 'unmatched']).notNullable();
            table.decimal('description_score', 5, 4).nullable();
            table.decimal('amount_score', 5, 4).nullable();
            table.decimal('date_score', 5, 4).nullable();
            table.timestamp('matched_at').nullable();
            table.uuid('matched_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            table.text('notes').nullable();
            table.boolean('is_reconciled').defaultTo(false);
            table.index(['upload_id']);
            table.index(['bank_transaction_id']);
            table.index(['journal_entry_id']);
            table.index(['confidence']);
            table.index(['is_reconciled']);
          });

          await db.schema.createTable('reconciliation_history', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('upload_id').notNullable().references('id').inTable('bank_reconciliation_uploads').onDelete('CASCADE');
            table.enum('action', ['accepted', 'rejected', 'auto_reconciled']).notNullable();
            table.uuid('bank_transaction_id').notNullable().references('id').inTable('bank_transactions').onDelete('CASCADE');
            table.uuid('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
            table.timestamp('executed_at').defaultTo(db.fn.now());
            table.uuid('executed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            table.text('notes').nullable();
            table.index(['upload_id']);
            table.index(['executed_by']);
            table.index(['executed_at']);
          });

          console.log('✓ 005_create_bank_reconciliation_tables completed');
        },
      },
      {
        name: '006_create_nfe_ocr_tables',
        up: async (db) => {
          const exists = await db.schema.hasTable('nfe_uploads');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 006_create_nfe_ocr_tables (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Running 006_create_nfe_ocr_tables...');

          await db.schema.createTable('nfe_uploads', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
            table.string('file_name', 255).notNullable();
            table.string('mime_type', 100);
            table.integer('file_size');
            table.enum('status', ['processing', 'success', 'failed', 'invalid']).defaultTo('processing');
            table.text('error_message').nullable();
            table.timestamp('uploaded_at').defaultTo(db.fn.now());
            table.timestamp('processed_at').nullable();
            table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
            table.index(['company_id']);
            table.index(['status']);
            table.index(['created_by']);
          });

          await db.schema.createTable('nfe_registry', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('upload_id').notNullable().references('id').inTable('nfe_uploads').onDelete('CASCADE');
            table.string('invoice_key', 50).nullable();
            table.string('access_key', 50).nullable();
            table.date('issue_date').nullable();
            table.date('due_date').nullable();
            table.decimal('total_amount', 15, 2).nullable();
            table.decimal('taxes_total', 15, 2).defaultTo(0);
            table.string('issuer_name', 255).nullable();
            table.string('issuer_cnpj', 14).nullable();
            table.string('receiver_name', 255).nullable();
            table.string('receiver_cnpj', 14).nullable();
            table.enum('type', ['entrada', 'saida']).defaultTo('entrada');
            table.text('description').nullable();
            table.text('items_json').nullable();
            table.text('raw_ocr_data').nullable();
            table.string('suggested_account', 50).nullable();
            table.enum('validation_status', ['pending', 'validated', 'rejected']).defaultTo('pending');
            table.text('validation_notes').nullable();
            table.boolean('journal_created').defaultTo(false);
            table.uuid('journal_entry_id').nullable().references('id').inTable('journal_entries').onDelete('SET NULL');
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            table.index(['upload_id']);
            table.index(['invoice_key']);
            table.index(['issuer_cnpj']);
            table.index(['validation_status']);
            table.index(['journal_created']);
          });

          console.log('✓ 006_create_nfe_ocr_tables completed');
        },
      },
      {
        name: '007_create_recurring_transactions_tables',
        up: async (db) => {
          const exists = await db.schema.hasTable('recurring_transactions');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 007_create_recurring_transactions_tables (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Running 007_create_recurring_transactions_tables...');

          await db.schema.createTable('recurring_transactions', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
            table.string('description', 255).notNullable();
            table.decimal('amount', 15, 2).notNullable();
            table.uuid('debit_account_id').notNullable().references('id').inTable('accounts');
            table.uuid('credit_account_id').notNullable().references('id').inTable('accounts');
            table.string('frequency', 50).notNullable();
            table.date('start_date').notNullable();
            table.date('end_date').nullable();
            table.boolean('is_active').defaultTo(true);
            table.date('next_execution_date').nullable();
            table.uuid('created_by_id').nullable().references('id').inTable('users');
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            table.index(['company_id', 'is_active']);
            table.index(['next_execution_date', 'is_active']);
            table.index(['frequency']);
          });

          await db.schema.createTable('recurring_transaction_executions', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('recurring_transaction_id').notNullable().references('id').inTable('recurring_transactions').onDelete('CASCADE');
            table.date('execution_date').notNullable();
            table.uuid('journal_entry_id').nullable().references('id').inTable('journal_entries');
            table.string('status', 50).notNullable();
            table.text('error_message').nullable();
            table.integer('retry_count').defaultTo(0);
            table.timestamp('executed_at').nullable();
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.index(['recurring_transaction_id']);
            table.index(['status']);
            table.index(['execution_date']);
            table.index(['created_at']);
          });

          console.log('✓ 007_create_recurring_transactions_tables completed');
        },
      },
      {
        name: '008_add_missing_columns',
        up: async (db) => {
          // Adicionar coluna fiscal_year_start em companies
          const companiesHasColumn = await db.schema.hasColumn('companies', 'fiscal_year_start');
          if (!companiesHasColumn) {
            console.log('[MIGRATIONS] Adding fiscal_year_start to companies table...');
            await db.schema.alterTable('companies', (table) => {
              table.integer('fiscal_year_start').defaultTo(1).nullable();
            });
          }

          // Adicionar coluna tax_regime em companies
          const companiesHasTaxRegime = await db.schema.hasColumn('companies', 'tax_regime');
          if (!companiesHasTaxRegime) {
            console.log('[MIGRATIONS] Adding tax_regime to companies table...');
            await db.schema.alterTable('companies', (table) => {
              table.string('tax_regime', 50).nullable();
            });
          }

          // Criar tabela audit_logs
          const auditLogsExists = await db.schema.hasTable('audit_logs');
          if (!auditLogsExists) {
            console.log('[MIGRATIONS] Creating audit_logs table...');
            await db.schema.createTable('audit_logs', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('user_id').nullable();
              table.string('action', 50).notNullable();
              table.string('entity_type', 100).notNullable();
              table.uuid('entity_id').notNullable();
              table.json('old_value').nullable();
              table.json('new_value').nullable();
              table.string('status', 50).notNullable();
              table.string('ip_address', 50).nullable();
              table.string('user_agent', 500).nullable();
              table.timestamp('timestamp').defaultTo(db.fn.now());
              table.index(['user_id']);
              table.index(['entity_type']);
              table.index(['entity_id']);
              table.index(['timestamp']);
            });
          }

          console.log('✓ 008_add_missing_columns completed');
        },
      },
          {
        name: '009_create_company_users_table',
        up: async (db) => {
          const exists = await db.schema.hasTable('company_users');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 009_create_company_users_table (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Creating company_users table...');
          
          await db.schema.createTable('company_users', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
            table.string('role', 50).notNullable().defaultTo('user');
            table.json('permissions').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            
            table.index(['user_id']);
            table.index(['company_id']);
            table.unique(['user_id', 'company_id']);
          });

          console.log('✓ 009_create_company_users_table completed');
        },
      },
        ];

    for (const migration of migrations) {
      await migration.up(db);
      if (!executedMigrations.has(migration.name)) {
        await db('migrations_executed').insert({ migration_name: migration.name });
        executedMigrations.add(migration.name);
        console.log(`✓ Migration ${migration.name} executed and tracked`);
      }
    }

    console.log('[MIGRATIONS] All migrations completed successfully!');
  } catch (error) {
    console.error('[MIGRATIONS] Error running migrations:', error);
    throw error;
  }
}
