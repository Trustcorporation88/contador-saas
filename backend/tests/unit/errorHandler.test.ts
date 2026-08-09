/**
 * Regressão: erro inesperado não pode devolver detalhe interno na resposta.
 *
 * Bug: a mensagem do erro ia crua para o cliente em qualquer 500. Um erro do
 * driver do Postgres levava o SQL completo e os nomes das tabelas — observado
 * em `GET /companies/:id/recurring-transactions`, que respondia
 * `select count("id") ... from "recurring_transactions" where "company_id" = $1`.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const ambiente = { nodeEnv: 'production' };
jest.mock('../../src/config/env', () => ({
  envConfig: {
    get nodeEnv() {
      return ambiente.nodeEnv;
    },
  },
}));

import { Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';

function responder(err: unknown): { status: number; body: Record<string, unknown> } {
  const capturado = { status: 0, body: {} as Record<string, unknown> };
  const res = {
    setHeader: jest.fn(),
    status: (s: number) => {
      capturado.status = s;
      return res;
    },
    json: (b: Record<string, unknown>) => {
      capturado.body = b;
      return res;
    },
  } as unknown as Response;
  errorHandler(err, { path: '/x', method: 'GET', header: () => undefined } as unknown as Request, res, jest.fn());
  return capturado;
}

/** Erro típico do driver do Postgres: traz o SQL na mensagem. */
function erroDoPostgres(): Error {
  return Object.assign(
    new Error(
      'select count("id") as "count" from "recurring_transactions" where "company_id" = $1'
        + ' - relation "recurring_transactions" does not exist',
    ),
    { code: '42P01' },
  );
}

describe('errorHandler', () => {
  beforeEach(() => {
    ambiente.nodeEnv = 'production';
  });

  it('não devolve o SQL nem o nome da tabela em erro inesperado', () => {
    const { status, body } = responder(erroDoPostgres());
    expect(status).toBe(500);
    expect(String(body.message)).not.toMatch(/select|recurring_transactions|relation/i);
    expect(body.message).toMatch(/requestId/i);
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('preserva a mensagem de erro de validação do domínio (4xx)', () => {
    const err = Object.assign(new Error('Desconto é maior que o total dos produtos.'), {
      status: 400,
    });
    const { status, body } = responder(err);
    expect(status).toBe(400);
    expect(body.message).toBe('Desconto é maior que o total dos produtos.');
  });

  it('preserva mensagem de erro deliberado mesmo com status 500', () => {
    const err = Object.assign(new Error('Script de emissão não encontrado no servidor.'), {
      status: 500,
    });
    const { body } = responder(err);
    expect(body.message).toBe('Script de emissão não encontrado no servidor.');
  });

  it('nunca inclui stack trace em produção', () => {
    expect(responder(erroDoPostgres()).body.stack).toBeUndefined();
    // A condição anterior era `nodeEnv === 'production' && RENDER_GIT_BRANCH !== 'main'`:
    // num deploy Render na branch main ela dava "não é produção" e vazava o stack.
    process.env.RENDER_GIT_BRANCH = 'main';
    expect(responder(erroDoPostgres()).body.stack).toBeUndefined();
    delete process.env.RENDER_GIT_BRANCH;
  });

  it('inclui stack fora de produção, para depuração', () => {
    ambiente.nodeEnv = 'development';
    expect(responder(erroDoPostgres()).body.stack).toBeDefined();
  });
});
