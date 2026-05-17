/**
 * CNPJ Routes
 * Consulta e validação de CNPJ via Receita Federal / BrasilAPI
 *
 * GET /cnpj/:cnpj          - Busca dados completos na Receita Federal (com cache 24h)
 * GET /cnpj/:cnpj/validate - Valida dígitos localmente (sem API externa)
 */

import { Router } from 'express';
import { CnpjController } from '../controllers/cnpjController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

/** Consulta completa na Receita Federal via BrasilAPI */
router.get('/:cnpj', CnpjController.lookup);

/** Validação local de dígitos verificadores */
router.get('/:cnpj/validate', CnpjController.validate);

export default router;
