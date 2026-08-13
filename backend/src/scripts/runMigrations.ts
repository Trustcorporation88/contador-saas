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
    connection: {
      connectionString: url,
      // A heurística antiga só ligava SSL para host do Railway. Com o banco no
      // Supabase (que exige TLS) este script conectava sem SSL e falhava — foi
      // por isso que migration virou "rodar SQL na mão no painel". Agora o
      // padrão é SSL para qualquer host remoto, e só localhost fica sem.
      ssl: /(^|@)(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false },
    },
  } as any);

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
