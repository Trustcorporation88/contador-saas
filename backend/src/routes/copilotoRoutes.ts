import { Router } from 'express';
import { CopilotoController } from '../controllers/copilotoController';

const router = Router();

router.get('/status', CopilotoController.status);
router.post('/session', CopilotoController.createSession);
router.get('/session/:id', CopilotoController.getSession);
router.post('/chat', CopilotoController.chat);

export default router;
