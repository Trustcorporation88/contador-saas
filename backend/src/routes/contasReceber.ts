import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { applyCompanyContext } from '../middleware/companyContext';
import { ContasReceberController } from '../controllers/contasReceberController';

const router = Router();

router.use(authenticateToken);
router.use(applyCompanyContext);

router.get('/', ContasReceberController.listar);
router.post('/', ContasReceberController.criar);
router.get('/stats/estatisticas', ContasReceberController.getEstatisticas);
router.get('/:id', ContasReceberController.obter);
router.put('/:id', ContasReceberController.atualizar);
router.post('/:id/recebimentos', ContasReceberController.registrarRecebimento);
router.delete('/:id', ContasReceberController.cancelar);

export default router;