import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { envConfig } from '../config/env';

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
  const originalJson = res.json;

  // Override res.json to log response status
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const level = statusCode >= 400 ? 'warn' : 'info';

    logger[level as 'info' | 'warn'](`${req.method} ${req.path}`, {
      statusCode,
      duration: `${duration}ms`,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || 'anonymous',
      responseSize: JSON.stringify(body).length,
    });

    return originalJson.call(this, body);
  };

  next();
}

export default logger;
