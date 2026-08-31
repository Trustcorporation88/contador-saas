/**
 * Produtos Routes: catálogo de produtos por empresa
 *
 * GET    /companies/:companyId/produtos/buscar   Autocomplete (q, limit)
 * GET    /companies/:companyId/produtos          Listar (q, page, limit)
 * POST   /companies/:companyId/produtos          Cadastrar
 * GET    /companies/:companyId/produtos/:id      Obter
 * PUT    /companies/:companyId/produtos/:id      Atualizar
 * DELETE /companies/:companyId/produtos/:id      Remover
 *
 * Além do cadastro manual, a tabela é alimentada automaticamente por cada
 * NF-e criada (NfeService.create → ProdutoService.registrarEmissao).
 */

import { Router } from 'express';
import { ProdutoController } from '../controllers/produtoController';
import { authenticateToken } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateTenantAccess);

// "buscar" antes de "/:id" para não ser capturado como id.
router.get   ('/buscar', ProdutoController.buscar);
router.get   ('/',       ProdutoController.listar);
router.post  ('/',       ProdutoController.criar);
router.get   ('/:id',    ProdutoController.obter);
router.put   ('/:id',    ProdutoController.atualizar);
router.delete('/:id',    ProdutoController.remover);

export default router;
