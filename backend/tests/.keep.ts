/**
 * Tests Setup — Jest global configuration
 * Configura ambiente de teste: variáveis, mocks globais, limpeza
 */

// Variáveis de ambiente para testes
process.env.NODE_ENV          = 'test';
process.env.JWT_SECRET        = 'test-jwt-secret-32chars-minimum-ok';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-min-ok';
process.env.DB_HOST           = 'localhost';
process.env.DB_PORT           = '5432';
process.env.DB_NAME           = 'contador_test';
process.env.DB_USER           = 'postgres';
process.env.DB_PASSWORD       = 'test';
process.env.BACKUP_DIR        = './tmp-test-backups';
process.env.BACKUP_RETENTION_DAYS = '30';

export default {};

