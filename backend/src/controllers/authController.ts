/**
 * Authentication Controller
 * REST endpoints para autenticação e autorização
 */

import { Request, Response } from 'express';
import authService from '../services/authService';
import { logger } from '../middleware/requestLogger';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';
import {
  LoginRequest,
  MFAVerifyRequest,
  RefreshTokenRequest,
  InvalidCredentialsError,
  InvalidTokenError,
  RateLimitError,
} from '../types/auth';

const INVALID_REQUEST_CODE = (ERROR_CODES as any).INVALID_REQUEST || ERROR_CODES.VALIDATION_ERROR;
const INVALID_TOKEN_CODE = (ERROR_CODES as any).INVALID_TOKEN || ERROR_CODES.TOKEN_INVALID;
const INTERNAL_SERVER_ERROR_CODE = (ERROR_CODES as any).INTERNAL_SERVER_ERROR || ERROR_CODES.INTERNAL_ERROR;

/**
 * POST /auth/login
 * Login com email e senha
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as LoginRequest;

    // Validação
    if (!email || !password) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'Email and password are required',
      });
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'Invalid email format',
      });
      return;
    }

    const response = await authService.login(email, password);

    // Se MFA habilitado, retornar token temporário
    if (!response.refreshToken) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'MFA Required',
        code: 'MFA_REQUIRED',
        message: 'MFA verification required',
        data: {
          accessToken: response.accessToken, // Token temporário válido por 5 minutos
          user: response.user,
        },
      });
      return;
    }

    logger.info(`Login bem-sucedido para usuário: ${email}`);

    res.status(HTTP_STATUS.OK).json({
      data: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
      },
    });
  } catch (error) {
    handleAuthError(error, res, 'Login error');
  }
}

/**
 * POST /auth/refresh-token
 * Renovar access token usando refresh token
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshTokenRequest;

    if (!refreshToken) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'Refresh token is required',
      });
      return;
    }

    const response = await authService.refreshAccessToken(refreshToken);

    logger.info('Refresh token utilizado com sucesso');

    res.status(HTTP_STATUS.OK).json({
      data: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      },
    });
  } catch (error) {
    handleAuthError(error, res, 'Refresh token error');
  }
}

/**
 * POST /auth/enable-mfa
 * Habilitar MFA (TOTP setup)
 */
export async function enableMFA(req: Request, res: Response): Promise<void> {
  try {
    // Verificar se usuário está autenticado
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
      });
      return;
    }

    const response = await authService.enableMFA(req.user.id);

    logger.info(`MFA setup iniciado para usuário: ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      data: {
        qrCode: response.qrCode,
        secret: response.secret,
        backupCodes: response.backupCodes,
      },
    });
  } catch (error) {
    handleAuthError(error, res, 'Enable MFA error');
  }
}

/**
 * POST /auth/verify-mfa
 * Verificar código TOTP e ativar MFA
 */
export async function verifyMFA(req: Request, res: Response): Promise<void> {
  try {
    // Verificar se há token temporário no header
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'MFA setup required',
      });
      return;
    }

    const { code } = req.body as MFAVerifyRequest;

    if (!code) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'MFA code is required',
      });
      return;
    }

    // Validar formato (6 dígitos)
    if (!/^\d{6}$/.test(code)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'MFA code must be 6 digits',
      });
      return;
    }

    const response = await authService.verifyMFA(req.user.id, code);

    logger.info(`MFA verificado com sucesso para usuário: ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      data: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
      },
    });
  } catch (error) {
    handleAuthError(error, res, 'Verify MFA error');
  }
}

/**
 * POST /auth/logout
 * Fazer logout e revogar refresh token
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
      });
      return;
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'Invalid token format',
      });
      return;
    }

    await authService.logout(req.user.id, token);

    logger.info(`Usuário deslogado: ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    handleAuthError(error, res, 'Logout error');
  }
}

/**
 * POST /auth/forgot-password
 * Solicita reset de senha com token temporário
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'Email is required',
      });
      return;
    }

    const result = await authService.requestPasswordReset(email);

    res.status(HTTP_STATUS.OK).json({
      data: {
        message: 'Se o e-mail existir, enviaremos instrucoes para redefinir a senha.',
        ...(result.debugToken ? { debugToken: result.debugToken } : {}),
      },
    });
  } catch (error) {
    handleAuthError(error, res, 'Forgot password error');
  }
}

/**
 * POST /auth/reset-password
 * Efetiva reset de senha com token temporário
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!token || !newPassword) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        code: INVALID_REQUEST_CODE,
        message: 'Token and newPassword are required',
      });
      return;
    }

    await authService.resetPassword(token, newPassword);

    res.status(HTTP_STATUS.OK).json({
      data: {
        message: 'Senha redefinida com sucesso. Faça login novamente.',
      },
    });
  } catch (error) {
    handleAuthError(error, res, 'Reset password error');
  }
}

/**
 * Helper para tratamento de erros de autenticação
 */
function handleAuthError(error: any, res: Response, context: string): void {
  logger.error(`${context}: ${error.message}`);

  if (error instanceof InvalidCredentialsError) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Unauthorized',
      code: ERROR_CODES.UNAUTHORIZED,
      message: error.message,
    });
  } else if (error instanceof InvalidTokenError) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Invalid Token',
      code: INVALID_TOKEN_CODE,
      message: error.message,
    });
  } else if (error instanceof RateLimitError) {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      error: 'Rate Limit',
      code: 'RATE_LIMIT_EXCEEDED',
      message: error.message,
    });
  } else if (error.message.includes('already enabled')) {
    res.status(HTTP_STATUS.CONFLICT).json({
      error: 'Conflict',
      code: 'MFA_ALREADY_ENABLED',
      message: error.message,
    });
  } else {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal Server Error',
      code: INTERNAL_SERVER_ERROR_CODE,
      message: 'An error occurred during authentication',
    });
  }
}
