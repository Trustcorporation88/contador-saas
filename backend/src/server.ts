import app from './app';
import { envConfig } from './config/env';
import { validateEnvironment } from './config/validateEnv';
import { initializeDatabase } from './config/database';
import { logger } from './middleware/requestLogger';
import { BackupService } from './services/backupService';
import authService from './services/authService';

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
    console.log('✓ Environment validation passed');

    // Initialize database connection pool
    console.log('Initializing database connection pool...');
    await initializeDatabase();
    console.log('✓ Database connected successfully');

    await authService.bootstrapAdminUser();
    console.log('✓ Authentication bootstrap completed');

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Server started`, {
        host: HOST,
        port: PORT,
        env: envConfig.nodeEnv,
        apiVersion: 'v1',
      });
      console.log(`\n✓ Server running at http://${HOST}:${PORT}`);
      console.log(`✓ API Documentation: http://${HOST}:${PORT}/api/v1`);
      console.log(`✓ Health check: http://${HOST}:${PORT}/health\n`);

      // Iniciar backup automático agendado
      if (envConfig.nodeEnv !== 'test') {
        BackupService.startScheduler();
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

