/**
 * Enhanced Security Headers Middleware
 * 
 * Implementa headers de segurança otimizados baseados em OWASP best practices:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * 
 * @module middleware/security
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { envConfig } from '../config/env';

/**
 * Content Security Policy configurável por ambiente
 */
function getCSPDirectives() {
  const isDevelopment = envConfig.nodeEnv === 'development';

  // CSP base (strict)
  const baseDirectives: helmet.ContentSecurityPolicyOptions['directives'] = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: [],
  };

  // Desenvolvimento: mais permissivo (hot reload, etc)
  if (isDevelopment) {
    return {
      ...baseDirectives,
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'ws:', 'wss:'], // WebSocket para hot reload
    };
  }

  // Produção: strict mas permite Swagger UI
  return {
    ...baseDirectives,
    // Permite unsafe-inline APENAS para /api/docs (Swagger UI)
    scriptSrc: ["'self'", (req: Request) => {
      if (req.path.startsWith('/api/docs')) {
        return "'unsafe-inline'";
      }
      return "'self'";
    }, 'https://unpkg.com'], // CDN do Swagger UI
    styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
  };
}

/**
 * Helmet.js configuration
 */
export function securityHeaders() {
  const isProd = envConfig.nodeEnv === 'production';

  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: getCSPDirectives() as any,
      reportOnly: false,
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 ano
      includeSubDomains: true,
      preload: true,
    },

    // X-Frame-Options (clickjacking protection)
    frameguard: {
      action: 'deny',
    },

    // X-Content-Type-Options (MIME sniffing protection)
    noSniff: true,

    // X-XSS-Protection (legacy, mas mantém compatibilidade)
    xssFilter: true,

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false,
    },

    // Download Options (IE only, mas mantém)
    ieNoOpen: true,

    // Hide X-Powered-By
    hidePoweredBy: true,

    // Expect-CT (Certificate Transparency)
    expectCt: isProd
      ? {
          maxAge: 86400,
          enforce: true,
        }
      : undefined,

    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // Pode quebrar alguns recursos
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
}

/**
 * Additional custom security headers
 */
export function additionalSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Permissions-Policy (Feature-Policy)
    // Desabilita features sensíveis por padrão
    res.setHeader(
      'Permissions-Policy',
      [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
      ].join(', '),
    );

    // X-Content-Type-Options (dupla garantia)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options (dupla garantia, alguns proxies removem)
    res.setHeader('X-Frame-Options', 'DENY');

    // Cache-Control para rotas sensíveis
    if (
      req.path.startsWith('/api/v1/auth') ||
      req.path.startsWith('/api/v1/reports')
    ) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
}

/**
 * Security headers for API endpoints
 * 
 * Combina Helmet.js com headers customizados
 */
export function securityMiddleware() {
  return [
    securityHeaders(),
    additionalSecurityHeaders(),
  ];
}

export default securityMiddleware;
