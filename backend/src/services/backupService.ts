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
 * REQUISITOS DE AMBIENTE (os dois já quebraram este serviço em silêncio):
 *  - pg_dump precisa existir na imagem, com major IGUAL OU MAIOR que o do
 *    servidor. pg_dump recusa dump de servidor mais novo que ele.
 *  - O diretório de backup precisa estar em volume persistente. Em filesystem
 *    efêmero (Railway sem volume) o backup é apagado no deploy seguinte.
 * checkPgDump() valida o primeiro na subida e expõe o resultado em
 * getScheduleInfo(), para a falha não esperar as 03:00 para aparecer.
 */

// spawn, nunca exec: sem shell no caminho, a senha do banco não passa por argv
// e uma falha do pg_dump não pode ser mascarada pelo exit code do shell.
import { spawn }   from 'child_process';
import * as fs     from 'fs';
import * as path   from 'path';
import * as zlib   from 'zlib';
import cron        from 'node-cron';
import { logger }  from '../middleware/requestLogger';

// ─── Configuração ─────────────────────────────────────────────────────────────

/**
 * Default dentro de data/ porque é o diretório montado como volume persistente
 * (mesma convenção de data/fiscal-certs e data/fiscal-xmls). O default anterior
 * era process.cwd()/backups, FORA do volume: o backup morria a cada deploy.
 */
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
/** Lê BACKUP_DIR em runtime (não capturado no import) — permite override em testes. */
function getBackupDir(): string {
  return process.env.BACKUP_DIR ?? DEFAULT_BACKUP_DIR;
}
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

interface Connection {
  env:      NodeJS.ProcessEnv;
  database: string;
}

/**
 * Deriva a conexão do pg_dump a partir da DATABASE_URL — a única variável de
 * conexão que a aplicação realmente define (config/env.ts a exige).
 *
 * O código anterior lia DB_HOST/DB_NAME/DB_USER/DB_PASSWORD, que não existem em
 * nenhum ambiente deste projeto. Todos caíam no default, então o pg_dump tentava
 * localhost:5432/contador como usuário postgres sem senha — ou seja, o backup
 * não podia funcionar nem antes da migração para o Supabase.
 *
 * As credenciais vão por variável de ambiente, nunca por argumento: argv é
 * legível por qualquer processo do container via /proc.
 */
function resolveConnection(): Connection {
  const url = process.env.DATABASE_URL?.trim();

  // Fallback legado: só usado se alguém realmente definir as DB_*.
  if (!url) {
    if (!process.env.DB_HOST && !process.env.DB_NAME) {
      throw new Error(
        'DATABASE_URL não definida — impossível fazer backup. ' +
        'Defina DATABASE_URL (ou as variáveis DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD).',
      );
    }
    const database = process.env.DB_NAME ?? 'contador';
    return {
      database,
      env: {
        ...process.env,
        PGHOST:     process.env.DB_HOST     ?? 'localhost',
        PGPORT:     process.env.DB_PORT     ?? '5432',
        PGDATABASE: database,
        PGUSER:     process.env.DB_USER     ?? 'postgres',
        PGPASSWORD: process.env.DB_PASSWORD ?? '',
      },
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Caractere especial não codificado na senha invalida a URL inteira —
    // '#' e '@' são os casos que aparecem na prática.
    throw new Error(
      'DATABASE_URL malformada. Se a senha tem caractere especial (#, @, /, ?), ' +
      'ele precisa estar percent-encoded (# = %23, @ = %40).',
    );
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres';

  // sslmode explícito na URL vence; senão exige TLS fora de localhost, que é o
  // que Supabase e qualquer Postgres gerenciado esperam.
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  const sslmode = parsed.searchParams.get('sslmode')
    ?? (isLocal ? 'prefer' : 'require');

  return {
    database,
    env: {
      ...process.env,
      PGHOST:     parsed.hostname,
      PGPORT:     parsed.port || '5432',
      PGDATABASE: database,
      PGUSER:     decodeURIComponent(parsed.username),
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGSSLMODE:  sslmode,
    },
  };
}

/**
 * Executa pg_dump sem shell, gravando direto no arquivo via -f.
 *
 * O código anterior usava exec() com redirecionamento '> arquivo'. Com shell no
 * caminho, uma falha do pg_dump ainda criava o arquivo (vazio ou truncado) e o
 * exit code que chegava podia ser o do shell. Sem shell e com -f, falha é falha.
 */
function runPgDump(database: string, outFile: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pg_dump', [
      '--no-password',
      '--format=plain',
      '--clean',
      '--if-exists',
      '--file', outFile,
      database,
    ], { env, stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });

    child.on('error', err => {
      const message = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'pg_dump não encontrado no PATH. A imagem do backend precisa do pacote ' +
          'postgresql<major>-client (ver backend/Dockerfile).'
        : `Falha ao executar pg_dump: ${err.message}`;
      reject(new Error(message));
    });

    child.on('close', code => {
      if (code === 0) return resolve();
      const detail = stderr.trim().split('\n').slice(-3).join(' | ');
      // Mensagem própria do pg_dump quando o major do cliente é menor que o do servidor.
      if (/server version|version mismatch/i.test(stderr)) {
        return reject(new Error(
          'pg_dump é mais antigo que o servidor e recusou o dump. ' +
          `Atualize o postgresql-client na imagem. Detalhe: ${detail}`,
        ));
      }
      reject(new Error(`pg_dump falhou (exit ${code}): ${detail}`));
    });
  });
}

export interface PgDumpStatus {
  available: boolean;
  version?:  string;
  error?:    string;
}

/**
 * Verifica se o pg_dump existe e retorna a versão. Usado na subida e no /status.
 *
 * Usa spawn (sem shell) de propósito, com o mesmo env do dump real: assim o
 * preflight resolve o binário exatamente como runPgDump vai resolver. Com exec,
 * a resolução passa pelo shell e pode divergir do que o dump encontra.
 */
export function checkPgDump(): Promise<PgDumpStatus> {
  return new Promise(resolve => {
    const child = spawn('pg_dump', ['--version'], {
      env:   process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });

    child.on('error', err => {
      const message = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'pg_dump não encontrado no PATH — falta postgresql<major>-client na imagem.'
        : err.message;
      resolve({ available: false, error: message });
    });

    child.on('close', code => {
      if (code === 0) return resolve({ available: true, version: stdout.trim() });
      resolve({ available: false, error: stderr.trim() || `exit ${code}` });
    });
  });
}

// ─── Serviço de Backup ────────────────────────────────────────────────────────

/** Resultado do último preflight do pg_dump, exposto em getScheduleInfo(). */
let lastPgDumpStatus: PgDumpStatus | null = null;

export class BackupService {
  private static cronJob: cron.ScheduledTask | null = null;

  /** Garantir que o diretório de backups existe */
  static ensureBackupDir(): void {
    const dir = getBackupDir();
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
    const start = Date.now();
    const ts    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Resolver a conexão ANTES de montar os nomes de arquivo: o nome do banco
    // vem da DATABASE_URL, e uma URL ausente/malformada deve falhar aqui.
    let conn: Connection;
    try {
      conn = resolveConnection();
    } catch (error) {
      const message = (error as Error).message;
      logger.error('Backup falhou', { error: message });
      return { success: false, error: message, duration_ms: Date.now() - start };
    }

    const dbName   = conn.database;
    const filename = `backup-${dbName}-${ts}.sql.gz`;
    const filepath = path.join(getBackupDir(), filename);
    const tmpSql   = filepath.replace('.gz', '');

    BackupService.ensureBackupDir();

    try {
      // 1. Executar pg_dump para arquivo temporário .sql
      await runPgDump(dbName, tmpSql, conn.env);

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
    // Listagem não deve falhar por configuração ausente — só rotula os arquivos.
    let dbName: string;
    try {
      dbName = resolveConnection().database;
    } catch {
      dbName = 'desconhecido';
    }

    const files = fs.readdirSync(getBackupDir())
      .filter(f => f.endsWith('.sql.gz') && f.startsWith('backup-'))
      .map(filename => {
        const filepath = path.join(getBackupDir(), filename);
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
    const files  = fs.readdirSync(getBackupDir()).filter(f => f.endsWith('.sql.gz'));
    let removed  = 0;

    for (const file of files) {
      const filepath = path.join(getBackupDir(), file);
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
    if (!/^backup-[\w-]+\.sql\.gz$/.test(filename)) {
      throw Object.assign(new Error('Nome de arquivo inválido'), { status: 400 });
    }
    const filepath = path.join(getBackupDir(), filename);
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
    pg_dump?:   PgDumpStatus;
    } {
    return {
      enabled:    BackupService.cronJob !== null,
      schedule:   CRON_SCHEDULE,
      next_run:   BackupService.cronJob ? 'Agendado' : 'Não agendado',
      backup_dir: getBackupDir(),
      retention:  `${RETENTION_DAYS} dias`,
      // Resultado do preflight da subida. Sem isso, um pg_dump ausente só
      // aparecia no log das 03:00 — que foi como o problema passou meses.
      pg_dump:    lastPgDumpStatus ?? undefined,
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
      dir:       getBackupDir(),
    });

    // Preflight: não bloqueia a subida, mas grita agora em vez de falhar em
    // silêncio às 03:00. Também valida que a conexão é derivável.
    void checkPgDump().then(status => {
      lastPgDumpStatus = status;
      if (!status.available) {
        logger.error(
          'pg_dump AUSENTE — o backup automático vai falhar. ' +
          'Instale postgresql<major>-client na imagem do backend.',
          { error: status.error },
        );
        return;
      }
      try {
        const { database } = resolveConnection();
        logger.info('Preflight de backup OK', { pg_dump: status.version, database });
      } catch (error) {
        logger.error('pg_dump presente, mas a conexão de backup não é derivável', {
          error: (error as Error).message,
        });
      }
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
