import { api } from '../config/api';

export type NfeStatus = 'RASCUNHO' | 'PENDENTE' | 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA';

export interface NfeItemPayload {
  codigo_produto: string;
  descricao: string;
  ncm?: string;
  cfop: string;
  unidade?: string;
  quantidade: number;
  valor_unitario: number;
  cst_icms?: string;
  aliquota_icms?: number;
  aliquota_pis?: number;
  aliquota_cofins?: number;
}

export interface NfeDestinatarioPayload {
  cpf_cnpj: string;
  razao_social: string;
  email?: string;
  inscricao_estadual?: string;
  indicador_ie?: number;
  endereco?: {
    logradouro: string;
    numero: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
    cod_municipio?: string;
  };
}

export interface CreateNfePayload {
  serie?: number;
  modelo?: number;
  natureza_operacao?: string;
  destinatario: NfeDestinatarioPayload;
  itens: NfeItemPayload[];
  valor_frete?: number;
  valor_desconto?: number;
  forma_pagamento?: string;
  informacoes_adicionais?: string;
}

export interface NfeRecord {
  id: string;
  company_id: string;
  numero: number;
  serie: number;
  modelo: number;
  chave_acesso?: string;
  protocolo?: string;
  ambiente?: string;
  emit_cnpj: string;
  emit_razao_social: string;
  dest_cpf_cnpj: string;
  dest_razao_social: string;
  valor_total: number;
  status: NfeStatus;
  status_sefaz?: string;
  status_motivo?: string;
  natureza_operacao: string;
  data_emissao: string;
  data_autorizacao?: string;
  data_cancelamento?: string;
  created_at: string;
}

export interface NfeListResponse {
  data: NfeRecord[];
  total: number;
  page: number;
  limit: number;
}

export class NfeService {
  static base(companyId: string) {
    return `/companies/${companyId}/nfe`;
  }

  static async list(
    companyId: string,
    params: { status?: NfeStatus; page?: number; limit?: number } = {},
  ): Promise<NfeListResponse> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const { data } = await api.get<NfeListResponse>(
      `${this.base(companyId)}${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
    return data;
  }

  static async get(companyId: string, id: string): Promise<NfeRecord & { itens: unknown[] }> {
    const { data } = await api.get<NfeRecord & { itens: unknown[] }>(
      `${this.base(companyId)}/${id}`,
    );
    return data;
  }

  static async create(companyId: string, payload: CreateNfePayload): Promise<NfeRecord> {
    const { data } = await api.post<NfeRecord>(this.base(companyId), payload);
    return data;
  }

  static async authorize(companyId: string, id: string): Promise<NfeRecord> {
    const { data } = await api.post<NfeRecord>(`${this.base(companyId)}/${id}/autorizar`, {});
    return data;
  }

  static async cancel(companyId: string, id: string, justificativa: string): Promise<NfeRecord> {
    const { data } = await api.post<NfeRecord>(`${this.base(companyId)}/${id}/cancelar`, {
      justificativa,
    });
    return data;
  }

  static xmlUrl(companyId: string, id: string): string {
    return `${this.base(companyId)}/${id}/xml`;
  }

  static async downloadXml(companyId: string, id: string): Promise<Blob> {
    const { data } = await api.get(`${this.base(companyId)}/${id}/xml`, {
      responseType: 'blob',
    });
    return data as Blob;
  }
}
