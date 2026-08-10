/**
 * Teste de integração — BackupService contra um PostgreSQL real.
 *
 * Existe porque o backup ficou quebrado sem ninguém notar: faltava o pg_dump na
 * imagem E a conexão era derivada de variáveis (DB_HOST/DB_NAME/DB_USER/
 * DB_PASSWORD) que este projeto nunca define — só DATABASE_URL existe. Teste
 * unitário com mock não pegaria nenhum dos dois: o valor está em dumpar e
 * RESTAURAR de verdade, conferindo os dados.
 *
 * Precisa de um banco real. Defina BACKUP_TEST_DATABASE_URL para rodar:
 *   BACKUP_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/db npx jest
 *
 * Variável própria de propósito: tests/env-setup.ts sobrescreve DATABASE_URL
 * com um valor fake, então a DATABASE_URL do ambiente não chega até aqui.
 *
 * O restore roda em banco descartável (DROP/CREATE), nunca no banco de origem.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as fs   from 'fs';
import * as os   from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const TEST_URL     = process.env.BACKUP_TEST_DATABASE_URL;
const RESTORE_DB   = 'backup_restore_check';
const hasLiveDb    = Boolean(TEST_URL);
const describeLive = hasLiveDb ? describe : describe.skip;

let backupDir: string;

/** psql sem shell, com a senha via env — mesma disciplina do serviço. */
function psql(url: string, args: string[]): string {
  return execFileSync('psql', [url, ...args], { encoding: 'utf8' }).trim();
}

function query(url: string, sql: string): string {
  return psql(url, ['-tAc', sql]);
}

function loadBackupService() {
  jest.resetModules();
  process.env.BACKUP_DIR = backupDir;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/services/backupService');
}

beforeEach(() => {
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
});

afterEach(() => {
  fs.rmSync(backupDir, { recursive: true, force: true });
});

if (!hasLiveDb) {
  // eslint-disable-next-line no-console
  console.warn(
    '[backupService.integration] BACKUP_TEST_DATABASE_URL não definida — ' +
    'os testes de dump/restore foram pulados.',
  );
}

// ── Erros de configuração: não precisam de banco ────────────────────────────

describe('BackupService — configuração inválida falha com mensagem acionável', () => {

  it('sem DATABASE_URL, diz qual variável falta em vez de tentar localhost', async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_NAME;
    try {
      const { BackupService } = loadBackupService();
      const result = await BackupService.runBackup();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/DATABASE_URL não definida/);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  it('senha com caractere especial sem percent-encode: explica o encode', async () => {
    const original = process.env.DATABASE_URL;
    // '#' não codificado invalida a URL inteira — caso real de senha gerada.
    process.env.DATABASE_URL = 'postgresql://user:senha#quebrada@host:5432/db';
    try {
      const { BackupService } = loadBackupService();
      const result = await BackupService.runBackup();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/percent-encoded/);
      expect(result.error).toMatch(/%23/);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  it('pg_dump ausente do PATH: aponta o pacote que falta na imagem', async () => {
    const originalPath = process.env.PATH;
    const originalUrl  = process.env.DATABASE_URL;
    process.env.PATH = path.join(os.tmpdir(), 'sem-pg-dump-aqui');
    process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/qualquer';
    try {
      const { BackupService } = loadBackupService();
      const result = await BackupService.runBackup();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/pg_dump não encontrado no PATH/);
      expect(result.error).toMatch(/client/);
    } finally {
      process.env.PATH = originalPath;
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('checkPgDump() reporta indisponibilidade sem lançar', async () => {
    const originalPath = process.env.PATH;
    process.env.PATH = path.join(os.tmpdir(), 'sem-pg-dump-aqui');
    try {
      const { checkPgDump } = loadBackupService();
      const status = await checkPgDump();
      expect(status.available).toBe(false);
      expect(status.error).toBeTruthy();
    } finally {
      process.env.PATH = originalPath;
    }
  });
});

// ── Dump e restore reais ────────────────────────────────────────────────────

describeLive('BackupService — dump e restore contra banco real', () => {

  beforeEach(() => {
    process.env.DATABASE_URL = TEST_URL as string;
  });

  it('checkPgDump() encontra o binário e retorna a versão', async () => {
    const { checkPgDump } = loadBackupService();
    const status = await checkPgDump();
    expect(status.available).toBe(true);
    expect(status.version).toMatch(/pg_dump/);
  });

  it('gera um dump não-vazio derivando a conexão da DATABASE_URL', async () => {
    const { BackupService } = loadBackupService();
    const result = await BackupService.runBackup();

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    // Nome do banco vem da URL, não de um default hardcoded.
    const dbName = new URL(TEST_URL as string).pathname.replace(/^\//, '');
    expect(result.filename).toContain(`backup-${dbName}-`);
    expect(result.size_bytes).toBeGreaterThan(500);
    expect(fs.existsSync(result.path as string)).toBe(true);
  }, 60000);

  it('não deixa o .sql intermediário no diretório', async () => {
    const { BackupService } = loadBackupService();
    await BackupService.runBackup();
    const leftovers = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
    expect(leftovers).toEqual([]);
  }, 60000);

  it('o dump restaura em banco limpo e os dados conferem', async () => {
    const { BackupService } = loadBackupService();
    const result = await BackupService.runBackup();
    expect(result.success).toBe(true);

    const source  = new URL(TEST_URL as string);
    const adminUrl = new URL(TEST_URL as string);
    adminUrl.pathname = '/postgres';

    // Banco descartável para o restore — nunca toca o banco de origem.
    psql(adminUrl.toString(), ['-q', '-c', `DROP DATABASE IF EXISTS ${RESTORE_DB};`]);
    psql(adminUrl.toString(), ['-q', '-c', `CREATE DATABASE ${RESTORE_DB};`]);

    const restoreUrl = new URL(TEST_URL as string);
    restoreUrl.pathname = `/${RESTORE_DB}`;

    const plainSql = path.join(backupDir, 'restore.sql');
    fs.writeFileSync(plainSql, require('zlib').gunzipSync(fs.readFileSync(result.path as string)));

    try {
      // ON_ERROR_STOP: um restore que loga erro e segue não é um restore.
      psql(restoreUrl.toString(), ['-q', '-v', 'ON_ERROR_STOP=1', '-f', plainSql]);

      // Compara o que importa num sistema contábil: as tabelas presentes e,
      // para cada uma, a contagem de linhas.
      const tableList =
        "SELECT string_agg(tablename, ',' ORDER BY tablename) " +
        "FROM pg_tables WHERE schemaname = 'public'";
      const sourceTables  = query(source.toString(), tableList);
      const restoredTables = query(restoreUrl.toString(), tableList);
      expect(restoredTables).toBe(sourceTables);
      expect(sourceTables.length).toBeGreaterThan(0);

      for (const table of sourceTables.split(',')) {
        const countSql = `SELECT count(*) FROM "${table}"`;
        expect(query(restoreUrl.toString(), countSql))
          .toBe(query(source.toString(), countSql));
      }
    } finally {
      psql(adminUrl.toString(), ['-q', '-c', `DROP DATABASE IF EXISTS ${RESTORE_DB};`]);
    }
  }, 120000);

  it('getScheduleInfo() expõe o status do pg_dump depois do preflight', async () => {
    const { BackupService } = loadBackupService();
    BackupService.startScheduler();
    // O preflight é assíncrono e deliberadamente não bloqueia a subida.
    await new Promise(resolve => setTimeout(resolve, 500));
    const info = BackupService.getScheduleInfo();
    BackupService.stopScheduler();

    expect(info.backup_dir).toBe(backupDir);
    expect(info.pg_dump?.available).toBe(true);
  }, 30000);
});
