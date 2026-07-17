/**
 * Documento Routes
 * Consulta e validação de CNPJ/CPF
 *
 * GET /cnpj/documento/:documento - Busca por CPF/CNPJ (auto)
 * GET /cnpj/:cnpj                - Busca CNPJ
 * GET /cnpj/cpf/:cpf             - Busca CPF
 * GET /cnpj/:cnpj/validate       - Valida CNPJ localmente
 * GET /cnpj/cpf/:cpf/validate    - Valida CPF localmente
 */

import { Router } from 'express';
import { CnpjController } from '../controllers/cnpjController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

/** Consulta automática por documento (11 = CPF, 14 = CNPJ) */
router.get('/documento/:documento', CnpjController.lookupDocumento);

/** Consulta de CPF */
router.get('/cpf/:cpf', CnpjController.lookupCpf);

/** Validação local de CPF */
router.get('/cpf/:cpf/validate', CnpjController.validateCpf);

/** Consulta de CNPJ */
router.get('/:cnpj', CnpjController.lookup);

/** Validação local de dígitos verificadores */
router.get('/:cnpj/validate', CnpjController.validate);

export default router;
