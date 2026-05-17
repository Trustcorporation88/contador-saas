/**
 * Backup Routes — Gerenciamento de backups do banco de dados
 * Todos os endpoints requerem autenticação + role admin
 *
 * GET    /admin/backups          — Listar backups e status do agendamento
 * POST   /admin/backups          — Executar backup manual imediato
 * DELETE /admin/backups/:filename — Remover backup específico
 * POST   /admin/backups/purge    — Purgar backups fora do período de retenção
 */

import { Router, Request, Response, NextFunction } from 'express';
import { BackupController } from '../controllers/backupController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/** Verificar se o usuário tem role admin */
function requireAdmin(req: Request, res: Response, next: NextFunction): Response | void {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado: requer role admin' });
  }
  return next();
}

router.use(authenticateToken, requireAdmin);

router.get   ('/',              BackupController.list);
router.post  ('/',              BackupController.create);
router.post  ('/purge',         BackupController.purge);
router.delete('/:filename',     BackupController.remove);

export default router;
