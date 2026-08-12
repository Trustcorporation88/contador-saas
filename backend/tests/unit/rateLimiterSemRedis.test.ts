/**
 * Sem Redis configurado, o rate limiter não tenta conectar — e continua limitando.
 *
 * O log de produção abria assim depois de cada deploy, na primeira requisição:
 *
 *   error Redis error in rate limiter — connect ECONNREFUSED ::1:6379   (x4)
 *   error Redis max retries exceeded for rate limiter
 *   warn  REDIS_PASSWORD is empty in production
 *
 * Não havia Redis no projeto: REDIS_URL e REDIS_HOST têm default localhost, e o
 * código tentava mesmo assim. Nada quebrava — existe fallback em memória — mas
 * cinco linhas de erro sobre infraestrutura inexistente, a cada deploy, treinam
 * a gente a ignorar erro no log. Foi o que aconteceu: o erro estava ali desde
 * sempre e ninguém olhava.
 *
 * Os dois testes que importam aqui:
 *  - NENHUMA conexão é aberta (o construtor do ioredis nem é chamado);
 *  - o limite CONTINUA valendo, porque silenciar não pode virar desligar.
 *
 * O segundo é o que impede a "correção" de virar um furo: seria fácil calar o
 * log deixando passar tudo, e a proteção de força bruta do login (5/min)
 * morreria em silêncio.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Conta construções de cliente Redis. Zero é o resultado esperado. */
const construcoesDeRedis = { total: 0 };

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: class RedisFalso {
      constructor() {
        construcoesDeRedis.total += 1;
      }
      on() { return this; }
      pipeline() { throw new Error('não deveria haver pipeline sem Redis'); }
    },
  };
});

import { redisConfigurado } from '../../src/services/cache/redisConnection';

describe('redisConfigurado — o que conta como "tem Redis"', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.resetModules();
  });

  /**
   * envConfig é lido no import, então cada caso precisa recarregar o módulo.
   *
   * `undefined` REMOVE a variável em vez de esvaziá-la, e a diferença é real: o
   * schema do env é `joi.string().default(...)`, que recusa string vazia. Com
   * REDIS_URL='' o boot morre em "Environment validation failed" — foi o que
   * este teste me mostrou na primeira execução. Vale para o Railway também:
   * deixar a variável em branco lá derruba a subida.
   */
  function comAmbiente(vars: Record<string, string | undefined>): boolean {
    jest.resetModules();
    for (const [chave, valor] of Object.entries(vars)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../src/services/cache/redisConnection').redisConfigurado();
  }

  it('URL default de localhost NÃO é Redis configurado', () => {
    expect(comAmbiente({ REDIS_URL: 'redis://localhost:6379', REDIS_HOST: 'localhost' })).toBe(false);
  });

  it('host 127.0.0.1 e ::1 também não contam', () => {
    // ::1 é exatamente o endereço do erro em produção: connect ECONNREFUSED ::1:6379
    expect(comAmbiente({ REDIS_URL: undefined, REDIS_HOST: '127.0.0.1' })).toBe(false);
    expect(comAmbiente({ REDIS_URL: undefined, REDIS_HOST: '::1' })).toBe(false);
  });

  it('URL de plugin do Railway conta como configurado', () => {
    expect(comAmbiente({
      REDIS_URL: 'redis://default:senha@redis.railway.internal:6379',
    })).toBe(true);
  });

  it('host apontando para fora conta como configurado', () => {
    expect(comAmbiente({ REDIS_URL: undefined, REDIS_HOST: 'redis.railway.internal' })).toBe(true);
  });

  it('no ambiente de teste, como está, não há Redis', () => {
    expect(redisConfigurado()).toBe(false);
  });
});

describe('rate limiter sem Redis', () => {

  beforeEach(() => {
    construcoesDeRedis.total = 0;
    // O env-setup dos testes desliga o rate limiting globalmente (senão as
    // suítes que fazem vários logins tomam 429 no meio). Esta suíte é a que
    // testa o limitador, então religa para si — e precisa ser antes do require,
    // porque envConfig é lido no import do módulo.
    process.env.ENABLE_RATE_LIMITING = 'true';
    jest.resetModules();
  });

  afterAll(() => {
    process.env.ENABLE_RATE_LIMITING = 'false';
  });

  it('NÃO ABRE CONEXÃO NENHUMA', async () => {
    // O coração da correção. Antes, a primeira chamada construía o cliente e
    // disparava as cinco linhas de erro.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { rateLimiter } = require('../../src/middleware/rateLimiter');

    // socket entra porque getClientIp cai em req.socket.remoteAddress quando não
    // há x-forwarded-for. Sem ele o middleware estoura antes de decidir nada.
    const req = {
      path: '/api/v1/companies', method: 'GET', ip: '203.0.113.10',
      headers: {}, socket: { remoteAddress: '203.0.113.10' },
    };
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await rateLimiter()(req as never, res as never, next as never);

    expect(next).toHaveBeenCalled();
    expect(construcoesDeRedis.total).toBe(0);
  });

  it('O LIMITE CONTINUA VALENDO — silenciar não é desligar', async () => {
    // Bate no endpoint de login acima do teto e exige que em algum momento seja
    // barrado. Sem esta verificação, "não logar erro" poderia ter sido
    // implementado como "deixar passar tudo", e a proteção do login morreria
    // sem ninguém perceber.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { rateLimiter } = require('../../src/middleware/rateLimiter');
    const middleware = rateLimiter();

    const ip = '203.0.113.77';
    let barrou = false;

    // O teto mais baixo é o do login: 5 por minuto.
    for (let i = 0; i < 40 && !barrou; i += 1) {
      const req = {
        path: '/api/v1/auth/login', method: 'POST', ip,
        headers: {}, socket: { remoteAddress: ip },
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(() => { barrou = true; }),
      };
      const next = jest.fn();
      // eslint-disable-next-line no-await-in-loop
      await middleware(req as never, res as never, next as never);
      if (res.status.mock.calls.some((c: unknown[]) => c[0] === 429)) barrou = true;
    }

    expect(barrou).toBe(true);
    expect(construcoesDeRedis.total).toBe(0);
  });
});
