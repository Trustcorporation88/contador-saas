/**
 * Configura variáveis de ambiente para os testes ANTES do carregamento dos módulos.
 * Este arquivo é executado via `setupFiles` no jest.config.ts.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/contador_test';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_NAME = 'contador_test';
process.env.DATABASE_USER = 'test';
process.env.DATABASE_PASSWORD = 'test_password';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRY = '1h';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.JWT_ALGORITHM = 'HS256';
process.env.PORT = '3001';
process.env.HOST = '127.0.0.1';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
