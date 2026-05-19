import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ContasPagarController } from '../controllers/contasPagarController';

const router = Router();

router.use(authenticateToken);

router.get('/', ContasPagarController.listar);
router.post('/', ContasPagarController.criar);
router.get('/stats/estatisticas', ContasPagarController.getEstatisticas);
router.get('/:id', ContasPagarController.obter);
router.put('/:id', ContasPagarController.atualizar);
router.post('/:id/pagamentos', ContasPagarController.registrarPagamento);
router.delete('/:id', ContasPagarController.cancelar);

export default router;