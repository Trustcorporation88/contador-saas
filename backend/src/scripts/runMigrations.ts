/**
 * Run database migrations
 * Execute: ts-node src/scripts/runMigrations.ts
 */

import knex from 'knex';
import { envConfig } from '../config/env';
import { up as addDocumentosFiscaisMigration } from '../migrations/add_documentos_fiscais';
import { up as addAuthTablesMigration } from '../migrations/add_auth_tables';

async function runMigrations() {
  const connectionConfig = envConfig.database.url
    ? envConfig.database.url
    : {
        host: envConfig.database.host,
        port: envConfig.database.port,
        user: envConfig.database.user,
        password: envConfig.database.password,
        database: envConfig.database.name,
      };

  const db = knex({
    client: 'pg',
    connection: connectionConfig,
  });

  try {
    console.log('Running migrations...\n');

    // Execute migrations in order
    console.log('1/2 Running add_auth_tables...');
    await addAuthTablesMigration(db);
    console.log('✓ add_auth_tables completed\n');

    console.log('2/2 Running add_documentos_fiscais...');
    await addDocumentosFiscaisMigration(db);
    console.log('✓ add_documentos_fiscais completed\n');

    console.log('✓ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

runMigrations();
