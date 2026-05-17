/**
 * Copiloto Routes
 * GET  /api/v1/copiloto/status — Status da integração DeepSeek
 * POST /api/v1/copiloto/chat   — Chat com o Copiloto Contábil IA
 */

import { Router } from 'express';
import { CopilotoController } from '../controllers/copilotoController';
import authenticateToken from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

router.get('/status', CopilotoController.status);
router.post('/chat',  CopilotoController.chat);

export default router;
