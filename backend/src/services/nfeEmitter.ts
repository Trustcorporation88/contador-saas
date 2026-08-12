/**
 * NF-e Emitter — ponte Node → Python (pynfe)
 *
 * Materializa o certificado A1 da empresa, monta o payload JSON da nota,
 * executa `automacao-xml/emitir_nfe.py` (assina + transmite à SEFAZ) e
 * interpreta o resultado.
 *
 * SEGURANÇA: ambiente padrão = "homologacao". Produção só quando
 * NFE_AMBIENTE=producao explicitamente.
 *
 * REFORMA TRIBUTÁRIA — o bloqueio para destacar IBS/CBS está AQUI.
 *
 * Situação em 10/08/2026: a pynfe 0.6.5 não suporta IBS/CBS. Não há versão
 * publicada com o grupo <gIBSCBS>, e o payload montado abaixo não tem como
 * carregá-lo — a biblioteca ignoraria os campos.
 *
 * Por isso nenhuma nota transmitida por este sistema destaca IBS, CBS ou
 * Imposto Seletivo, independentemente do que o rascunho da tela mostre.
 * Mudar isso exige fork da pynfe ou serializador próprio, mantido
 * acompanhando as revisões da NT — foram 11 em 17 meses.
 *
 * Antes de priorizar: a REJEIÇÃO pela SEFAZ foi SUSPENSA em 01/08/2026 (Ato
 * Técnico Conjunto RFB/CGIBS nº 1/2026), então a nota sem o grupo continua
 * sendo autorizada. A obrigação legal existe desde 01/2026 — a exposição é
 * autuação, não parada de faturamento. Confirme se a suspensão segue valendo.
 *
 * O contexto completo (armadilhas de cálculo e o que já existe pronto, como a
 * tabela cClassTrib) está no comentário do bloco <imposto> em
 * nfeService.gerarXmlNfe.
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';
import { decryptSecret, decryptSecretWithLegacyFallback } from '../utils/certEncryption';

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

/**
 * Qual binário do Python usar.
 *
 * O padrão fora de produção era `python`, e em sistema moderno esse executável
 * simplesmente não existe — só `python3`. O resultado era `spawn python ENOENT`
 * ao rodar qualquer coisa que chame o Python fora do container, inclusive os
 * testes. Produção não muda: o Dockerfile define PYTHON_BIN=python3, e essa
 * variável continua tendo precedência sobre tudo.
 */
function getPythonBin(): string {
  return process.env.PYTHON_BIN || 'python3';
}

/**
 * Teto de tempo para os processos Python que falam com a SEFAZ.
 * Sem isso, uma indisponibilidade da SEFAZ deixava o processo filho pendurado
 * e a requisição HTTP aberta indefinidamente, esgotando o pool de conexões.
 */
function getSefazTimeoutMs(envVar: string, padrao: number): number {
  const bruto = Number(process.env[envVar]);
  return Number.isFinite(bruto) && bruto > 0 ? bruto : padrao;
}

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Grava o payload do processo Python. O arquivo carrega a senha do certificado
 * A1 em texto claro, então vai com permissão 0600 — o writeJson padrão criava
 * com 0644, legível por qualquer usuário do sistema.
 */
async function escreverPayloadSeguro(caminho: string, payload: unknown): Promise<void> {
  await fs.writeFile(caminho, JSON.stringify(payload), { mode: 0o600 });
}

/** CRT a partir do regime tributário da empresa. */
export function crtFromRegime(taxRegime: string | null | undefined, explicit?: string | null): string {
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
    // O .pfx contém a chave privada da empresa: 0700 no diretório, 0600 no
    // arquivo (o padrão deixava o certificado legível por qualquer usuário).
    await fs.ensureDir(path.dirname(target), { mode: 0o700 });
    await fs.writeFile(target, Buffer.from(pfxData, 'base64'), { mode: 0o600 });
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
  forma_pagamento?: string;
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
  /** IPI — presente só para contribuinte do imposto (ver nfeDTO.NfeItemDTO). */
  cst_ipi?: string;
  aliquota_ipi?: number | string;
  codigo_enquadramento_ipi?: string;
}

export function validarEmitente(company: CompanyRow): void {
  const faltando: string[] = [];
  if (!digits(company.cnpj)) faltando.push('CNPJ');
  if (!company.legal_name) faltando.push('razão social');
  if (!company.address) faltando.push('logradouro');
  if (!company.endereco_bairro) faltando.push('bairro');
  if (!company.city) faltando.push('município');
  if (String(company.state ?? '').trim().length !== 2) faltando.push('UF (sigla de 2 letras)');
  if (digits(company.postal_code).length !== 8) faltando.push('CEP (8 dígitos)');
  // O código do município tem que ter 7 dígitos (IBGE). Um código de 4 dígitos
  // (o da Receita, que algumas consultas de CNPJ devolvem) passava a validação
  // antiga de "não vazio" e só era recusado pela SEFAZ, com mensagem obscura.
  if (digits(company.codigo_municipio).length !== 7) {
    faltando.push('código IBGE do município (7 dígitos)');
  }
  if (faltando.length > 0) {
    throw Object.assign(
      new Error(
        `Cadastro fiscal da empresa incompleto para emissão de NF-e. Preencha: ${faltando.join(', ')}.`,
      ),
      { status: 422 },
    );
  }
}

export function buildPayload(
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

  // Município do destinatário: o fallback para o código do emitente só faz
  // sentido dentro da mesma UF. Em UF diferente, a SEFAZ rejeita o cMun por não
  // pertencer à UF informada — melhor recusar aqui, com mensagem clara.
  const destUf = String((destEndereco.uf as string) || company.state || '').toUpperCase();
  const emitUf = String(company.state || '').toUpperCase();
  const destCodMunicipio = digits(destEndereco.cod_municipio);
  if (destUf !== emitUf && destCodMunicipio.length !== 7) {
    throw Object.assign(
      new Error(
        `Destinatário em ${destUf}, fora da UF do emitente (${emitUf}): informe o código IBGE `
        + 'do município do destinatário (7 dígitos) para a SEFAZ aceitar a nota.',
      ),
      { status: 422 },
    );
  }

  // Normaliza IE do destinatário (evita cStat 232 com IE vazia/0000).
  let indicadorIe = Number(dest.indicador_ie ?? 9);
  if (![1, 2, 9].includes(indicadorIe)) indicadorIe = 9;
  const ieRaw = String(dest.inscricao_estadual || '').trim();
  const ieDigits = digits(ieRaw);
  const iePlaceholder = !ieDigits || /^0+$/.test(ieDigits);
  let inscricaoEstadual = ieRaw;
  if (ieRaw.toUpperCase() === 'ISENTO' || indicadorIe === 2) {
    indicadorIe = 2;
    inscricaoEstadual = 'ISENTO';
  } else if (indicadorIe === 9 || iePlaceholder) {
    indicadorIe = 9;
    inscricaoEstadual = '';
  } else {
    indicadorIe = 1;
    inscricaoEstadual = ieDigits;
  }

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
    // tPag escolhido pelo usuário. Estava fixo em '01': toda nota saía como
    // paga em dinheiro, mesmo quando a venda foi no cartão, boleto ou PIX.
    forma_pagamento: String(nfe.forma_pagamento || '01').padStart(2, '0'),
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
      indicador_ie: indicadorIe,
      inscricao_estadual: inscricaoEstadual,
      logradouro: destEndereco.logradouro || 'NAO INFORMADO',
      numero: destEndereco.numero || 'S/N',
      bairro: destEndereco.bairro || 'NAO INFORMADO',
      municipio: destEndereco.municipio || company.city,
      cod_municipio: destCodMunicipio || digits(company.codigo_municipio),
      uf: destUf,
      cep: digits(destEndereco.cep) || digits(company.postal_code),
    },
    itens: itens.map((it) => {
      const pisAliq = simples ? 0 : Number(it.aliquota_pis ?? 0);
      const cofinsAliq = simples ? 0 : Number(it.aliquota_cofins ?? 0);
      return {
        codigo: it.codigo_produto,
        descricao: it.descricao,
        ncm: digits(it.ncm).slice(0, 8),
        cfop: digits(it.cfop).slice(0, 4),
        unidade: it.unidade || 'UN',
        quantidade: Number(it.quantidade),
        valor_unitario: Number(it.valor_unitario),
        icms_modalidade: simples ? '102' : it.cst_icms || '00',
        icms_origem: 0,
        // Simples Nacional (CSOSN): ICMS próprio não se aplica — zera alíquota
        // para não misturar com totais de PIS/COFINS.
        icms_aliquota: simples ? 0 : Number(it.aliquota_icms ?? 0),
        // Simples: PIS/COFINS CST 07 (NT) com valor 0. Regime normal: CST 01
        // quando há alíquota (evita cStat 602 — total PIS ≠ soma dos itens).
        pis_modalidade: simples || pisAliq <= 0 ? '07' : '01',
        pis_aliquota: pisAliq,
        cofins_modalidade: simples || cofinsAliq <= 0 ? '07' : '01',
        cofins_aliquota: cofinsAliq,
        // IPI independe do regime: é o contribuinte do imposto (indústria,
        // importador) que destaca. Sem CST nem alíquota, o Python não monta o
        // grupo e a nota sai como antes. cEnq 999 = tributação normal.
        ipi_cst: String(it.cst_ipi ?? '').trim(),
        ipi_aliquota: Number(it.aliquota_ipi ?? 0),
        ipi_cenq: String(it.codigo_enquadramento_ipi ?? '999').trim() || '999',
      };
    }),
  };
}

function spawnEmitir(payloadFile: string): Promise<NfeEmissionResult> {
  const automationDir = getAutomationDir();
  const scriptPath = path.join(automationDir, 'emitir_nfe.py');
  const python = getPythonBin();

  const timeoutMs = getSefazTimeoutMs('NFE_EMISSION_TIMEOUT_MS', 180_000);

  return new Promise((resolve) => {
    const child = spawn(python, [scriptPath, payloadFile], {
      cwd: automationDir,
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
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

    child.on('close', (_code, signal) => {
      const line = stdout.split('\n').find((l) => l.startsWith('NFE_RESULT:'));
      if (!line) {
        const expirou = signal === 'SIGKILL' || signal === 'SIGTERM';
        resolve({
          ok: false,
          ambiente: getAmbiente(),
          cStat: '',
          motivo: expirou
            ? `Sem resposta da SEFAZ em ${Math.round(timeoutMs / 1000)}s. A nota pode ter sido `
              + 'transmitida: consulte a numeração antes de reenviar, para não emitir em duplicidade.'
            : 'Motor de emissão não retornou resultado. ' + (stderr.slice(-400) || ''),
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
    cert.pfx_data ? decryptSecretWithLegacyFallback(cert.pfx_data as string) : null,
  );

  const payload = buildPayload(company, nfe, itens, ambiente, certPath, certSenha);

  const payloadFile = path.join(os.tmpdir(), `nfe-payload-${randomUUID()}.json`);
  await escreverPayloadSeguro(payloadFile, payload);

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

export interface NfeCancelamentoResult {
  ok: boolean;
  ambiente: string;
  cStat: string;
  motivo: string;
  protocolo: string;
  dhRegEvento?: string;
  xml_evento?: string;
  raw?: string;
}

function spawnCancelar(payloadFile: string): Promise<NfeCancelamentoResult> {
  const automationDir = getAutomationDir();
  const scriptPath = path.join(automationDir, 'cancelar_nfe.py');
  const python = getPythonBin();

  const timeoutMs = getSefazTimeoutMs('NFE_CANCEL_TIMEOUT_MS', 120_000);

  return new Promise((resolve) => {
    const child = spawn(python, [scriptPath, payloadFile], {
      cwd: automationDir,
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
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
        motivo: `Falha ao executar o motor de cancelamento (${python}): ${error.message}`,
        protocolo: '',
      });
    });

    child.on('close', (_code, signal) => {
      const line = stdout.split('\n').find((l) => l.startsWith('NFE_CANCEL_RESULT:'));
      if (!line) {
        const expirou = signal === 'SIGKILL' || signal === 'SIGTERM';
        resolve({
          ok: false,
          ambiente: getAmbiente(),
          cStat: '',
          motivo: expirou
            ? `Sem resposta da SEFAZ em ${Math.round(timeoutMs / 1000)}s ao cancelar. `
              + 'Consulte a situação da nota antes de tentar de novo.'
            : 'Motor de cancelamento não retornou resultado. ' + (stderr.slice(-400) || ''),
          protocolo: '',
        });
        return;
      }
      try {
        const parsed = JSON.parse(line.replace('NFE_CANCEL_RESULT:', '').trim());
        resolve({
          ok: Boolean(parsed.ok),
          ambiente: parsed.ambiente || getAmbiente(),
          cStat: parsed.cStat || '',
          motivo: parsed.motivo || '',
          protocolo: parsed.protocolo || '',
          dhRegEvento: parsed.dhRegEvento,
          xml_evento: parsed.xml_evento,
          raw: parsed.raw,
        });
      } catch (e) {
        resolve({
          ok: false,
          ambiente: getAmbiente(),
          cStat: '',
          motivo: 'Resposta inválida do motor de cancelamento: ' + (e as Error).message,
          protocolo: '',
        });
      }
    });
  });
}

/**
 * Cancela uma NF-e real junto à SEFAZ (evento 110111 — Cancelamento).
 * Não há simulação aqui: se a nota foi autorizada em produção, o
 * cancelamento também é registrado em produção, de forma definitiva.
 */
export async function cancelarNfeReal(
  company: CompanyRow,
  nfe: { chave_acesso: string | null; protocolo: string | null; modelo: number },
  justificativa: string,
): Promise<NfeCancelamentoResult> {
  const db = await getDatabase();
  const ambiente = getAmbiente();

  if (!nfe.chave_acesso) {
    throw Object.assign(
      new Error('NF-e sem chave de acesso registrada; não é possível cancelar junto à SEFAZ.'),
      { status: 422 },
    );
  }
  if (!nfe.protocolo) {
    throw Object.assign(
      new Error('NF-e sem protocolo de autorização registrado; não é possível cancelar junto à SEFAZ.'),
      { status: 422 },
    );
  }

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
    cert.pfx_data ? decryptSecretWithLegacyFallback(cert.pfx_data as string) : null,
  );

  const payload = {
    ambiente,
    cert_path: certPath,
    cert_senha: certSenha,
    uf: company.state,
    cnpj: digits(company.cnpj),
    chave: nfe.chave_acesso,
    protocolo: nfe.protocolo,
    justificativa,
    modelo: nfe.modelo,
  };

  const payloadFile = path.join(os.tmpdir(), `nfe-cancel-${randomUUID()}.json`);
  await escreverPayloadSeguro(payloadFile, payload);

  try {
    const result = await spawnCancelar(payloadFile);
    logger.info('NF-e cancelamento real', {
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

export type NumeracaoCheckResult = {
  ok: boolean;
  sefaz_online: boolean;
  ja_emitida_sefaz: boolean | null;
  disponivel?: boolean | null;
  cStat: string;
  motivo: string;
  fonte: string;
  serie: number;
  numero: number;
  chave?: string;
};

/** Consulta status SEFAZ (+ protocolo por chave, se houver) para número/série. */
export async function verificarNumeracaoSefaz(opts: {
  companyId: string;
  uf: string;
  serie: number;
  numero: number;
  modelo?: number;
  chave?: string | null;
}): Promise<NumeracaoCheckResult> {
  const db = await getDatabase();
  const ambiente = getAmbiente();
  const modelo = opts.modelo ?? 55;

  const cert = await db('fiscal_certificates')
    .where({ company_id: opts.companyId, active: true })
    .first();
  if (!cert) {
    throw Object.assign(
      new Error('Certificado digital A1 não configurado. Cadastre o .pfx em Captura Fiscal.'),
      { status: 422 },
    );
  }

  const certSenha = decryptSecret(cert.password_encrypted);
  const certPath = await materializePfx(
    opts.companyId,
    String(cert.pfx_path || ''),
    cert.pfx_data ? decryptSecretWithLegacyFallback(cert.pfx_data as string) : null,
  );

  const payload = {
    ambiente,
    cert_path: certPath,
    cert_senha: certSenha,
    uf: opts.uf,
    modelo,
    serie: opts.serie,
    numero: opts.numero,
    chave: opts.chave || undefined,
  };

  const payloadFile = path.join(os.tmpdir(), `nfe-check-${randomUUID()}.json`);
  await escreverPayloadSeguro(payloadFile, payload);

  try {
    const automationDir = getAutomationDir();
    const scriptPath = path.join(automationDir, 'verificar_numeracao_nfe.py');
    if (!(await fs.pathExists(scriptPath))) {
      throw Object.assign(
        new Error('Script verificar_numeracao_nfe.py não encontrado no servidor.'),
        { status: 500 },
      );
    }

    const timeoutMs = getSefazTimeoutMs('NFE_CHECK_TIMEOUT_MS', 60_000);
    const result = await new Promise<NumeracaoCheckResult>((resolve) => {
      const child = spawn(getPythonBin(), [scriptPath, payloadFile], {
        cwd: automationDir,
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
        env: process.env,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('error', (error) => {
        resolve({
          ok: false,
          sefaz_online: false,
          ja_emitida_sefaz: null,
          cStat: '',
          motivo: `Falha ao executar o verificador de numeração: ${error.message}`,
          fonte: 'erro',
          serie: opts.serie,
          numero: opts.numero,
        });
      });
      child.on('close', (_code, signal) => {
        const line = stdout
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.startsWith('NFE_CHECK:'));
        if (!line) {
          const expirou = signal === 'SIGKILL' || signal === 'SIGTERM';
          resolve({
            ok: false,
            sefaz_online: false,
            ja_emitida_sefaz: null,
            cStat: '',
            motivo: expirou
              ? `Consulta de numeração sem resposta em ${Math.round(timeoutMs / 1000)}s (SEFAZ lenta ou indisponível).`
              : 'Motor de verificação não retornou resultado. ' + (stderr.slice(-400) || ''),
            fonte: 'erro',
            serie: opts.serie,
            numero: opts.numero,
          });
          return;
        }
        try {
          const parsed = JSON.parse(line.replace('NFE_CHECK:', '').trim());
          resolve({
            ok: Boolean(parsed.ok),
            sefaz_online: Boolean(parsed.sefaz_online),
            ja_emitida_sefaz:
              parsed.ja_emitida_sefaz === null || parsed.ja_emitida_sefaz === undefined
                ? null
                : Boolean(parsed.ja_emitida_sefaz),
            disponivel:
              parsed.disponivel === null || parsed.disponivel === undefined
                ? null
                : Boolean(parsed.disponivel),
            cStat: parsed.cStat || '',
            motivo: parsed.motivo || '',
            fonte: parsed.fonte || 'sefaz',
            serie: Number(parsed.serie ?? opts.serie),
            numero: Number(parsed.numero ?? opts.numero),
            chave: parsed.chave,
          });
        } catch (e) {
          resolve({
            ok: false,
            sefaz_online: false,
            ja_emitida_sefaz: null,
            cStat: '',
            motivo: 'Resposta inválida do verificador: ' + (e as Error).message,
            fonte: 'erro',
            serie: opts.serie,
            numero: opts.numero,
          });
        }
      });
    });

    return result;
  } finally {
    await fs.remove(payloadFile).catch(() => undefined);
  }
}

// getAutomationDir e getPythonBin passam a ser exportados porque o danfeService
// invoca outro script da mesma pasta (gerar_danfe.py). Duplicar a busca do
// diretório seria pior: a lista de candidatos existe porque o caminho difere
// entre container, desenvolvimento e testes, e duas cópias divergiriam.
export { getAmbiente, getAutomationDir, getPythonBin };
