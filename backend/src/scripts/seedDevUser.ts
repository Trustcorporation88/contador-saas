import { initializeDatabase, closeDatabase, getDatabase } from '../config/database';
import { seed as seedAuthUser } from '../migrations/add_auth_tables';

async function seedDevUser(): Promise<void> {
  try {
    await initializeDatabase();
    const db = await getDatabase();

    await seedAuthUser(db);

    console.log('');
    console.log('Credenciais locais previsiveis:');
    console.log('email: test@example.com');
    console.log('senha: Test@123456');
    console.log('');
  } catch (error) {
    console.error('Falha ao seedar usuario local. Verifique se o PostgreSQL esta em execucao e se as variaveis do backend estao configuradas.');
    console.error('Exemplo: DATABASE_URL ou DATABASE_HOST/DATABASE_PORT/DATABASE_NAME/DATABASE_USER/DATABASE_PASSWORD.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void seedDevUser();