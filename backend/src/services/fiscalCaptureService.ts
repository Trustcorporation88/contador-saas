import { spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';
import { decryptSecret, encryptSecret } from '../utils/certEncryption';
import { materializePfxResilient } from '../utils/pfxMaterialize';

export type FiscalDocType = 'nfe' | 'nfse';

export interface FiscalCertificateRecord {
  id: string;
  company_id: string;
  cnpj: string;
  uf: string;
  pfx_path: string;
  cert_valid_until: string | null;
  serpro_motor_enabled: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalSyncStatus {
  doc_type: FiscalDocType;
  cursor_value: string;
  last_sync_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

export interface FiscalCaptureRecord {
  id: string;
  company_id: string;
  doc_type: string;
  chave: string;
  direcao: string | null;
  xml_path: string;
  emitente_cnpj: string | null;
  destinatario_cnpj: string | null;
  valor_total: string | null;
  data_emissao: string | null;
  modelo: string | null;
  numero: string | null;
  serie: string | null;
  captured_at: string;
}

function getCertsDir(): string {
  if (process.env.FISCAL_CERTS_DIR) {
    return process.env.FISCAL_CERTS_DIR;
  }
  if (process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), 'fiscal-certs');
  }
  return path.join(process.cwd(), 'data', 'fiscal-certs');
}

function getXmlRoot(): string {
  if (process.env.FISCAL_XML_ROOT) {
    return process.env.FISCAL_XML_ROOT;
  }
  if (process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), 'fiscal-xmls');
  }
  return path.join(process.cwd(), 'data', 'fiscal-xmls');
}

function getAutomationDir(): string {
  if (process.env.FISCAL_AUTOMATION_DIR) {
    return process.env.FISCAL_AUTOMATION_DIR;
  }
  const candidates = [
    '/app/automacao-xml',
    path.join(process.cwd(), 'automacao-xml'),
    path.join(process.cwd(), '..', 'automacao-xml'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'scheduler.py'))) {
      return candidate;
    }
  }
  return path.join(process.cwd(), '..', 'automacao-xml');
}

function getPythonBin(): string {
  return process.env.PYTHON_BIN || (process.env.NODE_ENV === 'production' ? 'python3' : 'python');
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

async function materializePfxFile(
  companyId: string,
  pfxPath: string,
  pfxData: string | null | undefined,
  pfxBuffer?: Buffer,
): Promise<string> {
  return materializePfxResilient({
    companyId,
    preferredPath: pfxPath,
    pfxData,
    pfxBuffer,
    existingPath: pfxPath,
  });
}

export class FiscalCaptureService {
  static async upsertCertificate(
    companyId: string,
    data: {
      cnpj: string;
      uf: string;
      password: string;
      pfxBuffer: Buffer;
      serproMotor?: boolean;
      certValidUntil?: string | null;
    },
  ): Promise<FiscalCertificateRecord> {
    const db = await getDatabase();
    const certsDir = getCertsDir();

    const cnpj = onlyDigits(data.cnpj);
    const uf = data.uf.toLowerCase().slice(0, 2);
    const pfxPath = path.join(certsDir, `${companyId}.pfx`);
    const pfxDataB64 = data.pfxBuffer.toString('base64');

    const company = await db('companies').where({ id: companyId }).first();
    if (company) {
      const companyCnpj = onlyDigits(String(company.cnpj || ''));
      if (companyCnpj && companyCnpj !== cnpj) {
        throw Object.assign(
          new Error(
            `CNPJ do certificado (${cnpj}) difere do CNPJ da empresa (${companyCnpj}). ` +
              'Use o .pfx emitido para esta empresa.',
          ),
          { status: 422 },
        );
      }
    }

    let savedPath = pfxPath;
    try {
      savedPath = await materializePfxFile(companyId, pfxPath, pfxDataB64, data.pfxBuffer);
    } catch (error) {
      logger.warn('Falha ao gravar .pfx em disco; mantendo cópia no banco', {
        companyId,
        error: (error as Error).message,
      });
    }

    const encryptedPassword = encryptSecret(data.password);
    const now = new Date();
    const existing = await db('fiscal_certificates').where({ company_id: companyId }).first();

    const row = {
      company_id: companyId,
      cnpj,
      uf,
      pfx_path: savedPath,
      pfx_data: pfxDataB64,
      password_encrypted: encryptedPassword,
      cert_valid_until: data.certValidUntil ? new Date(data.certValidUntil) : null,
      serpro_motor_enabled: Boolean(data.serproMotor),
      active: true,
      updated_at: now,
    };

    if (existing) {
      await db('fiscal_certificates').where({ company_id: companyId }).update(row);
    } else {
      await db('fiscal_certificates').insert({
        id: randomUUID(),
        ...row,
        created_at: now,
      });
    }

    const saved = await db('fiscal_certificates').where({ company_id: companyId }).first();
    return this.mapCertificate(saved);
  }

  static async getCertificate(companyId: string): Promise<(FiscalCertificateRecord & { has_password: boolean }) | null> {
    const db = await getDatabase();
    const row = await db('fiscal_certificates').where({ company_id: companyId, active: true }).first();
    if (!row) return null;
    return {
      ...this.mapCertificate(row),
      has_password: Boolean(row.password_encrypted),
    };
  }

  static async getStatus(companyId: string): Promise<{
    certificate: (FiscalCertificateRecord & { has_password: boolean }) | null;
    sync: FiscalSyncStatus[];
    captures_total: number;
    python_available: boolean;
  }> {
    const db = await getDatabase();
    const certificate = await this.getCertificate(companyId);
    const syncRows = await db('fiscal_xml_sync').where({ company_id: companyId });
    const [{ count }] = await db('fiscal_xml_captures')
      .where({ company_id: companyId })
      .count<{ count: string }[]>('id as count');

    return {
      certificate,
      sync: syncRows.map((row) => ({
        doc_type: row.doc_type,
        cursor_value: row.cursor_value,
        last_sync_at: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
        last_status: row.last_status,
        last_error: row.last_error,
      })),
      captures_total: Number(count || 0),
      python_available: await this.isPythonAvailable(),
    };
  }

  static async listCaptures(
    companyId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: FiscalCaptureRecord[]; total: number; page: number; limit: number }> {
    const db = await getDatabase();
    const offset = (page - 1) * limit;

    const base = db('fiscal_xml_captures').where({ company_id: companyId });
    const [{ count }] = await base.clone().count<{ count: string }[]>('id as count');
    const rows = await base
      .orderBy('captured_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map((row) => ({
        id: row.id,
        company_id: row.company_id,
        doc_type: row.doc_type,
        chave: row.chave,
        direcao: row.direcao,
        xml_path: row.xml_path,
        emitente_cnpj: row.emitente_cnpj,
        destinatario_cnpj: row.destinatario_cnpj,
        valor_total: row.valor_total,
        data_emissao: row.data_emissao,
        modelo: row.modelo,
        numero: row.numero,
        serie: row.serie,
        captured_at: new Date(row.captured_at).toISOString(),
      })),
      total: Number(count || 0),
      page,
      limit,
    };
  }

  static async runReprocess(companyId: string): Promise<{
    success: boolean;
    message: string;
    stdout?: string;
    stderr?: string;
  }> {
    const automationDir = getAutomationDir();
    const scriptCandidates = [
      path.join(automationDir, 'maintenance', 'reprocess_captures.py'),
      path.join(automationDir, 'scripts', 'reprocess_captures.py'),
    ];
    const scriptPath = scriptCandidates.find((candidate) => fs.existsSync(candidate));

    if (!scriptPath) {
      return {
        success: false,
        message:
          'Reprocessamento indisponível neste servidor. Aguarde o próximo deploy ou contate o suporte.',
      };
    }

    const env = {
      ...process.env,
      DATABASE_URL: envConfig.database.url,
      FISCAL_XML_ROOT: getXmlRoot(),
      FISCAL_CERTS_DIR: getCertsDir(),
    };

    return this.spawnPython(scriptPath, [companyId], env);
  }

  static async runSync(companyId: string, tipo: 'nfe' | 'nfse' | 'all' = 'all'): Promise<{
    success: boolean;
    message: string;
    stdout?: string;
    stderr?: string;
  }> {
    const db = await getDatabase();
    const cert = await db('fiscal_certificates').where({ company_id: companyId, active: true }).first();
    if (!cert) {
      return { success: false, message: 'Certificado A1 não configurado para esta empresa.' };
    }

    const password = decryptSecret(cert.password_encrypted);
    const automationDir = getAutomationDir();
    const schedulerPath = path.join(automationDir, 'scheduler.py');

    const pfxPath = await materializePfxFile(
      companyId,
      String(cert.pfx_path),
      cert.pfx_data as string | null | undefined,
    );

    if (!(await fs.pathExists(schedulerPath))) {
      return {
        success: false,
        message:
          'Captura automática indisponível neste servidor. Aguarde o próximo deploy ou contate o suporte.',
      };
    }

    const configPath = path.join(automationDir, `.runtime-${companyId}.json`);
    const empresaConfig = [
      {
        company_id: companyId,
        cnpj: cert.cnpj,
        uf: cert.uf,
        pfx: pfxPath,
        senha: password,
        serpro_motor: Boolean(cert.serpro_motor_enabled),
      },
    ];
    await fs.writeJson(configPath, empresaConfig, { spaces: 2 });

    const env = {
      ...process.env,
      DATABASE_URL: envConfig.database.url,
      FISCAL_XML_ROOT: getXmlRoot(),
      FISCAL_CERTS_DIR: getCertsDir(),
    };

    const result = await this.spawnPython(schedulerPath, [
      '--config',
      configPath,
      '--company-id',
      companyId,
      '--tipo',
      tipo,
    ], env);

    await fs.remove(configPath).catch(() => undefined);

    if (!result.success) {
      await db('fiscal_xml_sync')
        .insert({
          company_id: companyId,
          doc_type: tipo === 'all' ? 'nfe' : tipo,
          cursor_value: '0',
          last_sync_at: new Date(),
          last_status: 'error',
          last_error: result.stderr || result.message,
        })
        .onConflict(['company_id', 'doc_type'])
        .merge({
          last_sync_at: new Date(),
          last_status: 'error',
          last_error: result.stderr || result.message,
        });
    }

    return result;
  }

  private static async isPythonAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(getPythonBin(), ['--version']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
  }

  private static spawnPython(
    scriptPath: string,
    args: string[],
    env: NodeJS.ProcessEnv,
  ): Promise<{ success: boolean; message: string; stdout?: string; stderr?: string }> {
    const python = getPythonBin();
    const commandArgs = [scriptPath, ...args];

    return new Promise((resolve) => {
      const child = spawn(python, commandArgs, {
        env,
        cwd: path.dirname(scriptPath),
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          message: `Falha ao executar Python (${python}): ${error.message}`,
          stderr: error.message,
        });
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: 'Captura concluída.',
            stdout,
            stderr,
          });
        } else {
          resolve({
            success: false,
            message: `Captura retornou código ${code}.`,
            stdout,
            stderr,
          });
        }
      });
    });
  }

  private static mapCertificate(row: Record<string, unknown>): FiscalCertificateRecord {
    return {
      id: String(row.id),
      company_id: String(row.company_id),
      cnpj: String(row.cnpj),
      uf: String(row.uf),
      pfx_path: String(row.pfx_path),
      cert_valid_until: row.cert_valid_until
        ? new Date(row.cert_valid_until as string | Date).toISOString()
        : null,
      serpro_motor_enabled: Boolean(row.serpro_motor_enabled),
      active: Boolean(row.active),
      created_at: new Date(row.created_at as string | Date).toISOString(),
      updated_at: new Date(row.updated_at as string | Date).toISOString(),
    };
  }
}
