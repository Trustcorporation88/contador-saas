import { Router } from 'express';
import { CopilotoController } from '../controllers/copilotoController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/status', CopilotoController.status);
router.post('/session', CopilotoController.createSession);
router.get('/session/:id', CopilotoController.getSession);
router.post('/chat', CopilotoController.chat);
router.get('/export/:id', CopilotoController.exportSessionPDF);
router.post('/export/:id/analysis', CopilotoController.exportAnalysisPDF);

export default router;
