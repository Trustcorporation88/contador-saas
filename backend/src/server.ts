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
import { EFDSchedulerService } from './services/efdScheduler';
import cron from 'node-cron';
import authService from './services/authService';
import { bootstrapRegimeDemoUsers } from './services/bootstrapRegimeUsers';
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
      // `{ error }` vira "[object Object]" no coletor de logs do Railway, que só
      // mostra a string da mensagem. Este cron falhou todo dia sem revelar a
      // causa (era tabela inexistente). A causa vai na mensagem.
      const e = error as { message?: string; code?: string; table?: string };
      const detalhe = [e?.message ?? String(error), e?.code && `code=${e.code}`, e?.table && `table=${e.table}`]
        .filter(Boolean)
        .join(' | ');
      logger.error(`Recurring Transaction Scheduler: execution failed: ${detalhe}`, {
        stack: (error as Error)?.stack,
      });
    }
  });

  console.log('[DAS] DAS Scheduler initialized with 4 cron jobs (including recurring transactions)');

  // Classificação Tributária (cClassTrib) da Reforma Tributária.
  //
  // A tabela publicada pelo SVRS muda por ato normativo até 2032 — códigos
  // entram, e outros têm a vigência encerrada sem sucessor. Sem sincronização
  // periódica a tabela envelhece em silêncio e a validação da emissão passa a
  // usar uma norma revogada, que é pior do que não validar: dá confiança.
  //
  // Diário às 4h: a publicação é esporádica, e o custo de checar é uma
  // requisição. Falha não derruba nada — a tabela anterior é preservada e a
  // tentativa fica registrada em fiscal_class_trib_sync.
  cron.schedule('0 4 * * *', async () => {
    console.log('[CRON] Sincronizando Classificação Tributária (cClassTrib) com o SVRS...');
    try {
      const { sincronizar } = await import('./services/classTribSyncService');
      const r = await sincronizar();
      if (r.status === 'ok') {
        console.log(
          `[CRON] cClassTrib: ${r.total_recebido} códigos ` +
          `(${r.inseridos} novos, ${r.atualizados} alterados, ${r.ausentes} ausentes na origem)`,
        );
      } else {
        // Não relança: indisponibilidade do portal do SVRS não pode derrubar o
        // agendador. Fica no log e na tabela de sincronizações.
        logger.warn('[CRON] cClassTrib: sincronização falhou', { erro: r.erro });
      }
    } catch (error) {
      logger.error('cClassTrib Scheduler: sincronizacao failed', { error });
    }
  });

  console.log('[cClassTrib] Sincronização com o SVRS agendada (diária, 04:00)');
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

    await bootstrapRegimeDemoUsers();
    console.log('Regime demo users bootstrap completed');

    if (envConfig.cache.enabled) {
      redisClient.connect();
      console.log('Redis connecting...');
    }

    startBackgroundJobs();

    try {
      await EFDSchedulerService.initializeSchedules();
      console.log('[EFD] Scheduler initialized');
    } catch (error) {
      logger.error('Failed to initialize EFD scheduler', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

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

void startServer();
