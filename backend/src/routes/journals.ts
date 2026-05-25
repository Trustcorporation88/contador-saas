import { Router } from 'express';
import { JournalController } from '../controllers/journalController';
import { authenticateToken } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';

/**
 * Journal Entries Routes
 * Todos os endpoints requerem autenticação (aplicada em companies.ts)
 *
 * GET    /companies/:cId/journal-entries              - Listar lançamentos
 * POST   /companies/:cId/journal-entries              - Criar lançamento (DRAFT)
 * GET    /companies/:cId/journal-entries/:entryId     - Buscar por ID
 * PUT    /companies/:cId/journal-entries/:entryId     - Atualizar (apenas DRAFT)
 * DELETE /companies/:cId/journal-entries/:entryId     - Deletar (apenas DRAFT)
 * POST   /companies/:cId/journal-entries/:entryId/post    - Postar (DRAFT → POSTED)
 * POST   /companies/:cId/journal-entries/:entryId/reverse - Estornar (POSTED)
 */
const router = Router({ mergeParams: true });

router.use(authenticateToken, validateTenantAccess);

/**
 * POST /companies/:companyId/journal-entries
 * Criar lançamento contábil (DRAFT, partidas dobradas)
 * Requer: ACCOUNTANT ou ADMIN
 */
router.post('/', JournalController.create);

/**
 * GET /companies/:companyId/journal-entries
 * Listar lançamentos com filtros e paginação
 * Query: page, limit, date_from, date_to, is_posted, reference_type, search, account_id
 */
router.get('/', JournalController.list);

/**
 * POST /companies/:companyId/journal-entries/:entryId/post
 * Postar lançamento (DRAFT → POSTED, imutável)
 * IMPORTANTE: deve estar antes de /:entryId para não conflitar
 */
router.post('/:entryId/post', JournalController.post);

/**
 * POST /companies/:companyId/journal-entries/:entryId/reverse
 * Estornar lançamento postado (cria novo lançamento com valores invertidos)
 * Body: { reverse_date?: string } (opcional)
 */
router.post('/:entryId/reverse', JournalController.reverse);

/**
 * GET /companies/:companyId/journal-entries/:entryId
 * Buscar lançamento por ID com todas as linhas
 */
router.get('/:entryId', JournalController.getById);

/**
 * PUT /companies/:companyId/journal-entries/:entryId
 * Atualizar lançamento (apenas DRAFT)
 * Requer: ACCOUNTANT ou ADMIN
 */
router.put('/:entryId', JournalController.update);

/**
 * DELETE /companies/:companyId/journal-entries/:entryId
 * Deletar lançamento (apenas DRAFT)
 * Requer: ADMIN
 */
router.delete('/:entryId', JournalController.remove);

export default router;
