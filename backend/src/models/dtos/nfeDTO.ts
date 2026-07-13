/**
 * NF-e DTOs — Nota Fiscal Eletrônica SEFAZ Layout 4.00
 * Enums, interfaces e tipos para o ciclo de vida da NF-e
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum NfeStatus {
  RASCUNHO   = 'RASCUNHO',
  PENDENTE   = 'PENDENTE',
  AUTORIZADA = 'AUTORIZADA',
  CANCELADA  = 'CANCELADA',
  DENEGADA   = 'DENEGADA',
}

export enum NfeModelo {
  NFE  = 55,  // NF-e padrão
  NFCE = 65,  // NFC-e (consumidor final)
}

// ─── Item da NF-e ────────────────────────────────────────────────────────────

export interface NfeItemDTO {
  codigo_produto:  string;
  descricao:       string;
  ncm?:            string;    // Nomenclatura Comum do Mercosul
  cfop:            string;    // Código Fiscal de Operações (ex: 5102)
  unidade?:        string;    // UN, KG, LT, M2...
  quantidade:      number;
  valor_unitario:  number;
  // Impostos (opcionais — calculados pelo motor se omitidos)
  cst_icms?:       string;
  aliquota_icms?:  number;
  cst_pis?:        string;
  aliquota_pis?:   number;
  cst_cofins?:     string;
  aliquota_cofins?: number;
  // Emissão real (pynfe)
  icms_modalidade?: string;   // CST (2 díg) ou CSOSN (3 díg, Simples)
  icms_origem?:     number;   // 0=Nacional ...
  tributos_aprox?:  number;   // valor aproximado dos tributos
}

// ─── Destinatário ─────────────────────────────────────────────────────────────

export interface NfeDestinatario {
  cpf_cnpj:     string;   // CPF (11 dígitos) ou CNPJ (14 dígitos)
  razao_social: string;
  email?:       string;
  inscricao_estadual?: string;
  indicador_ie?: number;  // 1=Contribuinte, 2=Isento, 9=Não contribuinte
  endereco?: {
    logradouro:  string;
    numero:      string;
    bairro:      string;
    municipio:   string;
    uf:          string;
    cep:         string;
    cod_municipio?: string;  // código IBGE (7 díg)
  };
}

// ─── Criação de NF-e ─────────────────────────────────────────────────────────

export interface CreateNfeDTO {
  serie?:                number;   // padrão: 1
  modelo?:               NfeModelo; // padrão: 55
  natureza_operacao?:    string;   // padrão: "VENDA"
  destinatario:          NfeDestinatario;
  itens:                 NfeItemDTO[];
  valor_frete?:          number;
  valor_desconto?:       number;
  forma_pagamento?:      string;   // tPag: 01=dinheiro, 03=cartão crédito...
  informacoes_adicionais?: string;
}

// ─── Registro NF-e (banco de dados) ──────────────────────────────────────────

export interface NfeRecord {
  id:                    string;
  company_id:            string;
  numero:                number;
  serie:                 number;
  modelo:                number;
  chave_acesso?:         string;
  protocolo?:            string;
  ambiente?:             string;
  xml_proc?:             string;
  dest_endereco?:        string;
  emit_cnpj:             string;
  emit_razao_social:     string;
  dest_cpf_cnpj:         string;
  dest_razao_social:     string;
  dest_email?:           string;
  valor_produtos:        number;
  valor_frete:           number;
  valor_desconto:        number;
  valor_icms:            number;
  valor_pis:             number;
  valor_cofins:          number;
  valor_total:           number;
  status:                NfeStatus;
  status_sefaz?:         string;
  status_motivo?:        string;
  natureza_operacao:     string;
  informacoes_adicionais?: string;
  data_emissao:          string;
  data_autorizacao?:     string;
  data_cancelamento?:    string;
  created_at:            string;
  updated_at:            string;
}

export interface NfeListFilters {
  status?:       NfeStatus;
  dateFrom?:     string;
  dateTo?:       string;
  page?:         number;
  limit?:        number;
}

// ─── Resposta SEFAZ mock ─────────────────────────────────────────────────────

export interface SefazResponse {
  status:   string;
  codigo:   string;           // "100" = autorizado, "101" = cancelado
  motivo:   string;
  protocolo?: string;
  dhRecbto?: string;
}
