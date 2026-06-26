/**
 * Executa migrations pendentes (uso local / CI).
 * Uso: DATABASE_URL=... npm run migrate
 */
import 'dotenv/config';
import knex from 'knex';
import { runMigrationsIfNeeded } from '../utils/migrationRunner';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }

  const db = knex({
    client: 'pg',
    connection: url,
    ssl: url.includes('railway') || url.includes('rlwy.net') ? { rejectUnauthorized: false } : false,
  });

  try {
    await runMigrationsIfNeeded(db);
    console.log('Migrations concluídas.');
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
