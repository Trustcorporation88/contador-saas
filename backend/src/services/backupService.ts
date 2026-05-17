/**
 * Backup Service — Backup Automático PostgreSQL
 *
 * Executa pg_dump diariamente via node-cron e mantém um histórico
 * configurável de backups comprimidos (.sql.gz).
 *
 * Funcionalidades:
 *  - Backup diário agendado (padrão: 03:00)
 *  - Backup manual on-demand via API
 *  - Retenção configurável (padrão: 30 dias)
 *  - Verificação de integridade (tamanho mínimo)
 *  - Limpeza automática de backups antigos
 *
 * NOTA: Requer pg_dump instalado no servidor.
 * Para deploy em Docker, adicionar postgresql-client na imagem.
 */

import { exec }      from 'child_process';
import { promisify } from 'util';
import * as fs       from 'fs';
import * as path     from 'path';
import * as zlib     from 'zlib';
import cron          from 'node-cron';
import { logger }    from '../middleware/requestLogger';

const execAsync = promisify(exec);

// ─── Configuração ─────────────────────────────────────────────────────────────

const BACKUP_DIR      = process.env.BACKUP_DIR      ?? path.join(process.cwd(), 'backups');
const RETENTION_DAYS  = parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30');
const CRON_SCHEDULE   = process.env.BACKUP_CRON     ?? '0 3 * * *';  // 03:00 todo dia
const MIN_BACKUP_SIZE = 100; // bytes — sanity check para backup não vazio

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface BackupInfo {
  filename:    string;
  path:        string;
  size_bytes:  number;
  size_human:  string;
  created_at:  string;
  database:    string;
}

export interface BackupResult {
  success:     boolean;
  filename?:   string;
  path?:       string;
  size_bytes?: number;
  duration_ms: number;
  error?:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function buildConnectionEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST:     process.env.DB_HOST     ?? 'localhost',
    PGPORT:     process.env.DB_PORT     ?? '5432',
    PGDATABASE: process.env.DB_NAME     ?? 'contador',
    PGUSER:     process.env.DB_USER     ?? 'postgres',
    PGPASSWORD: process.env.DB_PASSWORD ?? '',
  };
}

// ─── Serviço de Backup ────────────────────────────────────────────────────────

export class BackupService {
  private static cronJob: cron.ScheduledTask | null = null;

  /** Garantir que o diretório de backups existe */
  static ensureBackupDir(): void {
    // Lê process.env em tempo de execução (permite override em testes)
    const dir = process.env.BACKUP_DIR ?? BACKUP_DIR;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('Diretório de backups criado', { path: dir });
    }
  }

  /**
   * Executar backup completo do banco de dados
   * Gera arquivo .sql.gz comprimido com timestamp
   */
  static async runBackup(): Promise<BackupResult> {
    const start    = Date.now();
    const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dbName   = process.env.DB_NAME ?? 'contador';
    const filename = `backup-${dbName}-${ts}.sql.gz`;
    const filepath = path.join(BACKUP_DIR, filename);
    const tmpSql   = filepath.replace('.gz', '');

    BackupService.ensureBackupDir();

    try {
      // 1. Executar pg_dump para arquivo temporário .sql
      const env = buildConnectionEnv();
      await execAsync(`pg_dump --no-password --format=plain --clean --if-exists "${dbName}"` +
        ` > "${tmpSql}"`, { env });

      // 2. Verificar que o arquivo não está vazio
      const sqlStat = fs.statSync(tmpSql);
      if (sqlStat.size < MIN_BACKUP_SIZE) {
        fs.unlinkSync(tmpSql);
        throw new Error('pg_dump gerou arquivo vazio — verifique as credenciais do banco');
      }

      // 3. Comprimir para .gz
      await new Promise<void>((resolve, reject) => {
        const input  = fs.createReadStream(tmpSql);
        const output = fs.createWriteStream(filepath);
        const gzip   = zlib.createGzip({ level: 9 });
        input.pipe(gzip).pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
      });

      // 4. Remover arquivo .sql temporário
      fs.unlinkSync(tmpSql);

      const stat    = fs.statSync(filepath);
      const elapsed = Date.now() - start;
      logger.info('Backup concluído', { filename, size: formatBytes(stat.size), elapsed_ms: elapsed });

      return {
        success:    true,
        filename,
        path:       filepath,
        size_bytes: stat.size,
        duration_ms: elapsed,
      };

    } catch (error) {
      // Limpar arquivos temporários em caso de erro
      if (fs.existsSync(tmpSql)) fs.unlinkSync(tmpSql);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

      const elapsed = Date.now() - start;
      const message = (error as Error).message;
      logger.error('Backup falhou', { error: message });
      return { success: false, error: message, duration_ms: elapsed };
    }
  }

  /**
   * Listar todos os backups disponíveis (ordenados por data, mais recente primeiro)
   */
  static async listBackups(): Promise<BackupInfo[]> {
    BackupService.ensureBackupDir();
    const dbName = process.env.DB_NAME ?? 'contador';

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql.gz') && f.startsWith('backup-'))
      .map(filename => {
        const filepath = path.join(BACKUP_DIR, filename);
        const stat     = fs.statSync(filepath);
        return {
          filename,
          path:        filepath,
          size_bytes:  stat.size,
          size_human:  formatBytes(stat.size),
          created_at:  stat.birthtime.toISOString(),
          database:    dbName,
        } as BackupInfo;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return files;
  }

  /**
   * Remover backups mais antigos que RETENTION_DAYS
   * Retorna quantidade de arquivos removidos
   */
  static async purgeOldBackups(): Promise<number> {
    BackupService.ensureBackupDir();
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files  = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql.gz'));
    let removed  = 0;

    for (const file of files) {
      const filepath = path.join(BACKUP_DIR, file);
      const stat     = fs.statSync(filepath);
      if (stat.birthtimeMs < cutoff) {
        fs.unlinkSync(filepath);
        removed++;
        logger.info('Backup antigo removido', { file });
      }
    }

    if (removed > 0) logger.info(`Purge: ${removed} backup(s) removido(s)`);
    return removed;
  }

  /**
   * Deletar um backup específico pelo filename
   */
  static deleteBackup(filename: string): boolean {
    // Segurança: apenas aceitar nomes de arquivo seguros (sem path traversal)
    if (!/^backup-[\w\-]+\.sql\.gz$/.test(filename)) {
      throw Object.assign(new Error('Nome de arquivo inválido'), { status: 400 });
    }
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
      throw Object.assign(new Error('Arquivo de backup não encontrado'), { status: 404 });
    }
    fs.unlinkSync(filepath);
    logger.info('Backup deletado manualmente', { filename });
    return true;
  }

  /** Status do agendamento de backups */
  static getScheduleInfo(): {
    enabled:    boolean;
    schedule:   string;
    next_run:   string;
    backup_dir: string;
    retention:  string;
  } {
    return {
      enabled:    BackupService.cronJob !== null,
      schedule:   CRON_SCHEDULE,
      next_run:   BackupService.cronJob ? 'Agendado' : 'Não agendado',
      backup_dir: BACKUP_DIR,
      retention:  `${RETENTION_DAYS} dias`,
    };
  }

  /**
   * Iniciar agendamento automático de backups
   * Chamado na inicialização da aplicação (src/app.ts ou index.ts)
   */
  static startScheduler(): void {
    if (BackupService.cronJob) {
      logger.warn('Scheduler de backup já está ativo');
      return;
    }

    if (!cron.validate(CRON_SCHEDULE)) {
      logger.error('CRON inválido para backup', { schedule: CRON_SCHEDULE });
      return;
    }

    BackupService.cronJob = cron.schedule(CRON_SCHEDULE, async () => {
      logger.info('Backup automático iniciado (agendado)');
      await BackupService.runBackup();
      await BackupService.purgeOldBackups();
    });

    logger.info('Backup automático agendado', {
      schedule:  CRON_SCHEDULE,
      retention: `${RETENTION_DAYS} dias`,
      dir:       BACKUP_DIR,
    });
  }

  /** Parar o agendamento (usado em testes ou shutdown) */
  static stopScheduler(): void {
    if (BackupService.cronJob) {
      BackupService.cronJob.stop();
      BackupService.cronJob = null;
      logger.info('Scheduler de backup parado');
    }
  }
}
