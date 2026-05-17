import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { auditMiddleware } from './middleware/auditMiddleware';
import routes from './routes';
import { envConfig } from './config/env';

/**
 * Express app configuration
 * Middleware setup, routing, error handling
 */
export const app: Express = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: envConfig.corsOrigin.split(','),
    credentials: envConfig.corsCredentials,
    optionsSuccessStatus: 200,
  }),
);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use(requestLogger);

// Audit middleware (auto-log POST/PUT/DELETE para audit_logs)
app.use('/api/v1', auditMiddleware());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API v1 routes
app.use('/api/v1', routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    timestamp: new Date().toISOString(),
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
