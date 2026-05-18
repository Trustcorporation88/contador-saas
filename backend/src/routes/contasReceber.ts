import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ContasReceberController } from '../controllers/contasReceberController';

const router = Router();

router.use(authenticateToken);

router.get('/', (req: Request, res: Response) => {
  ContasReceberController.listar(req, res);
});

router.post('/', (req: Request, res: Response) => {
  ContasReceberController.criar(req, res);
});

router.get('/stats/estatisticas', (req: Request, res: Response) => {
  ContasReceberController.getEstatisticas(req, res);
});

router.get('/:id', (req: Request, res: Response) => {
  ContasReceberController.obter(req, res);
});

router.put('/:id', (req: Request, res: Response) => {
  ContasReceberController.atualizar(req, res);
});

router.post('/:id/recebimentos', (req: Request, res: Response) => {
  ContasReceberController.registrarRecebimento(req, res);
});

router.delete('/:id', (req: Request, res: Response) => {
  ContasReceberController.cancelar(req, res);
});

export default router;