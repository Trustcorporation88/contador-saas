/**
 * CNPJ Service — Integração com BrasilAPI (Receita Federal)
 * https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 *
 * Busca dados cadastrais de empresas diretamente na base da Receita Federal
 * via BrasilAPI (gratuita, sem autenticação).
 * Resultados são cacheados por 24h para evitar abuso da API pública.
 */

import axios, { AxiosError } from 'axios';
import NodeCache from 'node-cache';
import { CompanyService } from './companyService';
import { logger } from '../middleware/requestLogger';

// Cache TTL: 24 horas (86400 segundos)
const cnpjCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

const BRASIL_API = 'https://brasilapi.com.br/api/cnpj/v1';

// ─── Tipos de resposta da BrasilAPI ──────────────────────────────────────────

export interface BrasilApiCnpjResponse {
  cnpj:                    string;
  razao_social:            string;
  nome_fantasia:           string;
  descricao_situacao_cadastral: string;
  situacao_cadastral:      number;
  data_situacao_cadastral: string;
  descricao_tipo_logradouro: string;
  logradouro:              string;
  numero:                  string;
  complemento:             string;
  bairro:                  string;
  municipio:               string;
  uf:                      string;
  cep:                     string;
  ddd_telefone_1:          string;
  email:                   string;
  porte:                   string;
  descricao_porte:         string;
  natureza_juridica:       string;
  cnae_fiscal:             number;
  cnae_fiscal_descricao:   string;
  cnaes_secundarios:       Array<{ codigo: number; descricao: string }>;
  qsa:                     Array<{ nome_socio: string; qualificacao_socio: string }>;
  capital_social:          number;
  opcao_pelo_simples:      boolean;
  opcao_pelo_mei:          boolean;
}

export interface CnpjLookupResult {
  cnpj:            string;
  razao_social:    string;
  nome_fantasia:   string;
  situacao:        string;
  ativa:           boolean;
  endereco: {
    logradouro:  string;
    numero:      string;
    complemento: string;
    bairro:      string;
    municipio:   string;
    uf:          string;
    cep:         string;
  };
  contato: {
    telefone: string;
    email:    string;
  };
  porte:           string;
  natureza_juridica: string;
  cnae_principal:  { codigo: number; descricao: string };
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>;
  socios:          Array<{ nome: string; qualificacao: string }>;
  capital_social:  number;
  simples_nacional: boolean;
  mei:             boolean;
  fonte:           string;
  cached:          boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

function mapResponse(data: BrasilApiCnpjResponse, cached: boolean): CnpjLookupResult {
  return {
    cnpj:          data.cnpj,
    razao_social:  data.razao_social,
    nome_fantasia: data.nome_fantasia || data.razao_social,
    situacao:      data.descricao_situacao_cadastral,
    ativa:         data.situacao_cadastral === 2,   // 2 = ATIVA
    endereco: {
      logradouro:  `${data.descricao_tipo_logradouro} ${data.logradouro}`.trim(),
      numero:      data.numero,
      complemento: data.complemento,
      bairro:      data.bairro,
      municipio:   data.municipio,
      uf:          data.uf,
      cep:         data.cep,
    },
    contato: {
      telefone: data.ddd_telefone_1,
      email:    data.email,
    },
    porte:             data.descricao_porte,
    natureza_juridica: data.natureza_juridica,
    cnae_principal:    { codigo: data.cnae_fiscal, descricao: data.cnae_fiscal_descricao },
    cnaes_secundarios: data.cnaes_secundarios ?? [],
    socios:            (data.qsa ?? []).map(s => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio })),
    capital_social:    data.capital_social,
    simples_nacional:  data.opcao_pelo_simples,
    mei:               data.opcao_pelo_mei,
    fonte:             'BrasilAPI / Receita Federal',
    cached,
  };
}

// ─── Serviço principal ────────────────────────────────────────────────────────

export class CnpjService {

  /**
   * Consultar CNPJ na Receita Federal via BrasilAPI
   * Valida dígitos localmente antes de chamar a API
   */
  static async lookup(cnpj: string): Promise<CnpjLookupResult> {
    const clean = sanitizeCnpj(cnpj);

    if (clean.length !== 14) {
      throw Object.assign(new Error('CNPJ deve ter 14 dígitos'), { status: 400 });
    }

    // Validar dígitos verificadores localmente
    if (!CompanyService.validateCNPJ(clean)) {
      throw Object.assign(new Error('CNPJ inválido (dígitos verificadores incorretos)'), { status: 400 });
    }

    // Verificar cache
    const cached = cnpjCache.get<CnpjLookupResult>(clean);
    if (cached) {
      logger.debug('CNPJ lookup cache hit', { cnpj: clean });
      return { ...cached, cached: true };
    }

    // Chamar BrasilAPI
    try {
      logger.info('CNPJ lookup API call', { cnpj: clean });
      const { data } = await axios.get<BrasilApiCnpjResponse>(
        `${BRASIL_API}/${clean}`,
        { timeout: 10000, headers: { 'Accept': 'application/json' } },
      );

      const result = mapResponse(data, false);
      cnpjCache.set(clean, result);
      return result;

    } catch (err) {
      const axiosErr = err as AxiosError;

      if (axiosErr.response?.status === 404) {
        throw Object.assign(
          new Error('CNPJ não encontrado na base da Receita Federal'),
          { status: 404 },
        );
      }
      if (axiosErr.response?.status === 429) {
        throw Object.assign(
          new Error('Limite de consultas atingido. Aguarde alguns minutos.'),
          { status: 429 },
        );
      }

      logger.error('BrasilAPI CNPJ lookup failed', {
        cnpj: clean,
        status: axiosErr.response?.status,
        message: axiosErr.message,
      });
      throw Object.assign(
        new Error('Serviço de consulta CNPJ indisponível. Tente novamente em instantes.'),
        { status: 503 },
      );
    }
  }

  /**
   * Validar CNPJ apenas localmente (sem chamada de API)
   * Retorna objeto com resultado da validação
   */
  static validate(cnpj: string): { valid: boolean; cnpj: string; formatted: string } {
    const clean = sanitizeCnpj(cnpj);
    const valid = clean.length === 14 && CompanyService.validateCNPJ(clean);
    const formatted = clean.length === 14
      ? `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`
      : clean;
    return { valid, cnpj: clean, formatted };
  }

  /** Limpar cache de um CNPJ específico */
  static invalidateCache(cnpj: string): void {
    cnpjCache.del(sanitizeCnpj(cnpj));
  }
}
