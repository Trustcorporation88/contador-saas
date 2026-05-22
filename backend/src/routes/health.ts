/**
 * Health Routes
 * Rotas para health checks e monitoring
 */

import { Router } from 'express';
import { HealthController } from '../controllers/healthController';

const router = Router();

/**
 * GET /api/v1/health
 * Health check básico da aplicação
 */
router.get('/', HealthController.health);

/**
 * GET /api/v1/health/cache
 * Health check detalhado do sistema de cache Redis
 */
router.get('/cache', HealthController.cacheHealth);

/**
 * GET /api/v1/health/database
 * Health check do banco de dados PostgreSQL
 */
router.get('/database', HealthController.databaseHealth);

export default router;
