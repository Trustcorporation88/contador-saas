/**
 * Health Routes
 * Rotas para health checks e monitoring
 */

import { Router } from 'express';
import { HealthController } from '../controllers/healthController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/health
 * Health check básico da aplicação — público, é o alvo do healthcheck do deploy.
 */
router.get('/', HealthController.health);

/**
 * GET /api/v1/health/cache
 * GET /api/v1/health/database
 *
 * Detalhes de infraestrutura (latência do banco, tamanho do pool, memória do
 * Redis, contagem de tokens revogados) eram públicos e serviam de mapa para
 * reconhecimento. Passam a exigir autenticação; o healthcheck do deploy usa
 * `/health` e `/api/v1/health`, que continuam abertos.
 */
router.get('/cache', authenticateToken, HealthController.cacheHealth);
router.get('/database', authenticateToken, HealthController.databaseHealth);

export default router;
