import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import crypto from 'crypto';
import { envConfig } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Winston logger configuration
 * Structured logging for requests and application events
 */
export const logger = winston.createLogger({
  level: envConfig.logLevel,
  format:
    envConfig.logFormat === 'json'
      ? winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        )
      : winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf((info) => {
            const base = `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`;
            const meta = info.meta ? JSON.stringify(info.meta) : '';
            return meta ? `${base} ${meta}` : base;
          }),
        ),
  defaultMeta: { service: 'contador-backend' },
  transports: [
    new winston.transports.Console(),
    // Uncomment to log to file
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

/**
 * Request logging middleware
 * Logs incoming requests and response status
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const incomingRequestId = req.header('x-request-id');
  const requestId = incomingRequestId && incomingRequestId.trim().length > 0
    ? incomingRequestId.trim().slice(0, 128)
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const contentLength = res.getHeader('content-length');

    logger.log({
      level,
      message: `${req.method} ${req.path}`,
      statusCode,
      duration: `${duration}ms`,
      method: req.method,
      path: req.path,
      requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || 'anonymous',
      responseSize: typeof contentLength === 'string' ? contentLength : undefined,
    });
  });

  next();
}

export default logger;
