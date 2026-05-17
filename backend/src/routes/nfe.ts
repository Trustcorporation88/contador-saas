/**
 * NF-e Routes
 * Ciclo de vida da Nota Fiscal Eletrônica (NF-e modelo 55 / NFC-e modelo 65)
 *
 * POST   /companies/:companyId/nfe                   — Criar NF-e (rascunho)
 * GET    /companies/:companyId/nfe                   — Listar NF-e
 * GET    /companies/:companyId/nfe/:id               — Buscar NF-e com itens
 * POST   /companies/:companyId/nfe/:id/autorizar     — Autorizar (envia ao SEFAZ mock)
 * POST   /companies/:companyId/nfe/:id/cancelar      — Cancelar NF-e autorizada
 * GET    /companies/:companyId/nfe/:id/xml           — Download XML
 */

import { Router } from 'express';
import { NfeController } from '../controllers/nfeController';

const router = Router({ mergeParams: true });

router.post  ('/',                 NfeController.create);
router.get   ('/',                 NfeController.list);
router.get   ('/:id',             NfeController.get);
router.post  ('/:id/autorizar',   NfeController.authorize);
router.post  ('/:id/cancelar',    NfeController.cancel);
router.get   ('/:id/xml',         NfeController.getXml);

export default router;
