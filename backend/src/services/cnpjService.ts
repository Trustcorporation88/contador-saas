/**
 * Documento Service — busca completa de CNPJ e CPF
 *
 * Provider primário: cnpj.trustcorp.com.br
 * Fallback para CNPJ: BrasilAPI (Receita Federal)
 */

import axios, { AxiosError } from 'axios';
import NodeCache from 'node-cache';
import { CompanyService } from './companyService';
import { logger } from '../middleware/requestLogger';

const cnpjCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });
const cpfCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

const BRASIL_API = 'https://brasilapi.com.br/api/cnpj/v1';
const TRUSTCORP_BASE_URL = (process.env.DOC_LOOKUP_BASE_URL || 'https://cnpj.trustcorp.com.br').replace(/\/+$/, '');
const TRUSTCORP_TIMEOUT_MS = Number(process.env.DOC_LOOKUP_TIMEOUT_MS || 10000);

export interface CnpjLookupResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao: string;
  ativa: boolean;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  contato: {
    telefone: string;
    email: string;
  };
  porte: string;
  natureza_juridica: string;
  cnae_principal: { codigo: number; descricao: string };
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>;
  socios: Array<{ nome: string; qualificacao: string }>;
  capital_social: number;
  simples_nacional: boolean;
  mei: boolean;
  fonte: string;
  cached: boolean;
}

export interface CpfLookupResult {
  cpf: string;
  nome: string;
  situacao: string;
  ativo: boolean;
  data_nascimento?: string;
  nome_mae?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  fonte: string;
  cached: boolean;
}

export type DocumentoLookupResult =
  | ({ tipo: 'cnpj' } & CnpjLookupResult)
  | ({ tipo: 'cpf' } & CpfLookupResult);

interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  situacao_cadastral: number;
  descricao_tipo_logradouro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email: string;
  descricao_porte: string;
  natureza_juridica: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>;
  qsa: Array<{ nome_socio: string; qualificacao_socio: string }>;
  capital_social: number;
  opcao_pelo_simples: boolean;
  opcao_pelo_mei: boolean;
}

function sanitizeDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function pickBoolean(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'ativo', 'atv', '1', 'sim', 's'].includes(normalized)) return true;
      if (['false', 'inativo', '0', 'nao', 'não', 'n'].includes(normalized)) return false;
    }
  }
  return false;
}

function mapBrasilApiResponse(data: BrasilApiCnpjResponse, cached: boolean): CnpjLookupResult {
  return {
    cnpj: data.cnpj,
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia || data.razao_social,
    situacao: data.descricao_situacao_cadastral,
    ativa: data.situacao_cadastral === 2,
    endereco: {
      logradouro: `${data.descricao_tipo_logradouro} ${data.logradouro}`.trim(),
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      municipio: data.municipio,
      uf: data.uf,
      cep: data.cep,
    },
    contato: {
      telefone: data.ddd_telefone_1,
      email: data.email,
    },
    porte: data.descricao_porte,
    natureza_juridica: data.natureza_juridica,
    cnae_principal: { codigo: data.cnae_fiscal, descricao: data.cnae_fiscal_descricao },
    cnaes_secundarios: data.cnaes_secundarios ?? [],
    socios: (data.qsa ?? []).map((s) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio })),
    capital_social: data.capital_social,
    simples_nacional: data.opcao_pelo_simples,
    mei: data.opcao_pelo_mei,
    fonte: 'BrasilAPI / Receita Federal',
    cached,
  };
}

function mapTrustcorpCnpjResponse(raw: unknown, documento: string, cached: boolean): CnpjLookupResult {
  const data = (raw && typeof raw === 'object' && 'data' in raw ? (raw as any).data : raw) as Record<string, unknown>;
  const endereco = (data?.endereco ?? {}) as Record<string, unknown>;
  const contato = (data?.contato ?? {}) as Record<string, unknown>;
  const cnaePrincipal = (data?.cnae_principal ?? {}) as Record<string, unknown>;
  const cnaesSecundarios = Array.isArray(data?.cnaes_secundarios) ? data.cnaes_secundarios as any[] : [];
  const socios = Array.isArray(data?.socios) ? data.socios as any[] : [];

  return {
    cnpj: sanitizeDigits(pickString(data?.cnpj, documento)),
    razao_social: pickString(data?.razao_social, data?.nome, data?.nome_empresarial),
    nome_fantasia: pickString(data?.nome_fantasia, data?.fantasia, data?.razao_social),
    situacao: pickString(data?.situacao, data?.status, data?.descricao_situacao_cadastral),
    ativa: pickBoolean(data?.ativa, data?.ativo, data?.situacao === 'ATIVA'),
    endereco: {
      logradouro: pickString(endereco?.logradouro, data?.logradouro),
      numero: pickString(endereco?.numero, data?.numero),
      complemento: pickString(endereco?.complemento, data?.complemento),
      bairro: pickString(endereco?.bairro, data?.bairro),
      municipio: pickString(endereco?.municipio, data?.municipio, data?.cidade),
      uf: pickString(endereco?.uf, data?.uf),
      cep: pickString(endereco?.cep, data?.cep),
    },
    contato: {
      telefone: pickString(contato?.telefone, contato?.celular, data?.telefone),
      email: pickString(contato?.email, data?.email),
    },
    porte: pickString(data?.porte, data?.descricao_porte),
    natureza_juridica: pickString(data?.natureza_juridica),
    cnae_principal: {
      codigo: pickNumber(cnaePrincipal?.codigo, data?.cnae_fiscal),
      descricao: pickString(cnaePrincipal?.descricao, data?.cnae_fiscal_descricao),
    },
    cnaes_secundarios: cnaesSecundarios.map((c: any) => ({
      codigo: pickNumber(c?.codigo),
      descricao: pickString(c?.descricao),
    })),
    socios: socios.map((s: any) => ({
      nome: pickString(s?.nome, s?.nome_socio),
      qualificacao: pickString(s?.qualificacao, s?.qualificacao_socio),
    })),
    capital_social: pickNumber(data?.capital_social),
    simples_nacional: pickBoolean(data?.simples_nacional, data?.opcao_pelo_simples),
    mei: pickBoolean(data?.mei, data?.opcao_pelo_mei),
    fonte: pickString(data?.fonte, 'TrustCorp'),
    cached,
  };
}

function mapTrustcorpCpfResponse(raw: unknown, documento: string, cached: boolean): CpfLookupResult {
  const data = (raw && typeof raw === 'object' && 'data' in raw ? (raw as any).data : raw) as Record<string, unknown>;
  const endereco = (data?.endereco ?? {}) as Record<string, unknown>;

  return {
    cpf: sanitizeDigits(pickString(data?.cpf, documento)),
    nome: pickString(data?.nome, data?.nome_completo),
    situacao: pickString(data?.situacao, data?.status),
    ativo: pickBoolean(data?.ativo, data?.situacao === 'REGULAR'),
    data_nascimento: pickString(data?.data_nascimento, data?.nascimento) || undefined,
    nome_mae: pickString(data?.nome_mae, data?.mae) || undefined,
    endereco: {
      logradouro: pickString(endereco?.logradouro, data?.logradouro) || undefined,
      numero: pickString(endereco?.numero, data?.numero) || undefined,
      complemento: pickString(endereco?.complemento, data?.complemento) || undefined,
      bairro: pickString(endereco?.bairro, data?.bairro) || undefined,
      municipio: pickString(endereco?.municipio, data?.municipio, data?.cidade) || undefined,
      uf: pickString(endereco?.uf, data?.uf) || undefined,
      cep: pickString(endereco?.cep, data?.cep) || undefined,
    },
    fonte: pickString(data?.fonte, 'TrustCorp'),
    cached,
  };
}

function trustcorpCandidates(tipo: 'cnpj' | 'cpf', documento: string): string[] {
  const base = TRUSTCORP_BASE_URL;
  return [
    `${base}/api/v1/${tipo}/${documento}`,
    `${base}/api/${tipo}/${documento}`,
    `${base}/${tipo}/${documento}`,
    `${base}/api/v1/consulta?tipo=${tipo}&documento=${documento}`,
    `${base}/api/consulta?tipo=${tipo}&documento=${documento}`,
    `${base}/consulta?tipo=${tipo}&documento=${documento}`,
    `${base}/api/v1/busca/${documento}`,
    `${base}/api/busca/${documento}`,
    `${base}/busca/${documento}`,
  ];
}

async function fetchFromTrustcorp(tipo: 'cnpj' | 'cpf', documento: string): Promise<unknown> {
  const urls = trustcorpCandidates(tipo, documento);
  let lastError: AxiosError | null = null;

  for (const url of urls) {
    try {
      logger.info('TrustCorp lookup attempt', { tipo, documento, url });
      const { data } = await axios.get(url, {
        timeout: TRUSTCORP_TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      });
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      lastError = axiosErr;
      const status = axiosErr.response?.status;
      if (status === 404) continue;
      if (status && status < 500 && status !== 429) {
        throw Object.assign(new Error(`Consulta ${tipo.toUpperCase()} recusada pelo provedor.`), { status });
      }
    }
  }

  if (lastError?.response?.status === 429) {
    throw Object.assign(new Error('Limite de consultas atingido. Aguarde alguns minutos.'), { status: 429 });
  }
  throw Object.assign(
    new Error(`Serviço de consulta ${tipo.toUpperCase()} indisponível. Tente novamente em instantes.`),
    { status: 503 },
  );
}

function validateCpfDigits(cpf: string): boolean {
  const clean = sanitizeDigits(cpf);
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(clean[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(clean[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(clean[10]);
}

export class CnpjService {
  static async lookup(cnpj: string): Promise<CnpjLookupResult> {
    const clean = sanitizeDigits(cnpj);
    if (clean.length !== 14) {
      throw Object.assign(new Error('CNPJ deve ter 14 dígitos'), { status: 400 });
    }
    if (!CompanyService.validateCNPJ(clean)) {
      throw Object.assign(new Error('CNPJ inválido (dígitos verificadores incorretos)'), { status: 400 });
    }

    const cached = cnpjCache.get<CnpjLookupResult>(clean);
    if (cached) return { ...cached, cached: true };

    try {
      const raw = await fetchFromTrustcorp('cnpj', clean);
      const result = mapTrustcorpCnpjResponse(raw, clean, false);
      cnpjCache.set(clean, result);
      return result;
    } catch (err) {
      const known = err as Error & { status?: number };
      if (known.status && known.status < 500 && known.status !== 429) throw err;
      logger.warn('TrustCorp CNPJ lookup failed, using BrasilAPI fallback', { cnpj: clean, message: known.message });
    }

    try {
      const { data } = await axios.get<BrasilApiCnpjResponse>(`${BRASIL_API}/${clean}`, {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      });
      const result = mapBrasilApiResponse(data, false);
      cnpjCache.set(clean, result);
      return result;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw Object.assign(new Error('CNPJ não encontrado na base da Receita Federal'), { status: 404 });
      }
      if (axiosErr.response?.status === 429) {
        throw Object.assign(new Error('Limite de consultas atingido. Aguarde alguns minutos.'), { status: 429 });
      }
      logger.error('CNPJ lookup failed', { cnpj: clean, status: axiosErr.response?.status, message: axiosErr.message });
      throw Object.assign(new Error('Serviço de consulta CNPJ indisponível. Tente novamente em instantes.'), { status: 503 });
    }
  }

  static async lookupCpf(cpf: string): Promise<CpfLookupResult> {
    const clean = sanitizeDigits(cpf);
    if (clean.length !== 11) {
      throw Object.assign(new Error('CPF deve ter 11 dígitos'), { status: 400 });
    }
    if (!validateCpfDigits(clean)) {
      throw Object.assign(new Error('CPF inválido (dígitos verificadores incorretos)'), { status: 400 });
    }

    const cached = cpfCache.get<CpfLookupResult>(clean);
    if (cached) return { ...cached, cached: true };

    const raw = await fetchFromTrustcorp('cpf', clean);
    const result = mapTrustcorpCpfResponse(raw, clean, false);
    cpfCache.set(clean, result);
    return result;
  }

  static async lookupDocumento(documento: string): Promise<DocumentoLookupResult> {
    const clean = sanitizeDigits(documento);
    if (clean.length === 14) {
      return { tipo: 'cnpj', ...(await this.lookup(clean)) };
    }
    if (clean.length === 11) {
      return { tipo: 'cpf', ...(await this.lookupCpf(clean)) };
    }
    throw Object.assign(new Error('Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)'), { status: 400 });
  }

  static validate(cnpj: string): { valid: boolean; cnpj: string; formatted: string } {
    const clean = sanitizeDigits(cnpj);
    const valid = clean.length === 14 && CompanyService.validateCNPJ(clean);
    const formatted = clean.length === 14
      ? `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`
      : clean;
    return { valid, cnpj: clean, formatted };
  }

  static validateCpf(cpf: string): { valid: boolean; cpf: string; formatted: string } {
    const clean = sanitizeDigits(cpf);
    const valid = clean.length === 11 && validateCpfDigits(clean);
    const formatted = clean.length === 11
      ? `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`
      : clean;
    return { valid, cpf: clean, formatted };
  }

  static invalidateCache(documento: string): void {
    const clean = sanitizeDigits(documento);
    cnpjCache.del(clean);
    cpfCache.del(clean);
  }
}

