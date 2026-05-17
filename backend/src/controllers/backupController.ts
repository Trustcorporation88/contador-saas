/**
 * Backup Controller — Gerenciamento de backups via API REST
 * Endpoints protegidos (requerem role admin)
 */

import { Request, Response, NextFunction } from 'express';
import { BackupService } from '../services/backupService';
import { logger } from '../middleware/requestLogger';

export class BackupController {

  /** GET /admin/backups — Listar backups disponíveis */
  static async list(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const backups = await BackupService.listBackups();
      const schedule = BackupService.getScheduleInfo();
      return res.status(200).json({ schedule, backups });
    } catch (err) {
      return next(err);
    }
  }

  /** POST /admin/backups — Executar backup manual */
  static async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      logger.info('Backup manual solicitado', { userId: (req as any).user?.id });
      const result = await BackupService.runBackup();
      if (!result.success) {
        return res.status(500).json({ error: result.error, duration_ms: result.duration_ms });
      }
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  }

  /** DELETE /admin/backups/:filename — Remover um backup */
  static async remove(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { filename } = req.params;
      BackupService.deleteBackup(filename);
      return res.status(200).json({ message: 'Backup removido com sucesso', filename });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
      return next(err);
    }
  }

  /** POST /admin/backups/purge — Purgar backups antigos (fora da retenção) */
  static async purge(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const removed = await BackupService.purgeOldBackups();
      return res.status(200).json({ message: `${removed} backup(s) removido(s)`, removed });
    } catch (err) {
      return next(err);
    }
  }
}
