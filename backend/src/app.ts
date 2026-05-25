import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger, getRequestMetricsSnapshot } from './middleware/requestLogger';
import { auditMiddleware } from './middleware/auditMiddleware';
import { debugLoggerMiddleware } from './middleware/debugLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { securityMiddleware } from './middleware/security';
import { trackRequest } from './controllers/healthController';
import routes from './routes';
import { envConfig } from './config/env';

/**
 * Express app configuration
 * Middleware setup, routing, error handling
 */
export const app: Express = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const fallbackOrigins = [
  'https://procontador.com.br',
  'https://www.procontador.com.br',
  'https://contador-saas-ashy.vercel.app',
  'https://app.ocontador.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
const allowedOrigins = Array.from(
  new Set(
    envConfig.corsOrigin
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .concat(fallbackOrigins)
  )
);

const sanitizeString = (value: string): string => value.replace(/<[^>]*>/g, '').trim();

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      // Bloqueia chaves comuns usadas em payloads maliciosos.
      if (key.startsWith('$') || key.includes('.')) continue;
      output[key] = sanitizeValue(nested);
    }
    return output;
  }

  return value;
};

// Security middleware (Helmet.js + custom headers)
app.use(securityMiddleware());

// CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
    credentials: envConfig.corsCredentials,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // Cache preflight 24h
  }),
);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// OWASP A01/A05: valida origem para requests mutantes quando Origin estiver presente.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!mutatingMethods.has(req.method.toUpperCase())) return next();

  const origin = req.headers.origin;
  if (!origin) return next();

  if (allowedOrigins.includes(origin)) return next();

  return res.status(403).json({
    error: 'Forbidden',
    code: 'ORIGIN_NOT_ALLOWED',
    message: 'Origin not allowed for this operation',
  });
});

// OWASP A03: sanitiza params/query/body para reduzir XSS e payloads inseguros.
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.query = sanitizeValue(req.query) as Request['query'];
  req.params = sanitizeValue(req.params) as Request['params'];
  req.body = sanitizeValue(req.body) as Request['body'];
  next();
});

// Multi-tier rate limiting (global, IP, user, tenant, endpoint-specific)
app.use(rateLimiter());

// Request logging
app.use(requestLogger);
app.use(debugLoggerMiddleware);

// Track API metrics para health check
app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    const isError = res.statusCode >= 500;
    trackRequest(isError);
  });
  next();
});

// DEBUG: Log all requests to /api/v1/companies
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path === '/companies' && req.method === 'GET') {
    console.log('[COMPANIES_ENDPOINT_DEBUG]', {
      method: req.method,
      path: req.path,
      fullPath: req.originalUrl,
      headers: req.headers,
      user: (req as any).user,
      timestamp: new Date().toISOString(),
    });
  }
  next();
});

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

if (envConfig.enableObservabilityDashboard) {
  app.get('/api/v1/observability/dashboard', (req: Request, res: Response) => {
    if (envConfig.observabilityApiKey) {
      const provided = String(req.headers['x-observability-key'] || '').trim();
      if (!provided || provided !== envConfig.observabilityApiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          code: 'OBSERVABILITY_UNAUTHORIZED',
          message: 'Invalid observability key',
        });
      }
    }

    return res.status(200).json({
      data: getRequestMetricsSnapshot(),
    });
  });
}

// OpenAPI docs (Task 5.7)
if (envConfig.enableApiDocs) {
  app.get('/api/docs/openapi.yaml', (_req: Request, res: Response) => {
    const openapiPath = path.resolve(__dirname, '../../openapi.yaml');
    if (!fs.existsSync(openapiPath)) {
      return res.status(404).send('openapi.yaml not found');
    }

    res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
    return res.send(fs.readFileSync(openapiPath, 'utf-8'));
  });

  app.get('/api/docs', (_req: Request, res: Response) => {
    res.type('html').send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>O Contador - API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        docExpansion: 'list',
      });
    </script>
  </body>
</html>`);
  });
}

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
