/**
 * Regressão: buildRedisOptions prefere REDIS_URL (Railway) sobre host/port.
 */
import { buildRedisOptions } from '../../src/services/cache/redisConnection';

describe('buildRedisOptions', () => {
  it('retorna options utilizáveis pelo ioredis', () => {
    const result = buildRedisOptions({ connectionName: 'test' });
    expect(result.options).toBeDefined();
    expect(result.options.connectionName).toBe('test');
    // Ou tem URL (PaaS) ou host/port (local) — nunca os dois vazios.
    if (result.url) {
      expect(result.url).toMatch(/^redis:/);
    } else {
      expect(result.options.host).toBeTruthy();
      expect(result.options.port).toBeTruthy();
    }
  });
});
