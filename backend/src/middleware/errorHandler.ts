import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';
import { logger } from './requestLogger';
import { envConfig } from '../config/env';

/**
 * Global error handler middleware
 * Must be the last middleware registered
 */
export function errorHandler(
  err: Error | any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.statusCode || err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || 'An unexpected error occurred';
  const requestId = req.requestId || req.header('x-request-id') || 'unknown';

  res.setHeader('X-Request-Id', requestId);

  logger.error('Request error', {
    status,
    message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId,
  });

  // Handle validation errors (Joi)
  if (err.isJoi) {
    res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
      error: 'Validation Error',
      code: ERROR_CODES.VALIDATION_ERROR,
      message: err.message,
      details: err.details,
      requestId,
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Invalid Token',
      code: ERROR_CODES.TOKEN_INVALID,
      message: 'Invalid authentication token',
      requestId,
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Token Expired',
      code: ERROR_CODES.TOKEN_EXPIRED,
      message: 'Your session has expired',
      requestId,
    });
    return;
  }

  // Handle database errors
  if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      error: 'Service Unavailable',
      code: ERROR_CODES.DATABASE_ERROR,
      message: 'Database connection failed',
      requestId,
    });
    return;
  }

  const isProduction = envConfig.nodeEnv === 'production';

  // Erro deliberado do domínio (lançado com status explícito) tem mensagem
  // escrita para o usuário e pode ir como está. Erro inesperado — um erro do
  // Postgres, por exemplo — não: a mensagem do driver traz o SQL completo e os
  // nomes das tabelas, e isso ia direto para a resposta da API. Fica no log,
  // que já registra tudo acima, e o cliente recebe o requestId para correlação.
  const statusDeliberado = Boolean(err.statusCode || err.status);
  const exporMensagem = statusDeliberado || status < HTTP_STATUS.INTERNAL_SERVER_ERROR;

  const response: Record<string, unknown> = {
    error: statusDeliberado ? err.name || 'Error' : 'Internal Server Error',
    code: statusDeliberado ? err.code || ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.INTERNAL_ERROR,
    message: exporMensagem
      ? message
      : 'Erro interno ao processar a requisição. Informe o requestId ao suporte.',
    requestId,
  };

  // Stack trace só fora de produção. A condição anterior era
  // `nodeEnv === 'production' && RENDER_GIT_BRANCH !== 'main'`, que em um deploy
  // Render na branch main resultava em "não é produção" e devolvia o stack.
  if (!isProduction && err?.stack) {
    response.stack = err.stack.split('\n');
  }

  res.status(status).json(response);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
