/**
 * Server entry point — v2.0.1
 * Auto-bootstraps admin user on startup via ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD env vars.
 */
import app from './app';
import { envConfig } from './config/env';
import { validateEnvironment } from './config/validateEnv';
import { initializeDatabase } from './config/database';
import { logger } from './middleware/requestLogger';
import { BackupService } from './services/backupService';
import { DASScheduler } from './services/dasScheduler';
import cron from 'node-cron';
import authService from './services/authService';
import redisClient from './services/cache/redisClient';

/**
 * Server entry point
 * Initializes database and starts HTTP server
 */

const PORT = envConfig.port;
const HOST = envConfig.host;

function startBackgroundJobs(): void {
  if (envConfig.nodeEnv === 'test') {
    return;
  }

  BackupService.startScheduler();

  console.log('[DAS] Initializing DAS Scheduler with cron jobs...');

  cron.schedule('0 1 * * *', async () => {
    console.log('[CRON] Atualizando DAS vencidos...');
    try {
      await DASScheduler.atualizarVencidos();
    } catch (error) {
      logger.error('DAS Scheduler: atualizarVencidos failed', { error });
    }
  });

  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Verificando vencimentos próximos...');
    try {
      await DASScheduler.verificarVencimentosProximos();
    } catch (error) {
      logger.error('DAS Scheduler: verificarVencimentosProximos failed', { error });
    }
  });

  cron.schedule('0 3 15-19 * *', async () => {
    console.log('[CRON] Gerando DAS mensais...');
    try {
      await DASScheduler.processarGeracaoMensal();
    } catch (error) {
      logger.error('DAS Scheduler: processarGeracaoMensal failed', { error });
    }
  });

  cron.schedule('5 0 * * *', async () => {
    console.log('[CRON] Executando lançamentos recorrentes...');
    try {
      const { RecurringTransactionService } = await import('./services/recurringTransactionService');
      const report = await RecurringTransactionService.executeRecurringTransactions();
      logger.info('[CRON] Recurring transactions execution completed', report);
      console.log(`[CRON] Recorrências: ${report.success} sucesso, ${report.failed} falhas`);
    } catch (error) {
      logger.error('Recurring Transaction Scheduler: execution failed', { error });
    }
  });

  console.log('[DAS] DAS Scheduler initialized with 4 cron jobs (including recurring transactions)');
}

async function startServer(): Promise<void> {
  let server: ReturnType<typeof app.listen> | null = null;

  try {
    console.log('Validating environment configuration...');
    validateEnvironment();
    console.log('Environment validation passed');

    // HTTP sobe antes do DB para o healthcheck do Railway não estourar timeout
    server = app.listen(PORT, HOST, () => {
      logger.info('HTTP server listening (warming up)', {
        host: HOST,
        port: PORT,
        env: envConfig.nodeEnv,
      });
      console.log(`Health check: http://${HOST}:${PORT}/health (warming up)`);
    });

    console.log('Initializing database connection pool...');
    await initializeDatabase();
    console.log('Database connected successfully');

    await authService.bootstrapAdminUser();
    console.log('Authentication bootstrap completed');

    if (envConfig.cache.enabled) {
      redisClient.connect();
      console.log('Redis connecting...');
    }

    startBackgroundJobs();

    logger.info('Server ready', {
      host: HOST,
      port: PORT,
      env: envConfig.nodeEnv,
      apiVersion: 'v1',
    });
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`API Documentation: http://${HOST}:${PORT}/api/v1`);

    const activeServer = server;

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      BackupService.stopScheduler();
      activeServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      BackupService.stopScheduler();
      activeServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    if (server) {
      server.close();
    }
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

startServer();
