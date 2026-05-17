import { Router } from 'express';
import { AccountController } from '../controllers/accountController';
import { authenticateToken } from '../middleware/auth';

/**
 * Chart of Accounts routes
 * Base path: /api/v1/companies/:companyId/accounts
 *
 * Endpoints implementados:
 * GET    /                           - Listar contas (com hierarquia opcional)
 * POST   /                           - Criar conta
 * GET    /:accountId                 - Obter detalhes
 * PUT    /:accountId                 - Atualizar
 * DELETE /:accountId                 - Deletar (soft delete)
 * GET    /:accountId/balance         - Obter saldo
 * GET    /hierarchy                  - Obter árvore de contas
 * POST   /import-plano               - Importar plano padrão
 */
const router = Router({ mergeParams: true });

/**
 * Middleware de autenticação
 * Todos os endpoints requerem JWT válido
 */
router.use(authenticateToken);

/**
 * GET /companies/:companyId/accounts
 * Listar contas com filtros e opção de hierarquia
 * Query params: page, limit, search, type, hierarchy, parent_code, tax_code
 * Acesso: Todos (isolamento por empresa)
 */
router.get('/', AccountController.listAccounts);

/**
 * POST /companies/:companyId/accounts
 * Criar nova conta contábil
 * Body: {code, name, type, parent_code?, tax_code?, is_analytical?}
 * Acesso: ACCOUNTANT, ADMIN
 */
router.post('/', AccountController.createAccount);

/**
 * GET /companies/:companyId/accounts/hierarchy
 * Obter hierarquia de contas em estrutura de árvore
 * Query params: parent_code (opcional)
 * Acesso: Todos
 * Nota: Deve estar antes de /:accountId para não conflitar
 */
router.get('/hierarchy', AccountController.getHierarchy);

/**
 * POST /companies/:companyId/accounts/import-plano
 * Importar plano de contas padrão (plano-contas-padrao.json)
 * Body: {overwrite?: boolean}
 * Acesso: ADMIN only
 * Nota: Deve estar antes de /:accountId para não conflitar
 */
router.post('/import-plano', AccountController.importPlano);

/**
 * GET /companies/:companyId/accounts/:accountId
 * Obter detalhes de uma conta específica
 * Acesso: Todos
 */
router.get('/:accountId', AccountController.getAccount);

/**
 * GET /companies/:companyId/accounts/:accountId/balance
 * Obter saldo de uma conta (debit - credit)
 * Acesso: Todos
 * Nota: Deve estar antes de PUT/DELETE para não conflitar com /:accountId
 */
router.get('/:accountId/balance', AccountController.getBalance);

/**
 * PUT /companies/:companyId/accounts/:accountId
 * Atualizar dados de uma conta
 * Body: {name?, type?, parent_code?, tax_code?, is_analytical?}
 * Acesso: ACCOUNTANT, ADMIN
 * Imutável: code
 */
router.put('/:accountId', AccountController.updateAccount);

/**
 * DELETE /companies/:companyId/accounts/:accountId
 * Deletar conta (soft delete)
 * Acesso: ADMIN only
 * Restrição: Não pode deletar conta com lançamentos
 */
router.delete('/:accountId', AccountController.deleteAccount);

export default router;
