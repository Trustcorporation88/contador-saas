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

/**
 * Rate limiting desligado nos testes.
 *
 * O teto do login é de 5 tentativas por minuto por IP, e no supertest todas as
 * requisições saem do mesmo IP. Qualquer suíte que faça mais de cinco logins em
 * um minuto — mfaCicloDeLogin faz oito — passa a receber 429 no meio e falha por
 * um motivo que nada tem a ver com o que ela testa: o corpo vem sem `data` e o
 * sintoma aparece como "Cannot read properties of undefined (reading tempToken)".
 *
 * Foi exatamente o que aconteceu quando o limitador passou a contar de forma
 * consistente, ao deixar de tentar um Redis inexistente. O limitador tem teste
 * próprio e dedicado (tests/unit/rateLimiterSemRedis.test.ts), incluindo um que
 * exige que ele CONTINUE barrando — desligá-lo aqui não deixa a proteção
 * descoberta.
 */
process.env.ENABLE_RATE_LIMITING = 'false';
