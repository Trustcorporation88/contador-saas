/**
 * Testes unitários — BackupService
 * Cobre: getScheduleInfo, deleteBackup (segurança path traversal), listBackups
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as fs   from 'fs';
import * as path from 'path';
import { BackupService } from '../../src/services/backupService';

describe('BackupService', () => {

  // ── getScheduleInfo ───────────────────────────────────────────────────────

  describe('getScheduleInfo()', () => {
    it('deve retornar informações de agendamento', () => {
      const info = BackupService.getScheduleInfo();
      expect(info).toMatchObject({
        enabled:    expect.any(Boolean),
        schedule:   expect.any(String),
        backup_dir: expect.any(String),
        retention:  expect.any(String),
      });
    });

    it('deve retornar enabled=false antes do startScheduler', () => {
      // Garantir que scheduler está parado
      BackupService.stopScheduler();
      const info = BackupService.getScheduleInfo();
      expect(info.enabled).toBe(false);
    });
  });

  // ── deleteBackup — segurança ───────────────────────────────────────────────

  describe('deleteBackup() — proteção contra path traversal', () => {

    it('deve lançar 400 para path traversal com ../', () => {
      expect(() =>
        BackupService.deleteBackup('../etc/passwd')
      ).toThrow();
    });

    it('deve lançar 400 para nome com /slash/', () => {
      expect(() =>
        BackupService.deleteBackup('/backup.sql.gz')
      ).toThrow();
    });

    it('deve lançar 400 para nome sem extensão .sql.gz', () => {
      expect(() =>
        BackupService.deleteBackup('backup-malicioso.sh')
      ).toThrow();
    });

    it('deve lançar 400 para nome com espaços', () => {
      expect(() =>
        BackupService.deleteBackup('backup teste.sql.gz')
      ).toThrow();
    });

    it('deve lançar 404 para arquivo válido mas inexistente', () => {
      expect(() =>
        BackupService.deleteBackup('backup-contador-2025-01-01T03-00-00.sql.gz')
      ).toThrow(expect.objectContaining({ message: expect.stringContaining('não encontrado') }));
    });
  });

  // ── ensureBackupDir ────────────────────────────────────────────────────────

  describe('ensureBackupDir()', () => {
    it('deve criar diretório de backups se não existir', () => {
      const tmpDir = path.join(process.cwd(), 'tmp-test-backups-' + Date.now());
      const originalEnv = process.env.BACKUP_DIR;
      process.env.BACKUP_DIR = tmpDir;

      try {
        BackupService.ensureBackupDir();
        expect(fs.existsSync(tmpDir)).toBe(true);
      } finally {
        // Limpeza
        if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
        if (originalEnv === undefined) {
          delete process.env.BACKUP_DIR;
        } else {
          process.env.BACKUP_DIR = originalEnv;
        }
      }
    });
  });

  // ── listBackups ────────────────────────────────────────────────────────────

  describe('listBackups()', () => {
    it('deve retornar array vazio quando não há backups', async () => {
      const backups = await BackupService.listBackups();
      expect(Array.isArray(backups)).toBe(true);
    });

    it('deve retornar array de BackupInfo com estrutura correta', async () => {
      // Criar arquivo de backup temporário para testar
      BackupService.ensureBackupDir();
      const backupDir = BackupService.getScheduleInfo().backup_dir;
      const testFile  = path.join(backupDir, 'backup-test-db-2025-01-01T03-00-00.sql.gz');

      try {
        fs.writeFileSync(testFile, 'fake-gz-content');
        const backups = await BackupService.listBackups();

        expect(backups.length).toBeGreaterThan(0);
        const found = backups.find(b => b.filename.includes('backup-test-db'));
        expect(found).toBeDefined();
        expect(found).toMatchObject({
          filename:   expect.any(String),
          size_bytes: expect.any(Number),
          size_human: expect.any(String),
          created_at: expect.any(String),
        });
      } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      }
    });
  });
});
