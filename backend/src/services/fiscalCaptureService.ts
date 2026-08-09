import { spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';
import { decryptSecret, encryptSecret, decryptSecretWithLegacyFallback } from '../utils/certEncryption';
import { assertPfxReadyToSave } from '../utils/pfxCertificate';

export type FiscalDocType = 'nfe' | 'nfse';

export interface FiscalCertificateRecord {
  id: string;
  company_id: string;
  cnpj: string;
  uf: string;
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
  // xml_path (caminho no filesystem do servidor) fica fora da resposta da API.
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

interface CaptureResultSummary {
  ok?: boolean;
  nfe_capturados?: number;
  nfse_capturados?: number;
  nfe_nsu?: string | null;
  nfse_nsu?: string | null;
  errors?: string[];
  warnings?: string[];
}

function parseCaptureResult(stdout: string): CaptureResultSummary | null {
  const line = stdout
    .split('\n')
    .map((l) => l.trim())
    .reverse()
    .find((l) => l.startsWith('CAPTURE_RESULT:'));
  if (!line) return null;
  try {
    return JSON.parse(line.replace('CAPTURE_RESULT:', '').trim()) as CaptureResultSummary;
  } catch {
    return null;
  }
}

function buildCaptureSuccessMessage(parsed: CaptureResultSummary): string {
  const nfe = Number(parsed.nfe_capturados || 0);
  const nfse = Number(parsed.nfse_capturados || 0);
  const total = nfe + nfse;
  if (total === 0) {
    return (
      'Captura concluída: nenhum XML novo na SEFAZ/Portal Nacional neste momento ' +
      `(NSU NF-e ${parsed.nfe_nsu ?? '0'}). ` +
      'Se a empresa emite/recebe notas, confira CNPJ/UF do certificado e se o A1 é o da empresa correta.'
    );
  }
  return `Captura concluída: ${nfe} NF-e e ${nfse} NFS-e novos.`;
}

function buildCaptureFields(
  result: { success: boolean; message: string },
  parsed: CaptureResultSummary,
): {
  success: boolean;
  nfe_capturados?: number;
  nfse_capturados?: number;
  nfe_nsu?: string | null;
  nfse_nsu?: string | null;
  warnings?: string[];
  message: string;
} {
  const failed = parsed.ok === false;
  return {
    success: result.success && !failed,
    nfe_capturados: parsed.nfe_capturados,
    nfse_capturados: parsed.nfse_capturados,
    nfe_nsu: parsed.nfe_nsu,
    nfse_nsu: parsed.nfse_nsu,
    warnings: parsed.warnings,
    message: failed
      ? (parsed.errors || []).join(' | ') || result.message
      : buildCaptureSuccessMessage(parsed),
  };
}

/**
 * Quais doc types de fato falharam na execução.
 *
 * Com `tipo=all`, marcar os dois como erro sempre que a execução falhava
 * sobrescrevia o status "ok" que o Python já havia gravado para o tipo que
 * funcionou — a tela mostrava NFS-e em erro depois de uma captura bem-sucedida.
 * O scheduler prefixa cada erro com "NF-e:" ou "NFS-e:", então dá para saber.
 */
function docTypesComFalha(
  tipo: 'nfe' | 'nfse' | 'all',
  parsed: CaptureResultSummary | null,
): Array<'nfe' | 'nfse'> {
  const solicitados: Array<'nfe' | 'nfse'> = tipo === 'all' ? ['nfe', 'nfse'] : [tipo];

  const erros = parsed?.errors;
  if (!Array.isArray(erros) || erros.length === 0) {
    // Sem resultado estruturado (ex.: processo morreu antes de imprimir
    // CAPTURE_RESULT): não há como distinguir, então marca todos os pedidos.
    return solicitados;
  }

  const comFalha = solicitados.filter((docType) => {
    const prefixo = docType === 'nfe' ? 'nf-e:' : 'nfs-e:';
    return erros.some((erro) => String(erro).trim().toLowerCase().startsWith(prefixo));
  });

  return comFalha.length > 0 ? comFalha : solicitados;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Garante que companyId é um UUID válido antes de usá-lo em caminhos de arquivo. */
function assertValidCompanyId(companyId: string): void {
  if (!UUID_RE.test(companyId)) {
    throw Object.assign(new Error('companyId inválido'), { status: 400 });
  }
}

async function materializePfxFile(
  companyId: string,
  pfxPath: string,
  pfxData: string | null | undefined,
  pfxBuffer?: Buffer,
): Promise<string> {
  const targetDir = path.dirname(pfxPath);
  // Chave privada da empresa: 0700 no diretório e 0600 no arquivo. O padrão
  // gravava o certificado legível por qualquer usuário do sistema.
  await fs.ensureDir(targetDir, { mode: 0o700 });

  const conteudo = pfxBuffer && pfxBuffer.length > 0
    ? pfxBuffer
    : (pfxData ? Buffer.from(pfxData, 'base64') : null);

  if (conteudo) {
    // Grava em arquivo temporário e renomeia: duas sincronizações simultâneas
    // da mesma empresa escreviam no mesmo caminho, e o Python podia abrir o
    // .pfx pela metade. O rename é atômico no mesmo filesystem.
    const temporario = `${pfxPath}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporario, conteudo, { mode: 0o600 });
      await fs.rename(temporario, pfxPath);
    } catch (error) {
      await fs.remove(temporario).catch(() => undefined);
      throw error;
    }
    return pfxPath;
  }

  const fallback = path.join(os.tmpdir(), 'fiscal-certs', `${companyId}.pfx`);
  if (await fs.pathExists(fallback)) {
    return fallback;
  }

  throw new Error('Certificado A1 não encontrado no servidor. Cadastre o .pfx novamente.');
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
    assertValidCompanyId(companyId);
    const db = await getDatabase();
    const certsDir = getCertsDir();

    const cnpj = onlyDigits(data.cnpj);
    const uf = data.uf.toLowerCase().slice(0, 2);

    // Busca CNPJ da empresa para cruzar com o certificado
    const company = await db('companies').where({ id: companyId }).first();
    const companyCnpj = company?.cnpj ? onlyDigits(String(company.cnpj)) : null;

    // Valida senha, validade e CNPJ ANTES de gravar qualquer coisa
    const parsed = assertPfxReadyToSave({
      pfxBuffer: data.pfxBuffer,
      password: data.password,
      informedCnpj: cnpj,
      companyCnpj,
    });

    const pfxPath = path.join(certsDir, `${companyId}.pfx`);
    const pfxDataB64 = data.pfxBuffer.toString('base64');

    try {
      await materializePfxFile(companyId, pfxPath, pfxDataB64, data.pfxBuffer);
    } catch (error) {
      logger.warn('Falha ao gravar .pfx em disco; mantendo cópia no banco', {
        companyId,
        error: (error as Error).message,
      });
    }

    const encryptedPassword = encryptSecret(data.password);
    // Certificado digital (chave privada) nunca deve ficar em texto claro no banco
    const encryptedPfxData = encryptSecret(pfxDataB64);
    const now = new Date();
    const existing = await db('fiscal_certificates').where({ company_id: companyId }).first();

    // Preferir validade lida do certificado; fallback ao valor enviado pelo cliente
    const certValidUntil = parsed.notAfter
      || (data.certValidUntil ? new Date(data.certValidUntil) : null);

    const row = {
      company_id: companyId,
      // CNPJ canônico = o do certificado (já validado)
      cnpj: parsed.subjectCnpj || cnpj,
      uf,
      pfx_path: pfxPath,
      pfx_data: encryptedPfxData,
      password_encrypted: encryptedPassword,
      cert_valid_until: certValidUntil,
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

    logger.info('Certificado A1 validado e salvo', {
      companyId,
      cnpj: row.cnpj,
      validUntil: certValidUntil?.toISOString(),
      daysUntilExpiry: parsed.daysUntilExpiry,
    });

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
  }> {
    assertValidCompanyId(companyId);
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

    const result = await this.spawnPython(scriptPath, [companyId], env);
    if (!result.success) {
      logger.warn('Reprocessamento de capturas fiscais falhou', {
        companyId,
        message: result.message,
        stdout: result.stdout?.slice(-2000),
        stderr: result.stderr?.slice(-2000),
      });
    }
    const { stdout: _stdout, stderr: _stderr, ...resposta } = result;
    return resposta;
  }

  static async runSync(companyId: string, tipo: 'nfe' | 'nfse' | 'all' = 'all'): Promise<{
    success: boolean;
    message: string;
    nfe_capturados?: number;
    nfse_capturados?: number;
    nfe_nsu?: string | null;
    nfse_nsu?: string | null;
    warnings?: string[];
  }> {
    assertValidCompanyId(companyId);
    const db = await getDatabase();
    const cert = await db('fiscal_certificates').where({ company_id: companyId, active: true }).first();
    if (!cert) {
      return { success: false, message: 'Certificado A1 não configurado para esta empresa.' };
    }

    const company = await db('companies').where({ id: companyId }).first();
    const companyCnpj = onlyDigits(String(company?.cnpj || ''));
    const certCnpj = onlyDigits(String(cert.cnpj || ''));
    if (companyCnpj && certCnpj && companyCnpj !== certCnpj) {
      return {
        success: false,
        message:
          `CNPJ do certificado (${certCnpj}) difere do CNPJ da empresa (${companyCnpj}). ` +
          'Substitua o certificado A1 com o CNPJ correto da empresa selecionada.',
      };
    }

    const password = decryptSecret(cert.password_encrypted);
    const automationDir = getAutomationDir();
    const schedulerPath = path.join(automationDir, 'scheduler.py');

    const pfxDataPlain = cert.pfx_data ? decryptSecretWithLegacyFallback(cert.pfx_data as string) : null;
    const pfxPath = await materializePfxFile(
      companyId,
      String(cert.pfx_path),
      pfxDataPlain,
    );

    if (!(await fs.pathExists(schedulerPath))) {
      return {
        success: false,
        message:
          'Captura automática indisponível neste servidor. Aguarde o próximo deploy ou contate o suporte.',
      };
    }

    // Este arquivo carrega a senha do certificado em texto claro: fica em um
    // diretório temporário só do processo (0700), com permissão 0600, e é
    // removido no finally — não no diretório da aplicação, onde sobreviveria a
    // uma falha no meio do caminho.
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fiscal-sync-'));
    const configPath = path.join(runtimeDir, `empresas-${randomUUID()}.json`);
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
    await fs.writeFile(configPath, JSON.stringify(empresaConfig), { mode: 0o600 });

    const env = {
      ...process.env,
      DATABASE_URL: envConfig.database.url,
      FISCAL_XML_ROOT: getXmlRoot(),
      FISCAL_CERTS_DIR: getCertsDir(),
    };

    let result: { success: boolean; message: string; stdout?: string; stderr?: string };
    try {
      result = await this.spawnPython(schedulerPath, [
        '--config',
        configPath,
        '--company-id',
        companyId,
        '--tipo',
        tipo,
      ], env);
    } finally {
      await fs.remove(runtimeDir).catch(() => undefined);
    }

    const parsed = parseCaptureResult(result.stdout || '');
    const combined = {
      ...result,
      ...(parsed ? buildCaptureFields(result, parsed) : {}),
    };

    // Fallback: stdout com "ERRO:" mesmo com exit 0 (scheduler antigo).
    if (combined.success && /ERRO:/i.test(result.stdout || '')) {
      combined.success = false;
      combined.message =
        (result.stdout || '')
          .split('\n')
          .filter((l) => /ERRO:/i.test(l))
          .join(' | ') || combined.message;
    }

    if (!combined.success) {
      const errText = combined.message || result.stderr || 'Falha na captura';
      const docTypes = docTypesComFalha(tipo, parsed);
      for (const docType of docTypes) {
        await db('fiscal_xml_sync')
          .insert({
            company_id: companyId,
            doc_type: docType,
            cursor_value: '0',
            last_sync_at: new Date(),
            last_status: 'error',
            last_error: errText,
          })
          .onConflict(['company_id', 'doc_type'])
          .merge({
            last_sync_at: new Date(),
            last_status: 'error',
            last_error: errText,
          });
      }
    }

    // stdout/stderr do Python carregam caminhos do servidor e stack traces:
    // ficam no log, não na resposta da API.
    if (!combined.success) {
      logger.warn('Captura fiscal falhou', {
        companyId,
        tipo,
        message: combined.message,
        stdout: result.stdout?.slice(-2000),
        stderr: result.stderr?.slice(-2000),
      });
    }
    const { stdout: _stdout, stderr: _stderr, ...resposta } = combined;
    return resposta;
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
    // Sem teto de tempo, uma consulta travada na SEFAZ deixava o processo filho
    // pendurado e a requisição HTTP aberta indefinidamente.
    const timeoutMs = Number(process.env.FISCAL_CAPTURE_TIMEOUT_MS) > 0
      ? Number(process.env.FISCAL_CAPTURE_TIMEOUT_MS)
      : 300_000;

    return new Promise((resolve) => {
      const child = spawn(python, commandArgs, {
        env,
        cwd: path.dirname(scriptPath),
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
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

      child.on('close', (code, signal) => {
        if (code === 0) {
          resolve({
            success: true,
            message: 'Captura concluída.',
            stdout,
            stderr,
          });
          return;
        }
        const expirou = signal === 'SIGKILL' || signal === 'SIGTERM';
        resolve({
          success: false,
          message: expirou
            ? `Captura interrompida após ${Math.round(timeoutMs / 1000)}s sem resposta da SEFAZ. Tente novamente.`
            : `Captura retornou código ${code}.`,
          stdout,
          stderr,
        });
      });
    });
  }

  /** Projeção segura para a API: sem pfx_path (caminho interno do servidor). */
  private static mapCertificate(row: Record<string, unknown>): FiscalCertificateRecord {
    return {
      id: String(row.id),
      company_id: String(row.company_id),
      cnpj: String(row.cnpj),
      uf: String(row.uf),
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
