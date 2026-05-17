/**
 * Database Migration: Add Authentication Tables
 * Cria tabelas para refresh tokens e atualiza users com campos de MFA
 */

import { Knex } from 'knex';

/**
 * Up migration - create tables and add columns
 */
export async function up(knex: Knex): Promise<void> {
  // Verificar se tabela 'users' existe
  const usersExists = await knex.schema.hasTable('users');

  if (usersExists) {
    // Atualizar tabela users com campos de MFA
    await knex.schema.alterTable('users', (table) => {
      // Adicionar coluna se não existir
      if (!knex.client.config.client?.includes('sqlite')) {
        // PostgreSQL/MySQL
        table.boolean('mfa_enabled').defaultTo(false).alter();
        table.string('mfa_secret', 32).nullable().alter();
        table.specificType('backup_codes', 'text[]').nullable().alter();
        table.timestamp('last_login').nullable().alter();
        table.integer('login_attempts').defaultTo(0).alter();
        table.timestamp('locked_until').nullable().alter();
      } else {
        // SQLite
        table.boolean('mfa_enabled').defaultTo(false).alter();
        table.string('mfa_secret', 32).nullable().alter();
        table.text('backup_codes').nullable().alter(); // JSON string
        table.timestamp('last_login').nullable().alter();
        table.integer('login_attempts').defaultTo(0).alter();
        table.timestamp('locked_until').nullable().alter();
      }
    });
  } else {
    // Criar tabela users se não existir
    await knex.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('email', 255).unique().notNullable();
      table.string('password_hash', 255).notNullable();
      table.string('name', 255).notNullable();
      table.enum('role', ['admin', 'auditor', 'accountant', 'manager', 'viewer']).defaultTo('viewer');
      table.uuid('company_id').notNullable();
      table.boolean('active').defaultTo(true);
      table.boolean('mfa_enabled').defaultTo(false);
      table.string('mfa_secret', 32).nullable();
      table.specificType('backup_codes', 'text[]').nullable();
      table.timestamp('last_login').nullable();
      table.integer('login_attempts').defaultTo(0);
      table.timestamp('locked_until').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Índices
      table.index('email');
      table.index('company_id');
      table.index('created_at');
    });
  }

  // Criar tabela refresh_tokens
  const refreshTokensExists = await knex.schema.hasTable('refresh_tokens');
  if (!refreshTokensExists) {
    await knex.schema.createTable('refresh_tokens', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable();
      table.string('token_hash', 64).notNullable().unique(); // SHA-256 hash
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Índices
      table.index('user_id');
      table.index('expires_at');
      table.index('created_at');

      // Foreign key
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }

  console.log('✅ Migration: add_auth_tables completed');
}

/**
 * Down migration - rollback
 */
export async function down(knex: Knex): Promise<void> {
  // Remover tabela refresh_tokens
  await knex.schema.dropTableIfExists('refresh_tokens');

  // Remover colunas da tabela users
  const usersExists = await knex.schema.hasTable('users');
  if (usersExists) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('mfa_enabled');
      table.dropColumn('mfa_secret');
      table.dropColumn('backup_codes');
      table.dropColumn('last_login');
      table.dropColumn('login_attempts');
      table.dropColumn('locked_until');
    });
  }

  console.log('✅ Migration: add_auth_tables rolled back');
}

/**
 * Seed data for testing (opcional)
 */
export async function seed(knex: Knex): Promise<void> {
  // Seed com usuário de teste
  const userExists = await knex('users').where('email', 'test@example.com').first();

  if (!userExists) {
    await knex('users').insert({
      id: 'test-user-1',
      email: 'test@example.com',
      password_hash: '$2b$12$8P3e.yw6P5QzX1HN7xN5MucFc3MrOZ5XOWD.vK7aq3RlVIBz7T3yK', // Test@123456
      name: 'Test User',
      role: 'admin',
      company_id: 'test-company-1',
      active: true,
      mfa_enabled: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log('✅ Test user seeded');
  }
}

/**
 * SQL para importação direta no PostgreSQL/MySQL
 * Execute se não estiver usando Knex migrations
 */
export const rawSQL = {
  postgres: `
    -- Atualizar tabela users existente
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(32),
    ADD COLUMN IF NOT EXISTS backup_codes TEXT[],
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
    ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

    -- Criar tabela refresh_tokens
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_created_at ON refresh_tokens(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
  `,

  mysql: `
    -- Atualizar tabela users existente
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(32),
    ADD COLUMN IF NOT EXISTS backup_codes JSON,
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS login_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL;

    -- Criar tabela refresh_tokens
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      KEY idx_user_id (user_id),
      KEY idx_expires_at (expires_at),
      KEY idx_created_at (created_at)
    );
  `,

  sqlite: `
    -- SQLite: ALTER TABLE com limitations
    -- Recomendação: usar Knex para migrations com SQLite
    -- Ou executar script Python para alterar schema
  `,
};
