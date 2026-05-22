/**
 * Authentication & Authorization Middleware
 * JWT validation, role-based access control, MFA token handling
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { envConfig } from '../config/env';
import { ERROR_CODES, HTTP_STATUS } from '../config/constants';
import { logger } from './requestLogger';
import { JWTPayload } from '../types/auth';
import { validateToken as validateTokenBlacklist } from '../services/cache/tokenBlacklist';

/**
 * Extend Express Request with authenticated user data
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        companyId: string;
        mfaRequired?: boolean;
      };
      tokenMetadata?: {
        issuedAt: number;
        expiresAt: number;
        isMFAToken: boolean;
      };
    }
  }
}

/**
 * JWT authentication middleware
 * Valida bearer token e anexa user ao request
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'No authentication token provided',
      });
      return;
    }

    jwt.verify(token, envConfig.jwt.secret, (error, decoded: any) => {
      if (error) {
        if (error.name === 'TokenExpiredError') {
          logger.warn('Token expired', { email: decoded?.email });
          res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: 'Token Expired',
            code: ERROR_CODES.TOKEN_EXPIRED,
            message: 'Your session has expired. Please login again.',
          });
          return;
        }

        if (error.name === 'JsonWebTokenError') {
          logger.warn('Invalid token format', { error: error.message });
          res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: 'Invalid Token',
            code: ERROR_CODES.TOKEN_INVALID,
            message: 'Invalid authentication token',
          });
          return;
        }

        logger.warn('Token verification failed', { error: error.message });
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Invalid Token',
          code: ERROR_CODES.TOKEN_INVALID,
          message: 'Invalid authentication token',
        });
        return;
      }

      const payload = decoded as JWTPayload & { mfaRequired?: boolean };

      // Check token blacklist (revoked tokens)
      const jti = (payload as any).jti || '';
      if (jti) {
        validateTokenBlacklist(jti, payload.sub, payload.iat)
          .then((result) => {
            if (!result.valid) {
              logger.warn('Blacklisted token attempted', {
                userId: payload.sub,
                reason: result.reason,
                jti,
              });
              res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: 'Token Revoked',
                code: 'TOKEN_REVOKED',
                message: 'This token has been revoked. Please login again.',
                reason: result.reason,
              });
              return;
            }

            // Token válido e não blacklisted
            req.user = {
              id: payload.sub,
              email: payload.email,
              role: payload.role,
              companyId: payload.companyId,
              mfaRequired: payload.mfaRequired,
            };

            req.tokenMetadata = {
              issuedAt: payload.iat,
              expiresAt: payload.exp,
              isMFAToken: !!payload.mfaRequired,
            };

            logger.debug('Token validated', { userId: payload.sub });
            next();
          })
          .catch((err) => {
            logger.error('Token blacklist check failed', {
              error: err.message,
              userId: payload.sub,
            });
            // Fail open: se Redis falhar, permite request (degraded mode)
            req.user = {
              id: payload.sub,
              email: payload.email,
              role: payload.role,
              companyId: payload.companyId,
              mfaRequired: payload.mfaRequired,
            };

            req.tokenMetadata = {
              issuedAt: payload.iat,
              expiresAt: payload.exp,
              isMFAToken: !!payload.mfaRequired,
            };

            logger.debug('Token validated (blacklist check bypassed)', {
              userId: payload.sub,
            });
            next();
          });
      } else {
        // Token sem JTI (legacy tokens)
        logger.warn('Token without JTI', { userId: payload.sub });
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          companyId: payload.companyId,
          mfaRequired: payload.mfaRequired,
        };

        req.tokenMetadata = {
          issuedAt: payload.iat,
          expiresAt: payload.exp,
          isMFAToken: !!payload.mfaRequired,
        };

        next();
      }
    });
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal Server Error',
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred during authentication',
    });
  }
}

/**
 * Optional authentication middleware
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, envConfig.jwt.secret, (error: any, decoded: any) => {
      if (!error) {
        const payload = decoded as JWTPayload & { mfaRequired?: boolean };
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          companyId: payload.companyId,
          mfaRequired: payload.mfaRequired,
        };
      }
    });
  }

  next();
}

/**
 * Multi-role authorization middleware
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
      });
      return;
    }

    if (req.user.mfaRequired) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Forbidden',
        code: 'MFA_REQUIRED',
        message: 'Please complete MFA verification first',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization denied', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Forbidden',
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
}

/**
 * Generate JWT token with JTI (unique identifier for revocation)
 */
export function generateToken(payload: Record<string, unknown>): string {
  const { v4: uuidv4 } = require('crypto');
  
  return jwt.sign(payload, envConfig.jwt.secret, {
    jwtid: uuidv4(), // Unique identifier para blacklist
    expiresIn: envConfig.jwt.expiry as any,
    algorithm: envConfig.jwt.algorithm as any,
  });
}

/**
 * Generate refresh token with JTI
 */
export function generateRefreshToken(payload: Record<string, unknown>): string {
  const { v4: uuidv4 } = require('crypto');
  
  return jwt.sign(payload, envConfig.jwt.refreshSecret, {
    jwtid: uuidv4(), // Unique identifier para blacklist
    expiresIn: envConfig.jwt.refreshExpiry as any,
    algorithm: envConfig.jwt.algorithm as any,
  });
}

/**
 * Verify and decode token (without throwing)
 */
export function verifyToken(
  token: string,
): { valid: boolean; decoded?: JWTPayload } {
  try {
    const decoded = jwt.verify(token, envConfig.jwt.secret);
    return { valid: true, decoded: decoded as JWTPayload };
  } catch {
    return { valid: false };
  }
}

export default authenticateToken;
