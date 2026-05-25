/**
 * Server entry point â€” v2.0.1
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

async function startServer(): Promise<void> {
  try {
    // Valida environment ANTES de qualquer coisa
    console.log('Validating environment configuration...');
    validateEnvironment();
    console.log('âœ“ Environment validation passed');

    // Initialize database connection pool
    console.log('Initializing database connection pool...');
    await initializeDatabase();
    console.log('âœ“ Database connected successfully');

    await authService.bootstrapAdminUser();
    console.log('âœ“ Authentication bootstrap completed');

    // Inicializar Redis se cache habilitado
    if (envConfig.cache.enabled) {
      redisClient.connect();
      console.log('âœ“ Redis connecting...');
    }

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Server started`, {
        host: HOST,
        port: PORT,
        env: envConfig.nodeEnv,
        apiVersion: 'v1',
      });
      console.log(`\nâœ“ Server running at http://${HOST}:${PORT}`);
      console.log(`âœ“ API Documentation: http://${HOST}:${PORT}/api/v1`);
      console.log(`âœ“ Health check: http://${HOST}:${PORT}/health\n`);

      // Iniciar backup automático agendado
      if (envConfig.nodeEnv !== 'test') {
        BackupService.startScheduler();
        
        // Iniciar DAS Scheduler com cron jobs
        console.log('[DAS] Initializing DAS Scheduler with cron jobs...');
        
        // Atualizar DAS vencidos - 01:00 UTC diariamente
        cron.schedule('0 1 * * *', async () => {
          console.log('[CRON] Atualizando DAS vencidos...');
          try {
            await DASScheduler.atualizarVencidos();
          } catch (error) {
            logger.error('DAS Scheduler: atualizarVencidos failed', { error });
          }
        });
        
        // Verificar vencimentos próximos - 02:00 UTC diariamente
        cron.schedule('0 2 * * *', async () => {
          console.log('[CRON] Verificando vencimentos próximos...');
          try {
            await DASScheduler.verificarVencimentosProximos();
          } catch (error) {
            logger.error('DAS Scheduler: verificarVencimentosProximos failed', { error });
          }
        });
        
        // Gerar DAS automaticamente - 03:00 UTC (dias 15-19 do mês)
        cron.schedule('0 3 15-19 * *', async () => {
          console.log('[CRON] Gerando DAS mensais...');
          try {
            await DASScheduler.processarGeracaoMensal();
          } catch (error) {
            logger.error('DAS Scheduler: processarGeracaoMensal failed', { error });
          }
        });
        
        console.log('[DAS] ✓ DAS Scheduler initialized with 3 cron jobs');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      BackupService.stopScheduler();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      BackupService.stopScheduler();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the server
startServer();
