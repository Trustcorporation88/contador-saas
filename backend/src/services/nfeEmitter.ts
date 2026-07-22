/**
 * NF-e Emitter — ponte Node → Python (pynfe)
 *
 * Materializa o certificado A1 da empresa, monta o payload JSON da nota,
 * executa `automacao-xml/emitir_nfe.py` (assina + transmite à SEFAZ) e
 * interpreta o resultado.
 *
 * SEGURANÇA: ambiente padrão = "homologacao". Produção só quando
 * NFE_AMBIENTE=producao explicitamente.
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';
import { decryptSecret } from '../utils/certEncryption';

export interface NfeEmissionResult {
  ok: boolean;
  ambiente: string;
  cStat: string;
  motivo: string;
  protocolo: string;
  chave: string;
  dhRecbto?: string;
  xml_proc?: string;
  raw?: string;
}

function getAmbiente(): 'homologacao' | 'producao' {
  return String(process.env.NFE_AMBIENTE || 'homologacao').toLowerCase() === 'producao'
    ? 'producao'
    : 'homologacao';
}

/** Modo de emissão: 'real' usa pynfe/SEFAZ; 'mock' mantém o simulador. */
export function getEmissionMode(): 'real' | 'mock' {
  return String(process.env.NFE_EMISSION_MODE || 'real').toLowerCase() === 'mock'
    ? 'mock'
    : 'real';
}

function getCertsDir(): string {
  if (process.env.FISCAL_CERTS_DIR) return process.env.FISCAL_CERTS_DIR;
  if (process.env.NODE_ENV === 'production') return path.join(os.tmpdir(), 'fiscal-certs');
  return path.join(process.cwd(), 'data', 'fiscal-certs');
}

function getAutomationDir(): string {
  if (process.env.FISCAL_AUTOMATION_DIR) return process.env.FISCAL_AUTOMATION_DIR;
  const candidates = [
    '/app/automacao-xml',
    path.join(process.cwd(), 'automacao-xml'),
    path.join(process.cwd(), '..', 'automacao-xml'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'emitir_nfe.py'))) return candidate;
  }
  return path.join(process.cwd(), '..', 'automacao-xml');
}

function getPythonBin(): string {
  return process.env.PYTHON_BIN || (process.env.NODE_ENV === 'production' ? 'python3' : 'python');
}

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** CRT a partir do regime tributário da empresa. */
function crtFromRegime(taxRegime: string | null | undefined, explicit?: string | null): string {
  if (explicit) return String(explicit);
  const r = String(taxRegime || '').toLowerCase();
  if (r === 'simples_nacional' || r === 'simples') return '1';
  return '3'; // Lucro Real / Presumido → Regime Normal
}

async function materializePfx(
  companyId: string,
  pfxPath: string,
  pfxData: string | null | undefined,
): Promise<string> {
  if (pfxData) {
    const target = path.join(getCertsDir(), `${companyId}.pfx`);
    await fs.ensureDir(path.dirname(target));
    await fs.writeFile(target, Buffer.from(pfxData, 'base64'));
    return target;
  }
  if (pfxPath && (await fs.pathExists(pfxPath))) return pfxPath;
  const fallback = path.join(os.tmpdir(), 'fiscal-certs', `${companyId}.pfx`);
  if (await fs.pathExists(fallback)) return fallback;
  throw Object.assign(
    new Error('Certificado digital A1 não encontrado. Cadastre o .pfx da empresa em Captura Fiscal.'),
    { status: 422 },
  );
}

interface CompanyRow {
  id: string;
  cnpj?: string;
  legal_name?: string;
  trade_name?: string;
  phone?: string;
  address?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  codigo_municipio?: string;
  inscricao_estadual?: string;
  crt?: string;
  tax_regime?: string;
}

interface NfeRow {
  numero: number;
  serie: number;
  modelo: number;
  natureza_operacao: string;
  dest_cpf_cnpj: string;
  dest_razao_social: string;
  dest_email?: string;
  dest_endereco?: string;
  valor_frete?: number | string;
  valor_desconto?: number | string;
  informacoes_adicionais?: string;
}

interface NfeItemRow {
  codigo_produto: string;
  descricao: string;
  ncm?: string;
  cfop: string;
  unidade?: string;
  quantidade: number | string;
  valor_unitario: number | string;
  cst_icms?: string;
  aliquota_icms?: number | string;
  aliquota_pis?: number | string;
  aliquota_cofins?: number | string;
}

function validarEmitente(company: CompanyRow): void {
  const faltando: string[] = [];
  if (!digits(company.cnpj)) faltando.push('CNPJ');
  if (!company.legal_name) faltando.push('razão social');
  if (!company.address) faltando.push('logradouro');
  if (!company.endereco_bairro) faltando.push('bairro');
  if (!company.city) faltando.push('município');
  if (!company.state) faltando.push('UF');
  if (!digits(company.postal_code)) faltando.push('CEP');
  if (!digits(company.codigo_municipio)) faltando.push('código IBGE do município');
  if (faltando.length > 0) {
    throw Object.assign(
      new Error(
        `Cadastro fiscal da empresa incompleto para emissão de NF-e. Preencha: ${faltando.join(', ')}.`,
      ),
      { status: 422 },
    );
  }
}

function buildPayload(
  company: CompanyRow,
  nfe: NfeRow,
  itens: NfeItemRow[],
  ambiente: string,
  certPath: string,
  certSenha: string,
): Record<string, unknown> {
  const crt = crtFromRegime(company.tax_regime, company.crt);
  const simples = crt === '1';

  let dest: Record<string, unknown> = {};
  if (nfe.dest_endereco) {
    try {
      dest = JSON.parse(nfe.dest_endereco);
    } catch {
      dest = {};
    }
  }
  const destEndereco = (dest.endereco as Record<string, unknown>) || {};

  return {
    ambiente,
    modelo: nfe.modelo,
    numero: nfe.numero,
    serie: nfe.serie,
    natureza_operacao: nfe.natureza_operacao || 'VENDA',
    cert_path: certPath,
    cert_senha: certSenha,
    frete: Number(nfe.valor_frete ?? 0),
    desconto: Number(nfe.valor_desconto ?? 0),
    info_adicional: nfe.informacoes_adicionais || '',
    forma_pagamento: '01',
    emitente: {
      cnpj: digits(company.cnpj),
      razao_social: company.legal_name,
      nome_fantasia: company.trade_name || company.legal_name,
      crt,
      inscricao_estadual: company.inscricao_estadual || '',
      logradouro: company.address,
      numero: company.endereco_numero || 'S/N',
      bairro: company.endereco_bairro,
      municipio: company.city,
      cod_municipio: digits(company.codigo_municipio),
      uf: company.state,
      cep: digits(company.postal_code),
      telefone: digits(company.phone),
    },
    destinatario: {
      numero_documento: digits(nfe.dest_cpf_cnpj),
      razao_social: nfe.dest_razao_social,
      email: nfe.dest_email || '',
      indicador_ie: Number(dest.indicador_ie ?? 9),
      inscricao_estadual: dest.inscricao_estadual || '',
      logradouro: destEndereco.logradouro || 'NAO INFORMADO',
      numero: destEndereco.numero || 'S/N',
      bairro: destEndereco.bairro || 'NAO INFORMADO',
      municipio: destEndereco.municipio || company.city,
      cod_municipio: digits(destEndereco.cod_municipio) || digits(company.codigo_municipio),
      uf: (destEndereco.uf as string) || company.state,
      cep: digits(destEndereco.cep) || digits(company.postal_code),
    },
    itens: itens.map((it) => ({
      codigo: it.codigo_produto,
      descricao: it.descricao,
      ncm: digits(it.ncm).slice(0, 8),
      cfop: digits(it.cfop).slice(0, 4),
      unidade: it.unidade || 'UN',
      quantidade: Number(it.quantidade),
      valor_unitario: Number(it.valor_unitario),
      icms_modalidade: simples ? '102' : it.cst_icms || '00',
      icms_origem: 0,
      icms_aliquota: Number(it.aliquota_icms ?? 0),
      pis_aliquota: Number(it.aliquota_pis ?? 0),
      cofins_aliquota: Number(it.aliquota_cofins ?? 0),
    })),
  };
}

function spawnEmitir(payloadFile: string): Promise<NfeEmissionResult> {
  const automationDir = getAutomationDir();
  const scriptPath = path.join(automationDir, 'emitir_nfe.py');
  const python = getPythonBin();

  return new Promise((resolve) => {
    const child = spawn(python, [scriptPath, payloadFile], {
      cwd: automationDir,
      env: {
        ...process.env,
        DATABASE_URL: envConfig.database.url,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));

    child.on('error', (error) => {
      resolve({
        ok: false,
        ambiente: getAmbiente(),
        cStat: '',
        motivo: `Falha ao executar o motor de emissão (${python}): ${error.message}`,
        protocolo: '',
        chave: '',
      });
    });

    child.on('close', () => {
      const line = stdout.split('\n').find((l) => l.startsWith('NFE_RESULT:'));
      if (!line) {
        resolve({
          ok: false,
          ambiente: getAmbiente(),
          cStat: '',
          motivo: 'Motor de emissão não retornou resultado. ' + (stderr.slice(-400) || ''),
          protocolo: '',
          chave: '',
        });
        return;
      }
      try {
        const parsed = JSON.parse(line.replace('NFE_RESULT:', '').trim());
        resolve({
          ok: Boolean(parsed.ok),
          ambiente: parsed.ambiente || getAmbiente(),
          cStat: parsed.cStat || '',
          motivo: parsed.motivo || '',
          protocolo: parsed.protocolo || '',
          chave: parsed.chave || '',
          dhRecbto: parsed.dhRecbto,
          xml_proc: parsed.xml_proc,
          raw: parsed.raw,
        });
      } catch (e) {
        resolve({
          ok: false,
          ambiente: getAmbiente(),
          cStat: '',
          motivo: 'Resposta inválida do motor de emissão: ' + (e as Error).message,
          protocolo: '',
          chave: '',
        });
      }
    });
  });
}

/**
 * Emite uma NF-e real: assina com o A1 e transmite à SEFAZ.
 * @returns resultado da autorização (cStat 100/150 = autorizada).
 */
export async function emitirNfeReal(
  company: CompanyRow,
  nfe: NfeRow,
  itens: NfeItemRow[],
): Promise<NfeEmissionResult> {
  const db = await getDatabase();
  const ambiente = getAmbiente();

  validarEmitente(company);

  const cert = await db('fiscal_certificates')
    .where({ company_id: company.id, active: true })
    .first();
  if (!cert) {
    throw Object.assign(
      new Error('Certificado digital A1 não configurado. Cadastre o .pfx em Captura Fiscal.'),
      { status: 422 },
    );
  }

  const certSenha = decryptSecret(cert.password_encrypted);
  const certPath = await materializePfx(
    company.id,
    String(cert.pfx_path || ''),
    cert.pfx_data as string | null | undefined,
  );

  const payload = buildPayload(company, nfe, itens, ambiente, certPath, certSenha);

  const payloadFile = path.join(os.tmpdir(), `nfe-payload-${randomUUID()}.json`);
  await fs.writeJson(payloadFile, payload, { spaces: 0 });

  try {
    const result = await spawnEmitir(payloadFile);
    logger.info('NF-e emissão real', {
      companyId: company.id,
      ambiente,
      ok: result.ok,
      cStat: result.cStat,
    });
    return result;
  } finally {
    await fs.remove(payloadFile).catch(() => undefined);
  }
}

export { getAmbiente };
