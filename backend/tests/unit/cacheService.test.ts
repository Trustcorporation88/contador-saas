/**
 * Testes unitários — CacheService
 * Cobre: get, set, del, delPattern, invalidate, flush, getStats, healthCheck,
 *        métricas, fail-safe, serialização/deserialização, invalidação por tipo
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRedisGet   = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisDel   = jest.fn();
const mockRedisScan  = jest.fn();

const mockRedisClientInstance = {
  get:   mockRedisGet,
  setex: mockRedisSetex,
  del:   mockRedisDel,
  scan:  mockRedisScan,
};

const mockHealthCheck = jest.fn();
const mockFlushDb     = jest.fn();

jest.mock('../../src/services/cache/redisClient', () => ({
  __esModule: true,
  default: {
    connected:   true,
    getClient:   jest.fn(() => mockRedisClientInstance),
    healthCheck: mockHealthCheck,
    flushDb:     mockFlushDb,
  },
}));

jest.mock('../../src/config/env', () => ({
  envConfig: {
    cache: {
      enabled:      true,
      defaultTtl:   300,
      reportsTtl:   600,
      accountsTtl:  900,
      taxesTtl:     3600,
      dashboardTtl: 120,
    },
  },
}));

// Logger stub (evita import chain pesado)
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Imports (depois dos mocks) ───────────────────────────────────────────────

import { CacheService, TTL_CONFIG } from '../../src/services/cache/cacheService';
import redisClient from '../../src/services/cache/redisClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultHealth = {
  connected:   true,
  uptime:      1000,
  memoryUsed:  '2MB',
  keys:        10,
  timestamp:   new Date(),
};

function makeService(): CacheService {
  const svc = new CacheService();
  svc.resetMetrics();
  return svc;
}

// ─── TTL_CONFIG ───────────────────────────────────────────────────────────────

describe('TTL_CONFIG', () => {
  it('carrega valores do envConfig', () => {
    expect(TTL_CONFIG.REPORTS).toBe(600);
    expect(TTL_CONFIG.ACCOUNTS).toBe(900);
    expect(TTL_CONFIG.TAXES).toBe(3600);
    expect(TTL_CONFIG.DASHBOARD).toBe(120);
    expect(TTL_CONFIG.DEFAULT).toBe(300);
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe('CacheService.get()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
  });

  it('retorna null e incrementa misses quando key não existe', async () => {
    mockRedisGet.mockResolvedValue(null);
    const svc = makeService();

    const result = await svc.get('test-key');

    expect(result).toBeNull();
    expect(svc.getMetrics().misses).toBe(1);
    expect(svc.getMetrics().hits).toBe(0);
  });

  it('retorna objeto deserializado e incrementa hits', async () => {
    const payload = { id: 1, name: 'Empresa X' };
    mockRedisGet.mockResolvedValue(JSON.stringify(payload));
    const svc = makeService();

    const result = await svc.get<typeof payload>('company:1');

    expect(result).toEqual(payload);
    expect(svc.getMetrics().hits).toBe(1);
    expect(svc.getMetrics().misses).toBe(0);
  });

  it('retorna null se JSON inválido (fail-safe)', async () => {
    mockRedisGet.mockResolvedValue('invalid-json{{{');
    const svc = makeService();

    const result = await svc.get('bad-json-key');

    expect(result).toBeNull();
  });

  it('retorna null e incrementa errors em caso de erro do Redis', async () => {
    mockRedisGet.mockRejectedValue(new Error('connection refused'));
    const svc = makeService();

    const result = await svc.get('error-key');

    expect(result).toBeNull();
    expect(svc.getMetrics().errors).toBe(1);
  });

  it('retorna null sem chamar Redis quando cache desabilitado', async () => {
    (redisClient as any).connected = false;
    const svc = makeService();

    const result = await svc.get('any-key');

    expect(result).toBeNull();
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(svc.getMetrics().misses).toBe(1);
  });

  it('desserializa arrays corretamente', async () => {
    const arr = [1, 2, 3];
    mockRedisGet.mockResolvedValue(JSON.stringify(arr));
    const svc = makeService();

    const result = await svc.get<number[]>('array-key');

    expect(result).toEqual(arr);
  });
});

// ─── set ──────────────────────────────────────────────────────────────────────

describe('CacheService.set()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
    mockRedisSetex.mockResolvedValue('OK');
  });

  it('chama setex com TTL default quando não informado', async () => {
    const svc = makeService();
    await svc.set('key1', { data: 'value' });

    expect(mockRedisSetex).toHaveBeenCalledWith(
      'key1',
      TTL_CONFIG.DEFAULT,
      JSON.stringify({ data: 'value' })
    );
    expect(svc.getMetrics().sets).toBe(1);
  });

  it('usa TTL customizado quando fornecido', async () => {
    const svc = makeService();
    await svc.set('key2', 'hello', 60);

    expect(mockRedisSetex).toHaveBeenCalledWith('key2', 60, '"hello"');
  });

  it('serializa primitivos corretamente', async () => {
    const svc = makeService();
    await svc.set('num', 42);
    expect(mockRedisSetex).toHaveBeenCalledWith('num', TTL_CONFIG.DEFAULT, '42');

    await svc.set('bool', true);
    expect(mockRedisSetex).toHaveBeenCalledWith('bool', TTL_CONFIG.DEFAULT, 'true');
  });

  it('não lança erro se Redis falhar (fail-safe)', async () => {
    mockRedisSetex.mockRejectedValue(new Error('timeout'));
    const svc = makeService();

    await expect(svc.set('key', 'val')).resolves.toBeUndefined();
    expect(svc.getMetrics().errors).toBe(1);
  });

  it('não chama setex quando cache desabilitado', async () => {
    (redisClient as any).connected = false;
    const svc = makeService();

    await svc.set('key', 'val');

    expect(mockRedisSetex).not.toHaveBeenCalled();
  });
});

// ─── del ──────────────────────────────────────────────────────────────────────

describe('CacheService.del()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
  });

  it('retorna true quando key existia', async () => {
    mockRedisDel.mockResolvedValue(1);
    const svc = makeService();

    const result = await svc.del('existing-key');

    expect(result).toBe(true);
    expect(svc.getMetrics().deletes).toBe(1);
  });

  it('retorna false quando key não existia', async () => {
    mockRedisDel.mockResolvedValue(0);
    const svc = makeService();

    const result = await svc.del('ghost-key');

    expect(result).toBe(false);
  });

  it('retorna false em erro (fail-safe)', async () => {
    mockRedisDel.mockRejectedValue(new Error('redis down'));
    const svc = makeService();

    const result = await svc.del('key');

    expect(result).toBe(false);
    expect(svc.getMetrics().errors).toBe(1);
  });

  it('retorna false quando cache desabilitado', async () => {
    (redisClient as any).connected = false;
    const svc = makeService();

    const result = await svc.del('key');

    expect(result).toBe(false);
    expect(mockRedisDel).not.toHaveBeenCalled();
  });
});

// ─── delPattern ───────────────────────────────────────────────────────────────

describe('CacheService.delPattern()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
  });

  it('usa SCAN iterativo e deleta chaves encontradas', async () => {
    mockRedisScan
      .mockResolvedValueOnce(['42', ['key1', 'key2']])
      .mockResolvedValueOnce(['0', ['key3']]);
    mockRedisDel.mockResolvedValue(2);
    const svc = makeService();

    const count = await svc.delPattern('reports:company1:*');

    expect(mockRedisScan).toHaveBeenCalledTimes(2);
    expect(count).toBeGreaterThan(0);
  });

  it('retorna 0 se nenhuma key encontrada', async () => {
    mockRedisScan.mockResolvedValueOnce(['0', []]);
    const svc = makeService();

    const count = await svc.delPattern('no-match:*');

    expect(count).toBe(0);
    expect(mockRedisDel).not.toHaveBeenCalled();
  });

  it('retorna 0 em erro (fail-safe)', async () => {
    mockRedisScan.mockRejectedValue(new Error('scan error'));
    const svc = makeService();

    const count = await svc.delPattern('*');

    expect(count).toBe(0);
    expect(svc.getMetrics().errors).toBe(1);
  });

  it('retorna 0 quando cache desabilitado', async () => {
    (redisClient as any).connected = false;
    const svc = makeService();

    const count = await svc.delPattern('*');

    expect(count).toBe(0);
    expect(mockRedisScan).not.toHaveBeenCalled();
  });
});

// ─── invalidate ───────────────────────────────────────────────────────────────

describe('CacheService.invalidate()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
  });

  it('deleta array de keys e retorna contagem', async () => {
    mockRedisDel.mockResolvedValue(3);
    const svc = makeService();

    const count = await svc.invalidate(['k1', 'k2', 'k3']);

    expect(mockRedisDel).toHaveBeenCalledWith('k1', 'k2', 'k3');
    expect(count).toBe(3);
  });

  it('retorna 0 para array vazio sem chamar Redis', async () => {
    const svc = makeService();

    const count = await svc.invalidate([]);

    expect(count).toBe(0);
    expect(mockRedisDel).not.toHaveBeenCalled();
  });

  it('retorna 0 em erro (fail-safe)', async () => {
    mockRedisDel.mockRejectedValue(new Error('fail'));
    const svc = makeService();

    const count = await svc.invalidate(['k1']);

    expect(count).toBe(0);
  });
});

// ─── flush ────────────────────────────────────────────────────────────────────

describe('CacheService.flush()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
  });

  it('chama flushDb no redisClient', async () => {
    mockFlushDb.mockResolvedValue(undefined);
    const svc = makeService();

    await svc.flush();

    expect(mockFlushDb).toHaveBeenCalledTimes(1);
  });

  it('propaga erro se flushDb falhar', async () => {
    mockFlushDb.mockRejectedValue(new Error('flush error'));
    const svc = makeService();

    await expect(svc.flush()).rejects.toThrow('flush error');
  });

  it('não chama flushDb quando cache desabilitado', async () => {
    (redisClient as any).connected = false;
    const svc = makeService();

    await svc.flush();

    expect(mockFlushDb).not.toHaveBeenCalled();
  });
});

// ─── getStats ─────────────────────────────────────────────────────────────────

describe('CacheService.getStats()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
    mockHealthCheck.mockResolvedValue(defaultHealth);
  });

  it('calcula hitRate corretamente com hits e misses', async () => {
    mockRedisGet
      .mockResolvedValueOnce(JSON.stringify('hit'))
      .mockResolvedValueOnce(JSON.stringify('hit'))
      .mockResolvedValueOnce(null);
    const svc = makeService();
    await svc.get('k1');
    await svc.get('k2');
    await svc.get('k3');

    const stats = await svc.getStats();

    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(66.67, 1);
  });

  it('retorna hitRate 0 quando não há operações', async () => {
    const svc = makeService();

    const stats = await svc.getStats();

    expect(stats.hitRate).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('retorna dados do healthCheck no stats', async () => {
    const svc = makeService();

    const stats = await svc.getStats();

    expect(stats.keys).toBe(defaultHealth.keys);
    expect(stats.memoryUsed).toBe(defaultHealth.memoryUsed);
    expect(stats.uptime).toBe(defaultHealth.uptime);
    expect(stats.timestamp).toBeInstanceOf(Date);
  });

  it('retorna stats básicos se healthCheck falhar', async () => {
    mockHealthCheck.mockRejectedValue(new Error('redis down'));
    const svc = makeService();

    const stats = await svc.getStats();

    expect(stats.keys).toBe(0);
    expect(stats.memoryUsed).toBe('0B');
  });
});

// ─── healthCheck ──────────────────────────────────────────────────────────────

describe('CacheService.healthCheck()', () => {
  it('delega para redisClient.healthCheck', async () => {
    mockHealthCheck.mockResolvedValue(defaultHealth);
    const svc = makeService();

    const result = await svc.healthCheck();

    expect(mockHealthCheck).toHaveBeenCalledTimes(1);
    expect(result).toEqual(defaultHealth);
  });
});

// ─── Helpers de invalidação por tipo ─────────────────────────────────────────

describe('Helpers de invalidação por tipo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient as any).connected = true;
    mockRedisScan.mockResolvedValue(['0', []]);
  });

  it('invalidateReports usa pattern reports:companyId:*', async () => {
    const svc = makeService();
    await svc.invalidateReports('company-abc');

    expect(mockRedisScan).toHaveBeenCalledWith(
      expect.anything(),
      'MATCH',
      'reports:company-abc:*',
      'COUNT',
      100
    );
  });

  it('invalidateAccounts usa pattern accounts:companyId:*', async () => {
    const svc = makeService();
    await svc.invalidateAccounts('company-abc');

    expect(mockRedisScan).toHaveBeenCalledWith(
      expect.anything(),
      'MATCH',
      'accounts:company-abc:*',
      'COUNT',
      100
    );
  });

  it('invalidateTaxes usa pattern taxes:companyId:*', async () => {
    const svc = makeService();
    await svc.invalidateTaxes('company-abc');

    expect(mockRedisScan).toHaveBeenCalledWith(
      expect.anything(),
      'MATCH',
      'taxes:company-abc:*',
      'COUNT',
      100
    );
  });

  it('invalidateDashboard usa pattern dashboard:companyId:*', async () => {
    const svc = makeService();
    await svc.invalidateDashboard('company-abc');

    expect(mockRedisScan).toHaveBeenCalledWith(
      expect.anything(),
      'MATCH',
      'dashboard:company-abc:*',
      'COUNT',
      100
    );
  });

  it('invalidateCompany usa pattern *:companyId:*', async () => {
    const svc = makeService();
    await svc.invalidateCompany('company-abc');

    expect(mockRedisScan).toHaveBeenCalledWith(
      expect.anything(),
      'MATCH',
      '*:company-abc:*',
      'COUNT',
      100
    );
  });
});

// ─── resetMetrics / getMetrics ────────────────────────────────────────────────

describe('resetMetrics / getMetrics', () => {
  it('retorna cópia isolada das métricas', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify('v'));
    (redisClient as any).connected = true;
    const svc = makeService();
    await svc.get('k');

    const m = svc.getMetrics();
    m.hits = 999;

    expect(svc.getMetrics().hits).toBe(1);
  });

  it('reseta todas as métricas para zero', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify('v'));
    (redisClient as any).connected = true;
    const svc = makeService();
    await svc.get('k');
    expect(svc.getMetrics().hits).toBe(1);

    svc.resetMetrics();

    const m = svc.getMetrics();
    expect(m.hits).toBe(0);
    expect(m.misses).toBe(0);
    expect(m.sets).toBe(0);
    expect(m.deletes).toBe(0);
    expect(m.errors).toBe(0);
  });
});
