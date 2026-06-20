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
              table.string('id', 255).primary();
              table.string('email', 255).notNullable().unique();
              table.string('password_hash', 255).notNullable();
              table.string('full_name', 255);
              table.string('role', 50).defaultTo('user');
              table.boolean('is_active').defaultTo(true);
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
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
              table.integer('fiscal_year_start').defaultTo(1).nullable();
              table.string('tax_regime', 50).nullable();
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
            console.log(
              '[MIGRATIONS] Skipping 002_create_documentos_fiscais_tables (already exists)',
            );
            return;
          }

          console.log('[MIGRATIONS] Running 002_create_documentos_fiscais_tables...');

          await db.schema.createTable('documentos_fiscais', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.uuid('company_id').notNullable();
            table.string('created_by').notNullable();
            table.string('tipo', 50).notNullable();
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
            table.string('status', 50).defaultTo('rascunho');
            table.boolean('registrado_no_diario').defaultTo(false);
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            table.index(['company_id']);
            table.index(['created_by']);
            table.index(['tipo']);
            table.index(['status']);
            table.index(['data_emissao']);
            table.index(['contraparte_cnpj']);
            table.unique(['company_id', 'tipo', 'serie', 'numero']);
          });

          await db.schema.createTable('itens_documentos_fiscais', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table
              .uuid('documento_fiscal_id')
              .notNullable()
              .references('id')
              .inTable('documentos_fiscais')
              .onDelete('CASCADE');
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
            table.index(['documento_fiscal_id']);
          });

          await db.schema.createTable('anexos_documentos_fiscais', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table
              .uuid('documento_fiscal_id')
              .notNullable()
              .references('id')
              .inTable('documentos_fiscais')
              .onDelete('CASCADE');
            table.string('arquivo_nome', 255).notNullable();
            table.string('arquivo_mime', 100);
            table.integer('arquivo_tamanho');
            table.string('tipo', 50);
            table.string('arquivo_url', 255);
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.index(['documento_fiscal_id']);
          });

          console.log('✓ 002_create_documentos_fiscais_tables completed');
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
            table.string('user_id').notNullable();
            table
              .uuid('company_id')
              .notNullable()
              .references('id')
              .inTable('companies')
              .onDelete('CASCADE');
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
      {
        name: '010_create_audit_logs_table',
        up: async (db) => {
          const exists = await db.schema.hasTable('audit_logs');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 010_create_audit_logs_table (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Creating audit_logs table...');

          await db.schema.createTable('audit_logs', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.string('user_id').nullable();
            table.string('action', 50).notNullable();
            table.string('entity_type', 100).notNullable();
            table.uuid('entity_id').nullable();
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

          console.log('✓ 010_create_audit_logs_table completed');
        },
      },
      {
        name: '20260620_add_users_email_index',
        up: async (db) => {
          console.log('[MIGRATIONS] Adding performance index for users.email...');
          try {
            await db.raw('CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email))');
            console.log('✓ idx_users_email_lower created');
          } catch (e) {
            console.warn('[MIGRATIONS] Could not create index (maybe it exists):', e);
          }
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
