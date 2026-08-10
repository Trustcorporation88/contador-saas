/**
 * Database Migration Runner
 * Automatically detects and runs missing migrations
 * Safe to call multiple times (idempotent)
 */

import { Knex } from 'knex';
import { up as upContasReceber } from '../migrations/add_contas_receber';
import { up as upContasPagar } from '../migrations/add_contas_pagar';
import { up as upEfdTables } from '../migrations/add_efd_tables';

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
      {
        name: '011_add_users_company_id',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('users');
          if (!hasTable) {
            console.log('[MIGRATIONS] Skipping 011_add_users_company_id (users table missing)');
            return;
          }

          const hasColumn = await db.schema.hasColumn('users', 'company_id');
          if (hasColumn) {
            console.log('[MIGRATIONS] Skipping 011_add_users_company_id (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Adding company_id to users table...');
          await db.schema.alterTable('users', (table) => {
            table.string('company_id', 64).nullable();
          });
          console.log('✓ 011_add_users_company_id completed');
        },
      },
      {
        name: '012_fiscal_xml_capture',
        up: async (db) => {
          const hasCerts = await db.schema.hasTable('fiscal_certificates');
          if (!hasCerts) {
            await db.schema.createTable('fiscal_certificates', (table) => {
              table.uuid('id').primary();
              table.string('company_id', 64).notNullable().unique();
              table.string('cnpj', 14).notNullable();
              table.string('uf', 2).notNullable();
              table.string('pfx_path', 512).notNullable();
              table.text('password_encrypted').notNullable();
              table.timestamp('cert_valid_until').nullable();
              table.boolean('serpro_motor_enabled').notNullable().defaultTo(false);
              table.boolean('active').notNullable().defaultTo(true);
              table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
              table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
            });
          }

          const hasSync = await db.schema.hasTable('fiscal_xml_sync');
          if (!hasSync) {
            await db.schema.createTable('fiscal_xml_sync', (table) => {
              table.string('company_id', 64).notNullable();
              table.string('doc_type', 10).notNullable();
              table.string('cursor_value', 64).notNullable().defaultTo('0');
              table.timestamp('last_sync_at').nullable();
              table.string('last_status', 32).nullable();
              table.text('last_error').nullable();
              table.primary(['company_id', 'doc_type']);
            });
          }

          const hasCaptures = await db.schema.hasTable('fiscal_xml_captures');
          if (!hasCaptures) {
            await db.schema.createTable('fiscal_xml_captures', (table) => {
              table.uuid('id').primary();
              table.string('company_id', 64).notNullable();
              table.string('doc_type', 10).notNullable();
              table.string('chave', 60).notNullable();
              table.string('direcao', 10).nullable();
              table.string('xml_path', 1024).notNullable();
              table.string('xml_hash', 64).nullable();
              table.string('emitente_cnpj', 14).nullable();
              table.string('destinatario_cnpj', 14).nullable();
              table.decimal('valor_total', 15, 2).nullable();
              table.date('data_emissao').nullable();
              table.string('modelo', 10).nullable();
              table.string('numero', 20).nullable();
              table.string('serie', 10).nullable();
              table.jsonb('metadata').nullable();
              table.timestamp('captured_at').notNullable().defaultTo(db.fn.now());
              table.unique(['company_id', 'chave']);
              table.index(['company_id', 'captured_at']);
            });
          }
          console.log('✓ 012_fiscal_xml_capture completed');
        },
      },
      {
        name: '013_add_contas_receber',
        up: async (db) => {
          await upContasReceber(db);
          console.log('✓ 013_add_contas_receber completed');
        },
      },
      {
        name: '014_add_contas_pagar',
        up: async (db) => {
          await upContasPagar(db);
          console.log('✓ 014_add_contas_pagar completed');
        },
      },
      {
        name: '015_fiscal_certificate_pfx_data',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('fiscal_certificates');
          if (!hasTable) return;

          const hasColumn = await db.schema.hasColumn('fiscal_certificates', 'pfx_data');
          if (!hasColumn) {
            await db.schema.alterTable('fiscal_certificates', (table) => {
              table.text('pfx_data').nullable();
            });
          }
          console.log('✓ 015_fiscal_certificate_pfx_data completed');
        },
      },
      {
        name: '016_nfe_emission',
        up: async (db) => {
          // Tabela de numeração sequencial por empresa/série/modelo
          if (!(await db.schema.hasTable('nfe_numeracao'))) {
            console.log('[MIGRATIONS] Creating nfe_numeracao table...');
            await db.schema.createTable('nfe_numeracao', (table) => {
              table.increments('id').primary();
              table.uuid('company_id').notNullable();
              table.integer('serie').notNullable().defaultTo(1);
              table.integer('modelo').notNullable().defaultTo(55);
              table.integer('ultimo_numero').notNullable().defaultTo(0);
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
              table.unique(['company_id', 'serie', 'modelo']);
            });
          }

          // Tabela principal de NF-e
          if (!(await db.schema.hasTable('nfe'))) {
            console.log('[MIGRATIONS] Creating nfe table...');
            await db.schema.createTable('nfe', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('company_id').notNullable();
              table.integer('numero').notNullable();
              table.integer('serie').notNullable().defaultTo(1);
              table.integer('modelo').notNullable().defaultTo(55);
              table.string('chave_acesso', 44);
              table.string('protocolo', 30);
              table.string('ambiente', 20).defaultTo('homologacao');
              table.string('emit_cnpj', 14).notNullable();
              table.string('emit_razao_social', 255).notNullable();
              table.string('dest_cpf_cnpj', 14).notNullable();
              table.string('dest_razao_social', 255).notNullable();
              table.string('dest_email', 255);
              table.decimal('valor_produtos', 15, 2).defaultTo(0);
              table.decimal('valor_frete', 15, 2).defaultTo(0);
              table.decimal('valor_desconto', 15, 2).defaultTo(0);
              table.decimal('valor_icms', 15, 2).defaultTo(0);
              table.decimal('valor_pis', 15, 2).defaultTo(0);
              table.decimal('valor_cofins', 15, 2).defaultTo(0);
              table.decimal('valor_total', 15, 2).defaultTo(0);
              table.string('status', 20).notNullable().defaultTo('RASCUNHO');
              table.string('status_sefaz', 10);
              table.text('status_motivo');
              table.string('natureza_operacao', 120).defaultTo('VENDA');
              table.text('informacoes_adicionais');
              table.text('xml_nfe');
              table.text('xml_proc');
              table.text('dest_endereco');
              table.timestamp('data_emissao').defaultTo(db.fn.now());
              table.timestamp('data_autorizacao');
              table.timestamp('data_cancelamento');
              table.text('justificativa_cancelamento');
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
              table.index(['company_id']);
              table.index(['status']);
            });
          }

          // Itens da NF-e
          if (!(await db.schema.hasTable('nfe_itens'))) {
            console.log('[MIGRATIONS] Creating nfe_itens table...');
            await db.schema.createTable('nfe_itens', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('nfe_id').notNullable();
              table.integer('numero_item').notNullable();
              table.string('codigo_produto', 60);
              table.string('descricao', 255).notNullable();
              table.string('ncm', 8);
              table.string('cfop', 4);
              table.string('unidade', 6).defaultTo('UN');
              table.decimal('quantidade', 15, 4).defaultTo(0);
              table.decimal('valor_unitario', 15, 4).defaultTo(0);
              table.decimal('valor_total', 15, 2).defaultTo(0);
              table.string('cst_icms', 4);
              table.decimal('aliquota_icms', 7, 4);
              table.decimal('valor_icms', 15, 2);
              table.string('cst_pis', 4);
              table.decimal('aliquota_pis', 7, 4);
              table.decimal('valor_pis', 15, 2);
              table.string('cst_cofins', 4);
              table.decimal('aliquota_cofins', 7, 4);
              table.decimal('valor_cofins', 15, 2);
              table.index(['nfe_id']);
            });
          }

          // Campos fiscais adicionais na tabela companies (emitente)
          const companiesExists = await db.schema.hasTable('companies');
          if (companiesExists) {
            const cols: Array<[string, (t: Knex.AlterTableBuilder) => void]> = [
              ['inscricao_estadual', (t) => t.string('inscricao_estadual', 20).nullable()],
              ['endereco_numero', (t) => t.string('endereco_numero', 20).nullable()],
              ['endereco_bairro', (t) => t.string('endereco_bairro', 120).nullable()],
              ['codigo_municipio', (t) => t.string('codigo_municipio', 7).nullable()],
              ['crt', (t) => t.string('crt', 1).nullable()],
            ];
            for (const [col, builder] of cols) {
              if (!(await db.schema.hasColumn('companies', col))) {
                await db.schema.alterTable('companies', builder);
              }
            }
          }

          console.log('✓ 016_nfe_emission completed');
        },
      },
      {
        name: '017_nfe_numero_unique_constraint',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('nfe');
          if (!hasTable) return;

          // Trava de segurança: impede duas NF-e com o mesmo número/série/modelo
          // para a mesma empresa (mesmo em RASCUNHO). Não derruba o deploy caso
          // já existam duplicidades nos dados — apenas registra o alerta.
          try {
            await db.raw(`
              CREATE UNIQUE INDEX IF NOT EXISTS idx_nfe_company_serie_modelo_numero
              ON nfe (company_id, serie, modelo, numero)
            `);
            console.log('✓ 017_nfe_numero_unique_constraint completed');
          } catch (e) {
            console.warn(
              '[MIGRATIONS] Não foi possível criar índice único nfe(company_id,serie,modelo,numero) — verifique duplicidades existentes:',
              (e as Error).message,
            );
          }
        },
      },
      {
        name: '017a_accounting_core_tables',
        up: async (db) => {
          // accounts, journal_entries, journal_lines e documents nunca
          // fizeram parte deste sistema de migração automática — só
          // existiam via scripts SQL manuais na raiz do repo (001_create_
          // accounts.sql, 002_create_journal_tables.sql), aplicados uma
          // única vez direto em produção há tempos. Isso nunca causou
          // problema em produção (as tabelas já existem lá), mas qualquer
          // ambiente NOVO (CI, disaster recovery, novo deploy) nunca
          // conseguia inicializar o schema: a migração 018_efd_tables cria
          // uma foreign key para journal_entries, que nunca existia,
          // derrubando o servidor inteiro na inicialização.
          // hasTable() torna isso um no-op seguro onde as tabelas já
          // existem (produção).
          const hasAccounts = await db.schema.hasTable('accounts');
          if (!hasAccounts) {
            console.log('[MIGRATIONS] Creating accounts table...');
            await db.schema.createTable('accounts', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('company_id').notNullable();
              table.uuid('parent_id').nullable();
              table.string('code', 20).notNullable();
              table.string('name', 255).notNullable();
              table.string('type', 20).notNullable();
              table.string('tax_code', 50).nullable();
              table.boolean('is_analytical').defaultTo(false);
              table.boolean('is_active').defaultTo(true);
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
              table.unique(['company_id', 'code']);
              table.index(['company_id']);
              table.index(['parent_id']);
              table.index(['type']);
              table.index(['company_id', 'type']);
            });
            await db.raw(`
              ALTER TABLE accounts ADD CONSTRAINT valid_type CHECK (
                type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
              )
            `);
          }

          const hasJournalEntries = await db.schema.hasTable('journal_entries');
          if (!hasJournalEntries) {
            console.log('[MIGRATIONS] Creating journal_entries table...');
            await db.schema.createTable('journal_entries', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('company_id').notNullable();
              table.uuid('created_by').notNullable();
              table.date('entry_date').notNullable();
              table.string('description', 500).nullable();
              table.string('reference_type', 50).nullable();
              table.string('reference_number', 50).nullable();
              table.string('reference_issuer', 255).nullable();
              table.decimal('total_debit', 18, 2).defaultTo(0);
              table.decimal('total_credit', 18, 2).defaultTo(0);
              table.boolean('is_posted').defaultTo(false);
              table.string('data_hash', 64).nullable();
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
              table.index(['company_id']);
              table.index(['entry_date']);
              table.index(['company_id', 'entry_date']);
            });
            await db.raw(`
              ALTER TABLE journal_entries
                ADD CONSTRAINT valid_debit_credit CHECK (total_debit >= 0 AND total_credit >= 0),
                ADD CONSTRAINT balanced CHECK (ABS(total_debit - total_credit) < 0.01),
                ADD CONSTRAINT valid_reference_type CHECK (
                  reference_type IS NULL OR reference_type IN ('NF', 'RPA', 'CHEQUE', 'BOLETO', 'MANUAL')
                )
            `);
          }

          const hasJournalLines = await db.schema.hasTable('journal_lines');
          if (!hasJournalLines) {
            console.log('[MIGRATIONS] Creating journal_lines table...');
            await db.schema.createTable('journal_lines', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('journal_entry_id').notNullable()
                .references('id').inTable('journal_entries').onDelete('CASCADE');
              table.uuid('account_id').notNullable();
              table.uuid('cost_center_id').nullable();
              table.decimal('debit', 18, 2).defaultTo(0);
              table.decimal('credit', 18, 2).defaultTo(0);
              table.string('description', 500).nullable();
              table.integer('line_number').notNullable();
              table.index(['journal_entry_id']);
              table.index(['account_id']);
              table.index(['account_id', 'journal_entry_id']);
            });
            await db.raw(`
              ALTER TABLE journal_lines
                ADD CONSTRAINT valid_debit_credit CHECK (debit >= 0 AND credit >= 0),
                ADD CONSTRAINT not_both_zero CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)),
                ADD CONSTRAINT valid_line_number CHECK (line_number > 0)
            `);
          }

          const hasDocuments = await db.schema.hasTable('documents');
          if (!hasDocuments) {
            console.log('[MIGRATIONS] Creating documents table...');
            await db.schema.createTable('documents', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.uuid('journal_entry_id').nullable();
              table.string('document_type', 50).notNullable();
              table.string('document_number', 50).nullable();
              table.string('issuer', 255).nullable();
              table.date('issue_date').nullable();
              table.decimal('amount', 18, 2).nullable();
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.index(['journal_entry_id']);
              table.index(['document_number']);
              table.index(['document_type', 'document_number']);
            });
            await db.raw(`
              ALTER TABLE documents ADD CONSTRAINT valid_document_type CHECK (
                document_type IN ('NF', 'RPA', 'CHEQUE', 'BOLETO', 'INVOICE', 'OTHER')
              )
            `);
          }

          console.log('✓ 017a_accounting_core_tables completed');
        },
      },
      {
        name: '017b_journal_entries_reversal_tracking',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('journal_entries');
          if (!hasTable) return;

          const hasColumn = await db.schema.hasColumn('journal_entries', 'reverses_entry_id');
          if (!hasColumn) {
            console.log('[MIGRATIONS] Adding reverses_entry_id to journal_entries...');
            await db.schema.alterTable('journal_entries', (table) => {
              table.uuid('reverses_entry_id').nullable();
            });
          }

          // Impede que o mesmo lançamento seja estornado mais de uma vez
          try {
            await db.raw(`
              CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_reverses_unique
              ON journal_entries (reverses_entry_id)
              WHERE reverses_entry_id IS NOT NULL
            `);
            console.log('✓ 017b_journal_entries_reversal_tracking completed');
          } catch (e) {
            console.warn(
              '[MIGRATIONS] Não foi possível criar índice único reverses_entry_id — verifique estornos duplicados existentes:',
              (e as Error).message,
            );
          }
        },
      },
      {
        name: '017c_audit_logs_company_id',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('audit_logs');
          if (!hasTable) return;

          const hasColumn = await db.schema.hasColumn('audit_logs', 'company_id');
          if (!hasColumn) {
            console.log('[MIGRATIONS] Adding company_id to audit_logs...');
            await db.schema.alterTable('audit_logs', (table) => {
              table.uuid('company_id').nullable();
            });
            await db.raw('CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id)');
          }
          console.log('✓ 017c_audit_logs_company_id completed');
        },
      },
      {
        name: '018_efd_tables',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('efd_generations');
          if (hasTable) {
            console.log('[MIGRATIONS] Skipping 018_efd_tables (already exists)');
            return;
          }
          console.log('[MIGRATIONS] Creating EFD tables (efd_generations, efd_records, etc.)...');
          await upEfdTables(db);
          console.log('✓ 018_efd_tables completed');
        },
      },
      {
        name: '019_reforma_tributaria_tables',
        up: async (db) => {
          // Alíquotas de CBS/IBS/IS versionadas por ano-calendário — a reforma
          // tributária (EC 132/2023 + LC 214/2025) só fixou por lei os valores
          // de 2026 (fase de testes); alíquotas de referência pós-2027 dependem
          // de cálculo anual do Comitê Gestor do IBS + Receita Federal, então
          // NUNCA devem ser hardcoded no código — apenas nesta tabela.
          const hasAliquotas = await db.schema.hasTable('reforma_aliquotas_anuais');
          if (!hasAliquotas) {
            console.log('[MIGRATIONS] Creating reforma_aliquotas_anuais...');
            await db.schema.createTable('reforma_aliquotas_anuais', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.integer('ano').notNullable();
              table.string('tax_type', 10).notNullable();
              table.decimal('aliquota', 8, 6).notNullable();
              table.string('natureza', 20).notNullable().defaultTo('DEVIDO');
              table.boolean('aplicavel_simples').notNullable().defaultTo(false);
              table.text('fonte_legal').nullable();
              table.date('vigencia_inicio').nullable();
              table.date('vigencia_fim').nullable();
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
              table.unique(['ano', 'tax_type']);
            });
            await db.raw(`
              ALTER TABLE reforma_aliquotas_anuais
              ADD CONSTRAINT chk_reforma_tax_type CHECK (tax_type IN ('CBS','IBS','IS')),
              ADD CONSTRAINT chk_reforma_natureza CHECK (natureza IN ('INFORMATIVO','DEVIDO'))
            `);
          }

          const hasTransicao = await db.schema.hasTable('reforma_transicao_icms_iss');
          if (!hasTransicao) {
            console.log('[MIGRATIONS] Creating reforma_transicao_icms_iss...');
            await db.schema.createTable('reforma_transicao_icms_iss', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.integer('ano').notNullable().unique();
              table.decimal('percentual_ibs', 5, 4).notNullable();
              table.decimal('percentual_icms_iss_legado', 5, 4).notNullable();
              table.text('fonte_legal').nullable();
              table.timestamp('created_at').defaultTo(db.fn.now());
              table.timestamp('updated_at').defaultTo(db.fn.now());
            });
          }

          // Seed idempotente — apenas fatos legais já confirmados hoje (2026,
          // fase de testes). Não semeia 2027+ (alíquotas ainda não fixadas).
          await db('reforma_aliquotas_anuais')
            .insert([
              {
                ano: 2026,
                tax_type: 'CBS',
                aliquota: 0.009,
                natureza: 'INFORMATIVO',
                aplicavel_simples: false,
                fonte_legal: 'LC 214/2025, art. 348 — fase de testes',
              },
              {
                ano: 2026,
                tax_type: 'IBS',
                aliquota: 0.001,
                natureza: 'INFORMATIVO',
                aplicavel_simples: false,
                fonte_legal: 'LC 214/2025, art. 348 — fase de testes',
              },
            ])
            .onConflict(['ano', 'tax_type'])
            .ignore();

          console.log('✓ 019_reforma_tributaria_tables completed');
        },
      },
      {
        name: '019b_tax_calculations_reforma_types',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('tax_calculations');
          if (!hasTable) return;

          // Estende o CHECK constraint existente para aceitar CBS/IBS/IS,
          // reaproveitando a tabela de apurações já existente (save/list/
          // updateStatus do TaxCalculationService continuam funcionando sem
          // alteração — só o conjunto de valores aceitos em tax_type muda).
          try {
            await db.raw('ALTER TABLE tax_calculations DROP CONSTRAINT IF EXISTS chk_tax_type_valid');
            await db.raw(`
              ALTER TABLE tax_calculations ADD CONSTRAINT chk_tax_type_valid
              CHECK (tax_type IN ('IRPJ','CSLL','PIS','COFINS','ICMS','ISS','CBS','IBS','IS'))
            `);
            console.log('✓ 019b_tax_calculations_reforma_types completed');
          } catch (e) {
            console.warn(
              '[MIGRATIONS] Não foi possível estender chk_tax_type_valid — verifique manualmente:',
              (e as Error).message,
            );
          }
        },
      },
      {
        name: '020_nfe_xml_cancelamento',
        up: async (db) => {
          const hasNfe = await db.schema.hasTable('nfe');
          if (!hasNfe) return;

          // Guarda o XML do evento de cancelamento (110111) retornado pela SEFAZ
          // — prova/comprovante do cancelamento real, análogo ao xml_proc da
          // autorização. Sem isso não há como auditar depois se um cancelamento
          // foi de fato registrado junto à SEFAZ.
          const hasColumn = await db.schema.hasColumn('nfe', 'xml_cancelamento');
          if (!hasColumn) {
            console.log('[MIGRATIONS] Adding nfe.xml_cancelamento...');
            await db.schema.alterTable('nfe', (table) => {
              table.text('xml_cancelamento');
            });
          }
          console.log('✓ 020_nfe_xml_cancelamento completed');
        },
      },
      {
        name: '021_reforma_aliquotas_referencia_2027_2033',
        up: async (db) => {
          // Seed de alíquotas de referência 2027–2033 + curva de transição
          // ICMS/ISS → IBS (2029–2032). Valores de mercado (CBS 8,8% / IBS
          // cheio 17,7%) para simulação até o Senado fixar as alíquotas
          // oficiais. onConflict ignore: não sobrescreve cadastro admin.
          const hasAliquotas = await db.schema.hasTable('reforma_aliquotas_anuais');
          if (!hasAliquotas) {
            console.warn('[MIGRATIONS] reforma_aliquotas_anuais ausente — pule 021');
            return;
          }

          const CBS = 0.088;
          const IBS_CHEIA = 0.177;
          const IBS_TESTE = 0.001;
          const fonteRef =
            'Referência de mercado (CBS ~8,8% / IBS ~17,7%) — LC 214/2025 cronograma; Senado fixa anualmente';

          const aliquotas = [
            // 2027–2028: CBS cheia + IBS 0,1%
            { ano: 2027, tax_type: 'CBS', aliquota: CBS, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2027, tax_type: 'IBS', aliquota: IBS_TESTE, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: 'LC 214/2025 — IBS 0,1% em 2027-2028' },
            { ano: 2028, tax_type: 'CBS', aliquota: CBS, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2028, tax_type: 'IBS', aliquota: IBS_TESTE, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: 'LC 214/2025 — IBS 0,1% em 2027-2028' },
            // 2029–2032: IBS 10/20/30/40% da alíquota cheia
            { ano: 2029, tax_type: 'CBS', aliquota: CBS, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2029, tax_type: 'IBS', aliquota: Math.round(IBS_CHEIA * 0.1 * 10000) / 10000, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2030, tax_type: 'CBS', aliquota: CBS, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2030, tax_type: 'IBS', aliquota: Math.round(IBS_CHEIA * 0.2 * 10000) / 10000, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2031, tax_type: 'CBS', aliquota: CBS, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2031, tax_type: 'IBS', aliquota: Math.round(IBS_CHEIA * 0.3 * 10000) / 10000, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2032, tax_type: 'CBS', aliquota: CBS, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2032, tax_type: 'IBS', aliquota: Math.round(IBS_CHEIA * 0.4 * 10000) / 10000, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            // 2033: sistema definitivo
            { ano: 2033, tax_type: 'CBS', aliquota: CBS, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
            { ano: 2033, tax_type: 'IBS', aliquota: IBS_CHEIA, natureza: 'DEVIDO', aplicavel_simples: true, fonte_legal: fonteRef },
          ];

          await db('reforma_aliquotas_anuais').insert(aliquotas).onConflict(['ano', 'tax_type']).ignore();

          const hasTransicao = await db.schema.hasTable('reforma_transicao_icms_iss');
          if (hasTransicao) {
            await db('reforma_transicao_icms_iss')
              .insert([
                { ano: 2029, percentual_ibs: 0.10, percentual_icms_iss_legado: 0.90, fonte_legal: 'EC 132/2023 + LC 214/2025 — transição ICMS/ISS' },
                { ano: 2030, percentual_ibs: 0.20, percentual_icms_iss_legado: 0.80, fonte_legal: 'EC 132/2023 + LC 214/2025 — transição ICMS/ISS' },
                { ano: 2031, percentual_ibs: 0.30, percentual_icms_iss_legado: 0.70, fonte_legal: 'EC 132/2023 + LC 214/2025 — transição ICMS/ISS' },
                { ano: 2032, percentual_ibs: 0.40, percentual_icms_iss_legado: 0.60, fonte_legal: 'EC 132/2023 + LC 214/2025 — transição ICMS/ISS' },
                { ano: 2033, percentual_ibs: 1.00, percentual_icms_iss_legado: 0.00, fonte_legal: 'EC 132/2023 + LC 214/2025 — sistema definitivo' },
              ])
              .onConflict(['ano'])
              .ignore();
          }

          console.log('✓ 021_reforma_aliquotas_referencia_2027_2033 completed');
        },
      },
      {
        name: '022_nfe_forma_pagamento',
        up: async (db) => {
          const hasNfe = await db.schema.hasTable('nfe');
          if (!hasNfe) return;

          // tPag do grupo <pag>. O usuário já escolhia a forma de pagamento no
          // formulário e o DTO a recebia, mas ela não era gravada em lugar
          // nenhum — e o emissor mandava '01' (dinheiro) fixo para a SEFAZ.
          const hasColumn = await db.schema.hasColumn('nfe', 'forma_pagamento');
          if (!hasColumn) {
            console.log('[MIGRATIONS] Adding nfe.forma_pagamento...');
            await db.schema.alterTable('nfe', (table) => {
              table.string('forma_pagamento', 2).defaultTo('01');
            });
          }
          console.log('✓ 022_nfe_forma_pagamento completed');
        },
      },
      {
        name: '023_nfe_transmitindo_em',
        up: async (db) => {
          const hasNfe = await db.schema.hasTable('nfe');
          if (!hasNfe) return;

          // Trava de transmissão à SEFAZ, com expiração. Dois cliques em
          // "Autorizar" transmitiam a mesma nota duas vezes (a segunda voltava
          // como duplicidade 539). É um timestamp e não um status novo para que
          // uma queda no meio da transmissão não deixe a nota presa.
          const hasColumn = await db.schema.hasColumn('nfe', 'transmitindo_em');
          if (!hasColumn) {
            console.log('[MIGRATIONS] Adding nfe.transmitindo_em...');
            await db.schema.alterTable('nfe', (table) => {
              table.timestamp('transmitindo_em').nullable();
            });
          }
          console.log('✓ 023_nfe_transmitindo_em completed');
        },
      },
      {
        name: '024_tax_adjustments_lalur',
        up: async (db) => {
          // Adições e exclusões do LALUR. O TaxAdjustmentDTO existia em
          // models/dtos/taxDTO.ts desde o início, mas a tabela nunca foi criada
          // aqui (só no SQL solto da raiz, que não é executado) e nenhum código a
          // lia. Resultado: o IRPJ do Lucro Real era calculado sobre o lucro
          // CONTÁBIL, que não é a base legal.
          const hasTable = await db.schema.hasTable('tax_adjustments');
          if (!hasTable) {
            console.log('[MIGRATIONS] Creating tax_adjustments table...');
            await db.schema.createTable('tax_adjustments', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              // company_id com FK e NOT NULL: sem isso a tabela nasce fora do
              // isolamento por empresa, como aconteceu com bank_transactions.
              table.uuid('company_id').notNullable()
                .references('id').inTable('companies').onDelete('CASCADE');
              table.date('period_start').notNullable();
              table.date('period_end').notNullable();
              table.string('adjustment_type', 16).notNullable();
              table.decimal('amount', 15, 2).notNullable();
              table.text('justification').notNullable();
              table.uuid('account_id').nullable();
              table.uuid('created_by').nullable();
              table.timestamps(true, true);

              table.index(['company_id', 'period_start', 'period_end'], 'idx_tax_adj_company_periodo');
            });

            // Valor sempre positivo — o sinal vem do tipo. Um valor negativo
            // inverteria silenciosamente adição em exclusão.
            await db.raw(`
              ALTER TABLE tax_adjustments
              ADD CONSTRAINT chk_tax_adj_amount_positivo CHECK (amount > 0)
            `);
            await db.raw(`
              ALTER TABLE tax_adjustments
              ADD CONSTRAINT chk_tax_adj_type CHECK (adjustment_type IN ('ADDITION','EXCLUSION'))
            `);
          }

          // RLS ligada já na criação. As tabelas deste projeto nascem via Knex,
          // sem RLS, e o Supabase publica uma API REST sobre o schema public com
          // a chave anon (pública por definição) — tabela nova fica legível por
          // qualquer um até alguém rodar o script de blindagem à mão. Ligar aqui
          // fecha na origem; o backend é dono da tabela e segue lendo e gravando.
          try {
            await db.raw('ALTER TABLE tax_adjustments ENABLE ROW LEVEL SECURITY');
          } catch (e) {
            console.warn(
              '[MIGRATIONS] Não foi possível habilitar RLS em tax_adjustments:',
              (e as Error).message,
            );
          }

          console.log('✓ 024_tax_adjustments_lalur completed');
        },
      },
      {
        name: '025_users_mfa_e_lockout',
        up: async (db) => {
          const hasUsers = await db.schema.hasTable('users');
          if (!hasUsers) return;

          // As colunas de MFA e de lockout NUNCA existiram no banco: a migração
          // que as criava (src/migrations/add_auth_tables.ts) não está neste
          // runner e por isso nunca rodou. O authService lê dbUser.mfa_enabled e
          // dbUser.mfa_secret na hidratação, então sem as colunas o MFA volta
          // desligado a cada restart — o usuário escaneia o QR code, o sistema
          // confirma a ativação, e no deploy seguinte o login para de pedir o
          // segundo fator sem avisar ninguém.
          //
          // Não reaproveitei add_auth_tables porque o up() dela foi escrito
          // contra um schema antigo (cria `name` e `active`; o atual tem
          // `full_name` e `is_active`).
          const colunas: Array<[string, (t: import('knex').Knex.AlterTableBuilder) => void]> = [
            ['mfa_enabled',    (t) => t.boolean('mfa_enabled').notNullable().defaultTo(false)],
            ['mfa_secret',     (t) => t.string('mfa_secret', 128).nullable()],
            // JSON com os hashes dos códigos de recuperação (nunca em texto claro).
            ['backup_codes',   (t) => t.text('backup_codes').nullable()],
            ['last_login',     (t) => t.timestamp('last_login').nullable()],
            ['login_attempts', (t) => t.integer('login_attempts').notNullable().defaultTo(0)],
            ['locked_until',   (t) => t.timestamp('locked_until').nullable()],
          ];

          for (const [nome, definicao] of colunas) {
            const existe = await db.schema.hasColumn('users', nome);
            if (!existe) {
              console.log(`[MIGRATIONS] Adding users.${nome}...`);
              await db.schema.alterTable('users', definicao);
            }
          }

          console.log('✓ 025_users_mfa_e_lockout completed');
        },
      },
      {
        name: '026_fiscal_xml_captures_conteudo',
        up: async (db) => {
          const hasTable = await db.schema.hasTable('fiscal_xml_captures');
          if (!hasTable) return;

          // A tabela guardava xml_path (um caminho no filesystem) e xml_hash, e
          // NÃO o documento. Em produção getXmlRoot() desvia para os.tmpdir()
          // por causa de um EACCES no volume, então o arquivo apontado deixava de
          // existir no deploy seguinte e o registro ficava apontando para o vazio.
          //
          // O XML autorizado É o documento fiscal (o DANFE é só representação), com
          // guarda de 5 anos. O xml_hash não ajuda a recuperar: serve para provar
          // alteração, não para reconstruir.
          //
          // Guardar no banco segue o que o sistema já faz com nfe.xml_proc e com
          // fiscal_certificates.pfx_data, e entra no backup diário.
          const hasColumn = await db.schema.hasColumn('fiscal_xml_captures', 'xml_content');
          if (!hasColumn) {
            console.log('[MIGRATIONS] Adding fiscal_xml_captures.xml_content...');
            await db.schema.alterTable('fiscal_xml_captures', (table) => {
              // Nullable: capturas antigas não têm o conteúdo, e não há de onde
              // tirar. Distinguir "sem conteúdo" de "vazio" importa na auditoria.
              table.text('xml_content').nullable();
            });
          }

          console.log('✓ 026_fiscal_xml_captures_conteudo completed');
        },
      },
      {
        name: '027_fiscal_class_trib',
        up: async (db) => {
          // Tabela de Classificação Tributária (cClassTrib) da Reforma Tributária.
          //
          // O cClassTrib qualifica o CST dentro do grupo gIBSCBS: o CST diz QUAL é
          // a situação (tributada, isenta, reduzida) e o cClassTrib diz POR QUE,
          // amarrando na hipótese legal da LC 214/2025. É código obrigatório e
          // validado pela SEFAZ.
          //
          // Por que tabela e não constante no código: a lista publicada pelo SVRS
          // muda por ato normativo até 2032, e muda nos DOIS eixos. Na carga que
          // originou esta migração havia 164 códigos, dos quais 3 (220001, 220002 e
          // 220003, incorporação imobiliária) já tinham vigência encerrada em
          // 2026-01-01 SEM sucessor no mesmo CST. Um enum no código continuaria
          // oferecendo os três. Além disso só 97 dos 164 valem para NF-e — os
          // demais são de NFS-e, CT-e, NF3e etc. —, então a lista correta depende
          // do documento que está sendo emitido.
          const temTabela = await db.schema.hasTable('fiscal_class_trib');
          if (!temTabela) {
            console.log('[MIGRATIONS] Creating fiscal_class_trib...');
            await db.schema.createTable('fiscal_class_trib', (table) => {
              // O código é a chave natural publicada pelo SVRS: 6 dígitos, com
              // zeros à esquerda significativos ('000001'). Guardar como texto,
              // nunca como inteiro.
              table.string('cod_class_trib', 6).primary();

              table.string('cst', 3).notNullable();
              table.text('nome_cst');
              table.text('nome').notNullable();
              table.text('nome_reduzido');

              // Vigência: é o que torna a validação dependente da DATA DE EMISSÃO
              // da nota, e não da data de hoje. Uma nota de janeiro reemitida em
              // agosto tem de ser validada contra a tabela de janeiro.
              table.date('vigencia_inicio').notNullable();
              table.date('vigencia_fim').nullable();

              // ATENÇÃO À UNIDADE: o SVRS publica em PONTOS PERCENTUAIS —
              // 60.00 significa 60%, não 0,6. Aplicar direto como fator produz
              // redução de 6000%.
              table.decimal('perc_red_ibs', 5, 2);
              table.decimal('perc_red_cbs', 5, 2);

              table.smallint('tipo_aliq');
              table.boolean('ind_trib_regular');

              // Documentos em que o código é aceito, normalizados ('NFE', 'NFCE',
              // 'CTE', 'NFSE'...). Array em vez de 17 colunas booleanas porque o
              // SVRS já acrescentou tipos de documento à tabela e deve acrescentar
              // outros até 2032 — assim isso não exige nova migração.
              table.specificType('documentos', 'text[]').notNullable().defaultTo('{}');

              table.text('url_legislacao');
              table.integer('nro_anexo');
              table.date('publicado_em');

              // Registro original inteiro. Campos que o SVRS criar passam a ficar
              // disponíveis sem migração, e dá para auditar o que foi recebido.
              table.jsonb('dados_brutos').notNullable();

              // Código que sumiu da origem. NUNCA se apaga a linha: notas já
              // emitidas referenciam o código, e apagá-lo tornaria impossível
              // reconstituir a validação daquela emissão.
              table.timestamp('ausente_na_origem_desde', { useTz: true }).nullable();

              table.timestamp('sincronizado_em', { useTz: true }).notNullable().defaultTo(db.fn.now());
            });

            await db.schema.alterTable('fiscal_class_trib', (table) => {
              table.index(['vigencia_inicio', 'vigencia_fim'], 'idx_class_trib_vigencia');
              table.index(['cst'], 'idx_class_trib_cst');
            });
            await db.raw(
              'CREATE INDEX IF NOT EXISTS idx_class_trib_documentos ON fiscal_class_trib USING GIN (documentos)',
            );
          }

          // Histórico das sincronizações. Sem isto não há como distinguir "a
          // tabela está correta e estável" de "o sync quebrou há três meses e
          // ninguém viu" — os dois casos têm exatamente a mesma aparência ao
          // consultar a tabela.
          const temLog = await db.schema.hasTable('fiscal_class_trib_sync');
          if (!temLog) {
            console.log('[MIGRATIONS] Creating fiscal_class_trib_sync...');
            await db.schema.createTable('fiscal_class_trib_sync', (table) => {
              table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
              table.timestamp('iniciado_em', { useTz: true }).notNullable().defaultTo(db.fn.now());
              table.timestamp('concluido_em', { useTz: true }).nullable();
              table.string('status', 10).notNullable();
              table.text('origem').notNullable();
              table.integer('total_recebido');
              table.integer('inseridos');
              table.integer('atualizados');
              table.integer('inalterados');
              table.integer('ausentes');
              table.text('erro');
              table.index(['iniciado_em'], 'idx_class_trib_sync_data');
            });
            await db.raw(
              'ALTER TABLE fiscal_class_trib_sync ADD CONSTRAINT chk_class_trib_sync_status ' +
              "CHECK (status IN ('ok', 'erro'))",
            );
          }

          // RLS ligada já na criação, pelo mesmo motivo da 024: o Supabase publica
          // uma API REST sobre o schema public. Aqui não há dado de cliente, mas
          // tabela sem RLS neste schema é exposição por omissão.
          for (const tabela of ['fiscal_class_trib', 'fiscal_class_trib_sync']) {
            try {
              await db.raw(`ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY`);
            } catch (erro) {
              console.warn(`[MIGRATIONS] Não foi possível habilitar RLS em ${tabela}:`, erro);
            }
          }

          console.log('✓ 027_fiscal_class_trib completed');
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
