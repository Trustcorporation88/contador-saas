import { Router, Request, Response } from 'express';
import * as authController from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

/**
 * Authentication routes
 * POST   /auth/login
 * POST   /auth/refresh-token
 * POST   /auth/enable-mfa
 * POST   /auth/verify-mfa
 * POST   /auth/logout
 * GET    /auth/me
 */
const router = Router();

/**
 * POST /auth/login
 * Login com email e senha
 */
router.post('/login', authController.login);

/**
 * POST /auth/refresh-token
 * Renovar access token usando refresh token
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * POST /auth/enable-mfa
 * Habilitar MFA (TOTP setup) - Requer autenticação
 */
router.post('/enable-mfa', authenticateToken, authController.enableMFA);

/**
 * POST /auth/verify-mfa
 * Verificar código TOTP - Requer autenticação com token MFA
 */
router.post('/verify-mfa', authenticateToken, authController.verifyMFA);

/**
 * POST /auth/logout
 * Fazer logout e revogar refresh token - Requer autenticação
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * GET /auth/me (opcional)
 * Obter dados do usuário logado
 */
router.get('/me', authenticateToken, (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.status(200).json({
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        companyId: req.user.companyId,
      },
      tokenExpires: req.tokenMetadata?.expiresAt,
    },
  });
});

export default router;
