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
// Terceira fonte, usada só quando o logradouro vem vazio das anteriores. A
// BrasilAPI e a minhareceita leem o MESMO dump aberto da Receita, então quando
// aquele registro está sem rua as duas ficam sem — não adianta trocar uma pela
// outra. O CNPJá mantém base própria e tem o dado nesses casos.
const CNPJA_OPEN = 'https://open.cnpja.com/office';
const TRUSTCORP_BASE_URL = (process.env.DOC_LOOKUP_BASE_URL || '').replace(/\/+$/, '');
const TRUSTCORP_TIMEOUT_MS = Number(process.env.DOC_LOOKUP_TIMEOUT_MS || 10000);
const TRUSTCORP_ACCESS_KEY = process.env.DOC_LOOKUP_ACCESS_KEY?.trim() || '';
/**
 * Caminho da API, com {documento} onde entra o numero. Ex.: /api/v1/cnpj/{documento}
 *
 * Precisa ser EXPLICITO. Antes o codigo chutava nove caminhos diferentes ate um
 * responder — e o problema e que cnpj.trustcorp.com.br e um app de pagina unica:
 * ele devolve HTTP 200 com o MESMO HTML para qualquer caminho. Os nove "davam
 * certo", o mapper lia propriedade de string (undefined em tudo) e o resultado
 * era cadastro vazio, gravado em cache por 24h. Era essa a causa das notas
 * saindo sem os dados do destinatario.
 */
const SINTEGRA_TOKEN = process.env.SINTEGRA_TOKEN?.trim() || '';
const SINTEGRA_URL = (process.env.SINTEGRA_BASE_URL || 'https://www.sintegraws.com.br/api/v1/execute-api.php').trim();
const CNPJA_TOKEN = process.env.CNPJA_TOKEN?.trim() || '';
const CNPJA_COMERCIAL = (process.env.CNPJA_BASE_URL || 'https://api.cnpja.com').replace(/\/+$/, '');

const TRUSTCORP_PATH_CNPJ = process.env.DOC_LOOKUP_PATH_CNPJ?.trim() || '';
const TRUSTCORP_PATH_CPF = process.env.DOC_LOOKUP_PATH_CPF?.trim() || '';

function lookupUrl(tipo: 'cnpj' | 'cpf', documento: string): string | null {
  const path = tipo === 'cnpj' ? TRUSTCORP_PATH_CNPJ : TRUSTCORP_PATH_CPF;
  if (!TRUSTCORP_BASE_URL || !path) return null;
  return TRUSTCORP_BASE_URL + (path.startsWith('/') ? path : `/${path}`)
    .replace('{documento}', documento);
}

/**
 * Resposta util e OBJETO JSON. String (HTML de SPA, pagina de erro, portal de
 * captura de wi-fi) nao e dado, e tratar como dado foi exatamente o bug.
 */
function ehJson(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw) && typeof raw === 'object' && !Array.isArray(raw);
}

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
    /** Código IBGE do município (7 dígitos), quando disponível */
    codigo_municipio_ibge?: string;
  };
  contato: {
    telefone: string;
    email: string;
  };
  porte: string;
  natureza_juridica: string;
  /** Inscricao estadual — so o SINTEGRA tem. Obrigatoria na NF-e quando o
   *  destinatario e contribuinte de ICMS; sem ela a nota e rejeitada. */
  inscricao_estadual?: string;
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
  /** Campo oficial da BrasilAPI (com "de") */
  descricao_tipo_de_logradouro?: string;
  /** Alias legado / mocks */
  descricao_tipo_logradouro?: string;
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
  codigo_municipio_ibge?: string | number;
}

function sanitizeDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // APIs às vezes serializam null/undefined como texto literal
      if (!trimmed) continue;
      if (/^(undefined|null|n\/a|nao informado|não informado)$/i.test(trimmed)) continue;
      return trimmed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

/** Monta logradouro a partir de tipo + nome, sem gerar o texto "undefined". */
function composeLogradouro(...parts: unknown[]): string {
  const cleaned = parts
    .map((p) => pickString(p))
    .filter(Boolean);
  // Evita duplicar tipo se já veio no nome (ex.: "RUA RUA DAS FLORES")
  if (cleaned.length >= 2) {
    const [tipo, ...rest] = cleaned;
    const nome = rest.join(' ').trim();
    if (nome.toUpperCase().startsWith(tipo.toUpperCase() + ' ')) return nome;
    return `${tipo} ${nome}`.trim();
  }
  return cleaned.join(' ').trim();
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
  // BrasilAPI usa "descricao_tipo_de_logradouro" (com "de"); alguns mocks antigos usam sem.
  const tipoLogradouro = pickString(
    data.descricao_tipo_de_logradouro,
    data.descricao_tipo_logradouro,
  );
  const nomeLogradouro = pickString(data.logradouro);
  const codigoIbge = pickString(
    data.codigo_municipio_ibge,
  );

  return {
    cnpj: data.cnpj,
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia || data.razao_social,
    situacao: data.descricao_situacao_cadastral,
    ativa: data.situacao_cadastral === 2,
    endereco: {
      logradouro: composeLogradouro(tipoLogradouro, nomeLogradouro),
      numero: pickString(data.numero),
      complemento: pickString(data.complemento),
      bairro: pickString(data.bairro),
      municipio: pickString(data.municipio),
      uf: pickString(data.uf),
      cep: pickString(data.cep),
      codigo_municipio_ibge: codigoIbge || undefined,
    },
    contato: {
      telefone: pickString(data.ddd_telefone_1),
      email: pickString(data.email),
    },
    porte: pickString(data.descricao_porte),
    natureza_juridica: pickString(data.natureza_juridica),
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
    razao_social: pickString(
      data?.razao_social,
      data?.razaoSocial,
      data?.nome,
      data?.nomeFantasia,
      data?.nome_fantasia,
      data?.nome_empresarial,
      data?.nomeEmpresarial,
    ),
    nome_fantasia: pickString(
      data?.nome_fantasia,
      data?.nomeFantasia,
      data?.fantasia,
      data?.nome_fantasia_raiz,
      data?.razao_social,
      data?.razaoSocial,
    ),
    situacao: pickString(data?.situacao, data?.status, data?.descricao_situacao_cadastral, data?.descricaoSituacaoCadastral),
    ativa: pickBoolean(data?.ativa, data?.ativo, data?.situacao === 'ATIVA', data?.status === 'ATIVA'),
    endereco: {
      logradouro: composeLogradouro(
        pickString(
          endereco?.tipo_logradouro,
          endereco?.tipoLogradouro,
          endereco?.descricao_tipo_logradouro,
          endereco?.descricao_tipo_de_logradouro,
          data?.descricao_tipo_de_logradouro,
          data?.descricao_tipo_logradouro,
        ),
        pickString(
          endereco?.logradouro,
          endereco?.logradouroCompleto,
          endereco?.rua,
          data?.logradouro,
          data?.logradouroCompleto,
          data?.logradouroCompletoEndereco,
          data?.rua,
        ),
      ),
      numero: pickString(endereco?.numero, data?.numero),
      complemento: pickString(endereco?.complemento, data?.complemento),
      bairro: pickString(endereco?.bairro, data?.bairro, data?.bairroCidade),
      municipio: pickString(endereco?.municipio, data?.municipio, data?.cidade, data?.municipioDescricao),
      uf: pickString(endereco?.uf, data?.uf, data?.estado),
      cep: pickString(endereco?.cep, data?.cep),
      codigo_municipio_ibge: pickString(
        endereco?.codigo_municipio_ibge,
        endereco?.codigoMunicipioIbge,
        data?.codigo_municipio_ibge,
        data?.codigoMunicipioIbge,
        data?.codigo_municipio,
      ) || undefined,
    },
    contato: {
      telefone: pickString(contato?.telefone, contato?.celular, data?.telefone, data?.ddd_telefone_1, data?.dddTelefone),
      email: pickString(contato?.email, data?.email, data?.e_mail),
    },
    porte: pickString(data?.porte, data?.descricao_porte, data?.descricaoPorte),
    natureza_juridica: pickString(data?.natureza_juridica, data?.naturezaJuridica),
    cnae_principal: {
      codigo: pickNumber(cnaePrincipal?.codigo, data?.cnae_fiscal, data?.cnaeFiscal),
      descricao: pickString(cnaePrincipal?.descricao, data?.cnae_fiscal_descricao, data?.cnaeFiscalDescricao),
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

async function fetchFromTrustcorp(tipo: 'cnpj' | 'cpf', documento: string): Promise<unknown> {
  const url = lookupUrl(tipo, documento);
  if (!url) {
    throw Object.assign(
      new Error(`Consulta ${tipo.toUpperCase()} por provedor proprio nao configurada.`),
      { status: 501 },
    );
  }

  try {
    const { data } = await axios.get(url, {
      timeout: TRUSTCORP_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        ...(TRUSTCORP_ACCESS_KEY
          ? {
              Authorization: `Bearer ${TRUSTCORP_ACCESS_KEY}`,
              'x-api-key': TRUSTCORP_ACCESS_KEY,
            }
          : {}),
      },
      // Sem isto, HTML de 200 passa como se fosse resposta valida.
      validateStatus: (status) => status >= 200 && status < 300,
    });

    if (!ehJson(data)) {
      logger.warn('Provedor de consulta respondeu algo que nao e JSON', {
        tipo,
        url,
        amostra: typeof data === 'string' ? data.slice(0, 80) : typeof data,
      });
      throw Object.assign(
        new Error(`Provedor de consulta ${tipo.toUpperCase()} devolveu resposta invalida.`),
        { status: 502 },
      );
    }
    return data;
  } catch (err) {
    const axiosErr = err as AxiosError & { status?: number };
    if (axiosErr.status === 502) throw err;
    const status = axiosErr.response?.status;
    if (status === 429) {
      throw Object.assign(new Error('Limite de consultas atingido. Aguarde alguns minutos.'), { status: 429 });
    }
    if (status && status < 500) {
      throw Object.assign(new Error(`Consulta ${tipo.toUpperCase()} recusada pelo provedor.`), { status });
    }
    throw Object.assign(
      new Error(`Servico de consulta ${tipo.toUpperCase()} indisponivel. Tente novamente em instantes.`),
      { status: 503 },
    );
  }
}

/* ------------------------------------------------------------------ *
 * SINTEGRA WS
 *
 * Endpoint unico com um parametro `plugin` escolhendo a base:
 *   ST  = SINTEGRA (unica fonte com INSCRICAO ESTADUAL)
 *   RF  = ficha da Receita Federal
 *   CPF = pessoa fisica (exige CPF + data de nascimento)
 *
 * Responde HTTP 200 mesmo em erro, com `status` no corpo — entao checar o
 * status HTTP nao basta, tem que ler o campo.
 * ------------------------------------------------------------------ */

type SintegraResposta = Record<string, unknown> & {
  status?: string;
  message?: string;
};

async function fetchSintegra(params: Record<string, string>): Promise<SintegraResposta> {
  if (!SINTEGRA_TOKEN) {
    throw Object.assign(new Error('SINTEGRA_TOKEN nao configurado.'), { status: 501 });
  }

  const { data } = await axios.get<SintegraResposta>(SINTEGRA_URL, {
    params: { token: SINTEGRA_TOKEN, ...params },
    timeout: 15000,
    headers: { Accept: 'application/json' },
  });

  if (!ehJson(data)) {
    throw Object.assign(new Error('SINTEGRA devolveu resposta invalida.'), { status: 502 });
  }
  const status = String(data.status ?? '').toUpperCase();
  if (status && status !== 'OK') {
    const msg = String(data.message ?? 'Consulta recusada pelo SINTEGRA.');
    // Credito acabado e erro de operacao, nao de dado: precisa aparecer.
    const semCredito = /credito|saldo|limite/i.test(msg);
    throw Object.assign(new Error(msg), { status: semCredito ? 402 : 404 });
  }
  return data;
}

function mapSintegraCnpj(data: SintegraResposta, documento: string): CnpjLookupResult {
  const atividade = (data.atividade_principal as Array<Record<string, unknown>> | undefined)?.[0];
  const secundarias = (data.atividades_secundarias as Array<Record<string, unknown>> | undefined) ?? [];
  const socios = (data.quadro_socios as Array<Record<string, unknown>> | undefined) ?? [];
  const situacao = pickString(data.situacao_cadastral, data.situacao);

  return {
    cnpj: sanitizeDigits(pickString(data.cnpj, documento)),
    razao_social: pickString(data.nome_empresarial, data.razao_social),
    nome_fantasia: pickString(data.nome_fantasia),
    situacao,
    ativa: /ativ/i.test(situacao),
    endereco: {
      logradouro: pickString(data.logradouro),
      numero: pickString(data.numero),
      complemento: pickString(data.complemento),
      bairro: pickString(data.bairro),
      municipio: pickString(data.municipio, data.cidade),
      uf: pickString(data.uf),
      cep: sanitizeDigits(pickString(data.cep)),
      codigo_municipio_ibge: pickString(data.codigo_municipio, data.codigo_ibge) || undefined,
    },
    contato: {
      telefone: pickString(data.telefone),
      email: pickString(data.email),
    },
    porte: pickString(data.porte),
    natureza_juridica: pickString(data.natureza_juridica),
    inscricao_estadual: pickString(data.inscricao_estadual) || undefined,
    cnae_principal: {
      codigo: Number(sanitizeDigits(pickString(atividade?.code, atividade?.codigo))) || 0,
      descricao: pickString(atividade?.text, atividade?.descricao),
    },
    cnaes_secundarios: secundarias.map((a) => ({
      codigo: Number(sanitizeDigits(pickString(a?.code, a?.codigo))) || 0,
      descricao: pickString(a?.text, a?.descricao),
    })),
    socios: socios.map((q) => ({
      nome: pickString(q?.nome, q?.nome_socio),
      qualificacao: pickString(q?.qualificacao, q?.qual),
    })),
    capital_social: Number(String(pickString(data.capital_social)).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0,
    simples_nacional: /sim/i.test(pickString(data.simples_nacional, data.simples)),
    mei: /sim/i.test(pickString(data.mei, data.simei)),
    fonte: 'SINTEGRA WS',
    cached: false,
  };
}

/* ------------------------------------------------------------------ *
 * CNPJá comercial — chave no header Authorization.
 * ------------------------------------------------------------------ */

async function fetchCnpjaComercial(cnpj: string): Promise<Record<string, unknown>> {
  if (!CNPJA_TOKEN) {
    throw Object.assign(new Error('CNPJA_TOKEN nao configurado.'), { status: 501 });
  }
  const { data } = await axios.get(`${CNPJA_COMERCIAL}/office/${cnpj}`, {
    timeout: 15000,
    headers: { Accept: 'application/json', Authorization: CNPJA_TOKEN },
  });
  if (!ehJson(data)) {
    throw Object.assign(new Error('CNPJa devolveu resposta invalida.'), { status: 502 });
  }
  return data;
}

/** Aceita dd/mm/aaaa ou aaaa-mm-dd e devolve no formato do SINTEGRA (dd/mm/aaaa). */
function normalizarData(valor?: string): string | null {
  const v = (valor ?? '').trim();
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return v;
  return null;
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


/**
 * Completa logradouro e número quando as fontes anteriores vieram sem eles.
 *
 * Caso real: o CNPJ 43851429000103 (CASA DA CERVEJA) volta da BrasilAPI com
 * bairro, município, CEP e código IBGE preenchidos e `logradouro: ''`. O
 * cadastro parecia bem-sucedido, o usuário via a mensagem de endereço
 * incompleto e tinha de digitar a rua à mão em toda emissão.
 *
 * Só é chamada quando falta o logradouro: o CNPJá aberto tem limite de
 * requisições, e gastá-lo em consultas já completas o esgotaria à toa.
 *
 * Nunca lança: é enriquecimento. Falhar aqui devolve o que já se tinha, que é
 * exatamente o comportamento de antes desta função existir.
 */
async function completarEnderecoComCnpja(
  clean: string,
  atual: CnpjLookupResult,
): Promise<CnpjLookupResult> {
  if (atual.endereco.logradouro) return atual;

  try {
    const { data } = await axios.get<{
      address?: {
        street?: string; number?: string; details?: string; district?: string;
        city?: string; state?: string; zip?: string;
      };
    }>(`${CNPJA_OPEN}/${clean}`, { timeout: 8000, headers: { Accept: 'application/json' } });

    const endereco = data?.address;
    const logradouro = pickString(endereco?.street);
    if (!logradouro) return atual;

    logger.info('Endereço completado pelo CNPJá', { cnpj: clean });

    return {
      ...atual,
      endereco: {
        ...atual.endereco,
        logradouro,
        // Só preenche o que está faltando: o que veio da Receita tem
        // precedência sobre a base de terceiro.
        numero: atual.endereco.numero || pickString(endereco?.number),
        complemento: atual.endereco.complemento || pickString(endereco?.details),
        bairro: atual.endereco.bairro || pickString(endereco?.district),
      },
      fonte: `${atual.fonte} + CNPJá`,
    };
  } catch (erro) {
    // Limite de requisições, indisponibilidade, CNPJ ausente na base deles.
    logger.warn('CNPJá não completou o endereço', {
      cnpj: clean, motivo: (erro as Error).message,
    });
    return atual;
  }
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

    // 1) SINTEGRA: unica fonte com inscricao estadual, que a NF-e exige quando o
    //    destinatario e contribuinte. Falhou, segue o baile — as outras fontes
    //    resolvem o resto do cadastro.
    if (SINTEGRA_TOKEN) {
      try {
        const sintegra = mapSintegraCnpj(await fetchSintegra({ cnpj: clean, plugin: 'ST' }), clean);
        if (sintegra.razao_social && sintegra.endereco.municipio) {
          const completo = await completarEnderecoComCnpja(clean, sintegra);
          cnpjCache.set(clean, completo);
          return completo;
        }
      } catch (err) {
        const e = err as Error & { status?: number };
        // 402 = sem credito. Precisa gritar no log, senao vira "sistema lento".
        logger.warn('SINTEGRA indisponivel, seguindo para as demais fontes', {
          cnpj: clean,
          status: e.status,
          message: e.message,
        });
      }
    }

    try {
      const raw = await fetchFromTrustcorp('cnpj', clean);
      const trustcorpResult = mapTrustcorpCnpjResponse(raw, clean, false);
      const needsFallback =
        !trustcorpResult.razao_social ||
        !trustcorpResult.endereco.logradouro ||
        !trustcorpResult.endereco.bairro ||
        !trustcorpResult.endereco.municipio ||
        !trustcorpResult.endereco.uf ||
        !trustcorpResult.endereco.cep;

      if (needsFallback) {
        try {
          const { data } = await axios.get<BrasilApiCnpjResponse>(`${BRASIL_API}/${clean}`, {
            timeout: 10000,
            headers: { Accept: 'application/json' },
          });
          const brasilResult = mapBrasilApiResponse(data, false);
          const result = {
            ...brasilResult,
            ...trustcorpResult,
            razao_social: trustcorpResult.razao_social || brasilResult.razao_social,
            nome_fantasia: trustcorpResult.nome_fantasia || brasilResult.nome_fantasia,
            situacao: trustcorpResult.situacao || brasilResult.situacao,
            // BrasilAPI é a fonte oficial (Receita Federal) — tem precedência sobre
            // o parser heurístico do TrustCorp para evitar reportar empresa baixada como ativa.
            ativa: brasilResult.ativa,
            endereco: {
              logradouro: trustcorpResult.endereco.logradouro || brasilResult.endereco.logradouro,
              numero: trustcorpResult.endereco.numero || brasilResult.endereco.numero,
              complemento: trustcorpResult.endereco.complemento || brasilResult.endereco.complemento,
              bairro: trustcorpResult.endereco.bairro || brasilResult.endereco.bairro,
              municipio: trustcorpResult.endereco.municipio || brasilResult.endereco.municipio,
              uf: trustcorpResult.endereco.uf || brasilResult.endereco.uf,
              cep: trustcorpResult.endereco.cep || brasilResult.endereco.cep,
              codigo_municipio_ibge:
                trustcorpResult.endereco.codigo_municipio_ibge
                || brasilResult.endereco.codigo_municipio_ibge,
            },
            contato: {
              telefone: trustcorpResult.contato.telefone || brasilResult.contato.telefone,
              email: trustcorpResult.contato.email || brasilResult.contato.email,
            },
            cnae_principal: {
              codigo: trustcorpResult.cnae_principal.codigo || brasilResult.cnae_principal.codigo,
              descricao: trustcorpResult.cnae_principal.descricao || brasilResult.cnae_principal.descricao,
            },
            cnaes_secundarios: trustcorpResult.cnaes_secundarios.length > 0
              ? trustcorpResult.cnaes_secundarios
              : brasilResult.cnaes_secundarios,
            socios: trustcorpResult.socios.length > 0 ? trustcorpResult.socios : brasilResult.socios,
            capital_social: trustcorpResult.capital_social || brasilResult.capital_social,
            simples_nacional: trustcorpResult.simples_nacional || brasilResult.simples_nacional,
            mei: trustcorpResult.mei || brasilResult.mei,
            fonte: `${trustcorpResult.fonte} + ${brasilResult.fonte}`,
            cached: false,
          } satisfies CnpjLookupResult;
          const completo = await completarEnderecoComCnpja(clean, result);
          cnpjCache.set(clean, completo);
          return completo;
        } catch {
          // Se a fallback falhar, devolve o que TrustCorp conseguiu mapear.
        }
      }

      const completo = await completarEnderecoComCnpja(clean, trustcorpResult);
      cnpjCache.set(clean, completo);
      return completo;
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
      const completo = await completarEnderecoComCnpja(clean, mapBrasilApiResponse(data, false));
      cnpjCache.set(clean, completo);
      return completo;
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

  /**
   * Consulta de CPF.
   *
   * A data de nascimento NAO e capricho do provedor: a Receita so responde
   * consulta de CPF com os dois dados juntos. Nenhum servico contorna isso.
   */
  static async lookupCpf(cpf: string, dataNascimento?: string): Promise<CpfLookupResult> {
    const clean = sanitizeDigits(cpf);
    if (clean.length !== 11) {
      throw Object.assign(new Error('CPF deve ter 11 dígitos'), { status: 400 });
    }
    if (!validateCpfDigits(clean)) {
      throw Object.assign(new Error('CPF inválido (dígitos verificadores incorretos)'), { status: 400 });
    }

    const cached = cpfCache.get<CpfLookupResult>(clean);
    if (cached) return { ...cached, cached: true };

    if (SINTEGRA_TOKEN) {
      const nascimento = normalizarData(dataNascimento);
      if (!nascimento) {
        throw Object.assign(
          new Error('Informe a data de nascimento: a Receita exige CPF e data de nascimento juntos.'),
          { status: 422 },
        );
      }
      const data = await fetchSintegra({ cpf: clean, 'data-nascimento': nascimento, plugin: 'CPF' });
      const situacao = pickString(data.situacao_cadastral, data.situacao);
      const resultado: CpfLookupResult = {
        cpf: clean,
        nome: pickString(data.nome, data.nome_completo),
        situacao,
        ativo: /regular/i.test(situacao),
        data_nascimento: pickString(data.data_nascimento, data['data-nascimento']) || undefined,
        endereco: {},
        fonte: 'SINTEGRA WS',
        cached: false,
      };
      if (!resultado.nome) {
        throw Object.assign(
          new Error('CPF nao encontrado com essa data de nascimento.'),
          { status: 404 },
        );
      }
      cpfCache.set(clean, resultado);
      return resultado;
    }

    const raw = await fetchFromTrustcorp('cpf', clean);
    const result = mapTrustcorpCpfResponse(raw, clean, false);

    // Sem nome nao ha consulta: ha um documento que voltou vazio. Devolver isso
    // como sucesso fazia a nota sair com destinatario em branco — e o cache
    // segurava o erro por 24h, entao tentar de novo nao adiantava.
    if (!result.nome) {
      throw Object.assign(
        new Error('Consulta de CPF nao retornou dados. Preencha os dados do destinatario manualmente.'),
        { status: 502 },
      );
    }

    cpfCache.set(clean, result);
    return result;
  }

  static async lookupDocumento(documento: string, dataNascimento?: string): Promise<DocumentoLookupResult> {
    const clean = sanitizeDigits(documento);
    if (clean.length === 14) {
      return { tipo: 'cnpj', ...(await this.lookup(clean)) };
    }
    if (clean.length === 11) {
      return { tipo: 'cpf', ...(await this.lookupCpf(clean, dataNascimento)) };
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
