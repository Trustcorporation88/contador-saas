/**
 * NF-e Service — Nota Fiscal Eletrônica (Mock SEFAZ Layout 4.00)
 *
 * Implementa o ciclo de vida completo da NF-e:
 *  - Geração de número sequencial por empresa/série
 *  - Geração de chave de acesso (44 dígitos)
 *  - Geração de XML NF-e (layout 4.00 simplificado)
 *  - Mock de autorização/cancelamento SEFAZ
 *
 * ATENÇÃO: Esta é uma integração MOCK para desenvolvimento.
 * Para produção, substituir `mockSefazAuthorize` pela chamada real
 * ao WebService SEFAZ via certificado digital A1/A3.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  CreateNfeDTO,
  NfeItemDTO,
  NfeRecord,
  NfeStatus,
  NfeListFilters,
  SefazResponse,
} from '../models/dtos/nfeDTO';
import { emitirNfeReal, getEmissionMode, getAmbiente } from './nfeEmitter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Gera módulo-11 (dígito verificador da chave de acesso) */
function calcDigitoChave(chave: string): number {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = chave.length - 1; i >= 0; i--) {
    sum += parseInt(chave[i]) * weights[(chave.length - 1 - i) % 8];
  }
  const rem = sum % 11;
  return rem < 2 ? 0 : 11 - rem;
}

/** Gera chave de acesso de 44 dígitos (SEFAZ) */
function gerarChaveAcesso(
  cuf: string,
  aamm: string,
  cnpj: string,
  mod: number,
  serie: number,
  nnf: number,
  tpEmis: number,
  cNF: string,
): string {
  const base =
    cuf.padStart(2, '0') +
    aamm +
    cnpj.padStart(14, '0') +
    String(mod).padStart(2, '0') +
    String(serie).padStart(3, '0') +
    String(nnf).padStart(9, '0') +
    String(tpEmis) +
    cNF.padStart(8, '0');
  return base + calcDigitoChave(base);
}

/** Gera protocolo mock (ano + 15 dígitos aleatórios) */
function gerarProtocolo(): string {
  const ano = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 1e15).toString().padStart(15, '0');
  return `${ano}${rand}`;
}

/** Formata valor para 2 casas em XML */
const fmt2 = (v: number) => v.toFixed(2);
const fmt4 = (v: number) => v.toFixed(4);

// ─── Geração de XML ───────────────────────────────────────────────────────────

function gerarXmlNfe(
  nfe:        NfeRecord,
  dest_email: string | undefined,
  itens:      (NfeItemDTO & { numero_item: number; valor_total: number; valor_icms: number; valor_pis: number; valor_cofins: number })[],
  chave:      string,
): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
  const dtEmissao = now;

  const itensXml = itens.map(item => `
    <det nItem="${item.numero_item}">
      <prod>
        <cProd>${item.codigo_produto}</cProd>
        <xProd>${item.descricao}</xProd>
        <NCM>${item.ncm ?? '00000000'}</NCM>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.unidade ?? 'UN'}</uCom>
        <qCom>${fmt4(item.quantidade)}</qCom>
        <vUnCom>${fmt4(item.valor_unitario)}</vUnCom>
        <vProd>${fmt2(item.valor_total)}</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>${item.cst_icms ?? '00'}</CST>
            <modBC>3</modBC>
            <vBC>${fmt2(item.valor_total)}</vBC>
            <pICMS>${fmt2(item.aliquota_icms ?? 0)}</pICMS>
            <vICMS>${fmt2(item.valor_icms)}</vICMS>
          </ICMS00>
        </ICMS>
        <PIS>
          <PISAliq>
            <CST>${item.cst_pis ?? '01'}</CST>
            <vBC>${fmt2(item.valor_total)}</vBC>
            <pPIS>${fmt2(item.aliquota_pis ?? 0.65)}</pPIS>
            <vPIS>${fmt2(item.valor_pis)}</vPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>${item.cst_cofins ?? '01'}</CST>
            <vBC>${fmt2(item.valor_total)}</vBC>
            <pCOFINS>${fmt2(item.aliquota_cofins ?? 3)}</pCOFINS>
            <vCOFINS>${fmt2(item.valor_cofins)}</vCOFINS>
          </COFINSAliq>
        </COFINS>
      </imposto>
    </det>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe versao="4.00" Id="NFe${chave}">
      <ide>
        <cUF>35</cUF>
        <cNF>${chave.slice(35, 43)}</cNF>
        <natOp>${nfe.natureza_operacao}</natOp>
        <mod>${nfe.modelo}</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dtEmissao}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${chave[43]}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>4.00</verProc>
      </ide>
      <emit>
        <CNPJ>${nfe.emit_cnpj}</CNPJ>
        <xNome>${nfe.emit_razao_social}</xNome>
        <CRT>1</CRT>
      </emit>
      <dest>
        <${nfe.dest_cpf_cnpj.length === 14 ? 'CNPJ' : 'CPF'}>${nfe.dest_cpf_cnpj}</${nfe.dest_cpf_cnpj.length === 14 ? 'CNPJ' : 'CPF'}>
        <xNome>${nfe.dest_razao_social}</xNome>
        ${dest_email ? `<email>${dest_email}</email>` : ''}
        <indIEDest>9</indIEDest>
      </dest>
      ${itensXml}
      <total>
        <ICMSTot>
          <vBC>${fmt2(nfe.valor_produtos)}</vBC>
          <vICMS>${fmt2(nfe.valor_icms)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${fmt2(nfe.valor_produtos)}</vProd>
          <vFrete>${fmt2(nfe.valor_frete)}</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>${fmt2(nfe.valor_desconto)}</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${fmt2(nfe.valor_pis)}</vPIS>
          <vCOFINS>${fmt2(nfe.valor_cofins)}</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${fmt2(nfe.valor_total)}</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <pag>
        <detPag>
          <tPag>01</tPag>
          <vPag>${fmt2(nfe.valor_total)}</vPag>
        </detPag>
      </pag>
      ${nfe.informacoes_adicionais ? `<infAdic><infCpl>${nfe.informacoes_adicionais}</infCpl></infAdic>` : ''}
    </infNFe>
  </NFe>
</nfeProc>`;
}

// ─── Mock SEFAZ ───────────────────────────────────────────────────────────────

async function mockSefazAuthorize(_xml: string): Promise<SefazResponse> {
  // Simula latência SEFAZ (100–300ms)
  await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
  const protocolo = gerarProtocolo();
  return {
    status:   'autorizado',
    codigo:   '100',
    motivo:   'Autorizado o uso da NF-e',
    protocolo,
    dhRecbto: new Date().toISOString(),
  };
}

async function mockSefazCancel(_chave: string, _justificativa: string): Promise<SefazResponse> {
  await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
  return {
    status:   'cancelado',
    codigo:   '101',
    motivo:   'Cancelamento de NF-e homologado',
    protocolo: gerarProtocolo(),
    dhRecbto: new Date().toISOString(),
  };
}

// ─── Cálculo de impostos por item ─────────────────────────────────────────────

function calcularImpostosItem(item: NfeItemDTO): {
  valor_total: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
} {
  const valor_total = item.quantidade * item.valor_unitario;
  const valor_icms  = valor_total * (item.aliquota_icms  ?? 0)    / 100;
  const valor_pis   = valor_total * (item.aliquota_pis   ?? 0.65) / 100;
  const valor_cofins = valor_total * (item.aliquota_cofins ?? 3)   / 100;
  return { valor_total, valor_icms, valor_pis, valor_cofins };
}

// ─── Serviço principal ────────────────────────────────────────────────────────

export class NfeService {

  /** Próximo número de NF-e para empresa/série */
  private static async proximoNumero(
    companyId: string,
    serie: number,
    modelo: number,
  ): Promise<number> {
    const db = await getDatabase();
    const row = await db('nfe_numeracao')
      .where({ company_id: companyId, serie, modelo })
      .first();

    if (!row) {
      await db('nfe_numeracao').insert({
        company_id: companyId,
        serie,
        modelo,
        ultimo_numero: 1,
      });
      return 1;
    }
    const next = row.ultimo_numero + 1;
    await db('nfe_numeracao')
      .where({ company_id: companyId, serie, modelo })
      .update({ ultimo_numero: next });
    return next;
  }

  /**
   * Criar NF-e (status RASCUNHO)
   * Gera XML e chave de acesso mas NÃO envia ao SEFAZ
   */
  static async create(companyId: string, dto: CreateNfeDTO): Promise<NfeRecord> {
    const db = await getDatabase();
    const serie  = dto.serie  ?? 1;
    const modelo = dto.modelo ?? 55;

    // Buscar dados da empresa emitente
    const company = await db('companies').where({ id: companyId }).first();
    if (!company) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });

    const numero = await NfeService.proximoNumero(companyId, serie, modelo);

    // Calcular totais
    const itensCalc = dto.itens.map((item, idx) => ({
      ...item,
      numero_item: idx + 1,
      ...calcularImpostosItem(item),
    }));

    const valor_produtos = itensCalc.reduce((s, i) => s + i.valor_total, 0);
    const valor_icms     = itensCalc.reduce((s, i) => s + i.valor_icms,  0);
    const valor_pis      = itensCalc.reduce((s, i) => s + i.valor_pis,   0);
    const valor_cofins   = itensCalc.reduce((s, i) => s + i.valor_cofins, 0);
    const valor_frete    = dto.valor_frete    ?? 0;
    const valor_desconto = dto.valor_desconto ?? 0;
    const valor_total    = valor_produtos + valor_frete - valor_desconto;

    // Gerar chave de acesso
    const aamm  = new Date().toISOString().slice(2, 7).replace('-', '');
    const cnpj  = (company.cnpj ?? '').replace(/\D/g, '');
    const cNF   = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const chave = gerarChaveAcesso('35', aamm, cnpj, modelo, serie, numero, 1, cNF);

    // Montar registro base para gerar XML
    const nfeBase: NfeRecord = {
      id:               randomUUID(),
      company_id:       companyId,
      numero,
      serie,
      modelo,
      chave_acesso:     chave,
      ambiente:         getAmbiente(),
      emit_cnpj:        cnpj,
      emit_razao_social: company.legal_name ?? company.trade_name ?? company.name,
      dest_cpf_cnpj:    dto.destinatario.cpf_cnpj.replace(/\D/g, ''),
      dest_razao_social: dto.destinatario.razao_social,
      dest_email:       dto.destinatario.email,
      dest_endereco:    JSON.stringify({
        endereco:            dto.destinatario.endereco ?? null,
        inscricao_estadual:  dto.destinatario.inscricao_estadual ?? '',
        indicador_ie:        dto.destinatario.indicador_ie ?? 9,
      }),
      valor_produtos:   parseFloat(valor_produtos.toFixed(2)),
      valor_frete:      parseFloat(valor_frete.toFixed(2)),
      valor_desconto:   parseFloat(valor_desconto.toFixed(2)),
      valor_icms:       parseFloat(valor_icms.toFixed(2)),
      valor_pis:        parseFloat(valor_pis.toFixed(2)),
      valor_cofins:     parseFloat(valor_cofins.toFixed(2)),
      valor_total:      parseFloat(valor_total.toFixed(2)),
      status:           NfeStatus.RASCUNHO,
      natureza_operacao: dto.natureza_operacao ?? 'VENDA',
      informacoes_adicionais: dto.informacoes_adicionais,
      data_emissao:     new Date().toISOString(),
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    };

    const xml = gerarXmlNfe(nfeBase, dto.destinatario.email, itensCalc, chave);

    return await db.transaction(async trx => {
      const [record] = await trx('nfe').insert({
        ...nfeBase,
        xml_nfe: xml,
      }).returning('*');

      await trx('nfe_itens').insert(
        itensCalc.map(item => ({
          nfe_id:          record.id,
          numero_item:     item.numero_item,
          codigo_produto:  item.codigo_produto,
          descricao:       item.descricao,
          ncm:             item.ncm,
          cfop:            item.cfop,
          unidade:         item.unidade ?? 'UN',
          quantidade:      item.quantidade,
          valor_unitario:  item.valor_unitario,
          valor_total:     item.valor_total,
          cst_icms:        item.cst_icms,
          aliquota_icms:   item.aliquota_icms,
          valor_icms:      item.valor_icms,
          cst_pis:         item.cst_pis,
          aliquota_pis:    item.aliquota_pis,
          valor_pis:       item.valor_pis,
          cst_cofins:      item.cst_cofins,
          aliquota_cofins: item.aliquota_cofins,
          valor_cofins:    item.valor_cofins,
        }))
      );

      logger.info('NF-e criada', { id: record.id, numero, chave, companyId });
      return record as NfeRecord;
    });
  }

  /**
   * Autorizar NF-e (envia XML ao SEFAZ mock)
   * Transição: RASCUNHO → AUTORIZADA
   */
  static async authorize(id: string, companyId: string): Promise<NfeRecord> {
    const db = await getDatabase();
    const nfe = await db('nfe').where({ id, company_id: companyId }).first();
    if (!nfe) throw Object.assign(new Error('NF-e não encontrada'), { status: 404 });
    if (nfe.status !== NfeStatus.RASCUNHO) {
      throw Object.assign(
        new Error(`NF-e não pode ser autorizada no status ${nfe.status}`),
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const mode = getEmissionMode();

    // ── Modo real: assina com A1 e transmite à SEFAZ via pynfe ──
    if (mode === 'real') {
      const company = await db('companies').where({ id: companyId }).first();
      if (!company) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
      const itens = await db('nfe_itens').where({ nfe_id: id }).orderBy('numero_item');

      const result = await emitirNfeReal(company, nfe, itens);

      if (!result.ok) {
        // Falha de autorização: registra motivo e mantém como PENDENTE
        await db('nfe').where({ id, company_id: companyId }).update({
          status:        NfeStatus.PENDENTE,
          status_sefaz:  result.cStat,
          status_motivo: result.motivo,
          ambiente:      result.ambiente,
        });
        throw Object.assign(
          new Error(`SEFAZ rejeitou a NF-e (${result.cStat || 's/ código'}): ${result.motivo}`),
          { status: 422 },
        );
      }

      const [updated] = await db('nfe')
        .where({ id, company_id: companyId })
        .update({
          status:           NfeStatus.AUTORIZADA,
          status_sefaz:     result.cStat,
          status_motivo:    result.motivo,
          protocolo:        result.protocolo,
          chave_acesso:     result.chave || nfe.chave_acesso,
          ambiente:         result.ambiente,
          xml_proc:         result.xml_proc,
          data_autorizacao: now,
        })
        .returning('*');

      logger.info('NF-e autorizada (real)', {
        id,
        ambiente: result.ambiente,
        protocolo: result.protocolo,
        cStat: result.cStat,
      });
      return updated as NfeRecord;
    }

    // ── Modo mock: simulador (desenvolvimento) ──
    const sefaz = await mockSefazAuthorize(nfe.xml_nfe);

    const [updated] = await db('nfe')
      .where({ id, company_id: companyId })
      .update({
        status:           NfeStatus.AUTORIZADA,
        status_sefaz:     sefaz.codigo,
        status_motivo:    sefaz.motivo,
        protocolo:        sefaz.protocolo,
        data_autorizacao: now,
      })
      .returning('*');

    logger.info('NF-e autorizada (mock)', { id, protocolo: sefaz.protocolo });
    return updated as NfeRecord;
  }

  /**
   * Cancelar NF-e autorizada
   * Transição: AUTORIZADA → CANCELADA
   * Prazo SEFAZ: até 24h após autorização
   */
  static async cancel(
    id: string,
    companyId: string,
    justificativa: string,
  ): Promise<NfeRecord> {
    const db = await getDatabase();
    if (!justificativa || justificativa.trim().length < 15) {
      throw Object.assign(
        new Error('Justificativa deve ter no mínimo 15 caracteres'),
        { status: 400 },
      );
    }
    const nfe = await db('nfe').where({ id, company_id: companyId }).first();
    if (!nfe) throw Object.assign(new Error('NF-e não encontrada'), { status: 404 });
    if (nfe.status !== NfeStatus.AUTORIZADA) {
      throw Object.assign(
        new Error('Somente NF-e AUTORIZADA pode ser cancelada'),
        { status: 422 },
      );
    }

    const sefaz = await mockSefazCancel(nfe.chave_acesso, justificativa);
    const now   = new Date().toISOString();

    const [updated] = await db('nfe')
      .where({ id, company_id: companyId })
      .update({
        status:                        NfeStatus.CANCELADA,
        status_sefaz:                  sefaz.codigo,
        status_motivo:                 sefaz.motivo,
        data_cancelamento:             now,
        justificativa_cancelamento:    justificativa.trim(),
      })
      .returning('*');

    logger.info('NF-e cancelada', { id, justificativa: justificativa.slice(0, 30) });
    return updated as NfeRecord;
  }

  /** Buscar NF-e por ID */
  static async get(id: string, companyId: string): Promise<NfeRecord & { itens: unknown[] }> {
    const db = await getDatabase();
    const nfe = await db('nfe').where({ id, company_id: companyId }).first();
    if (!nfe) throw Object.assign(new Error('NF-e não encontrada'), { status: 404 });
    const itens = await db('nfe_itens').where({ nfe_id: id }).orderBy('numero_item');
    return { ...nfe, itens };
  }

  /** Listar NF-e com filtros e paginação */
  static async list(
    companyId: string,
    filters: NfeListFilters,
  ): Promise<{ data: NfeRecord[]; total: number; page: number; limit: number }> {
    const db = await getDatabase();
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    let query = db('nfe').where({ company_id: companyId });

    if (filters.status)   query = query.andWhere('status', filters.status);
    if (filters.dateFrom) query = query.andWhere('data_emissao', '>=', filters.dateFrom);
    if (filters.dateTo)   query = query.andWhere('data_emissao', '<=', filters.dateTo);

    const [{ count }] = await query.clone().count<[{ count: string }]>('id as count');
    const data = await query
      .orderBy('data_emissao', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    return { data: data as NfeRecord[], total: parseInt(count), page, limit };
  }

  /** Obter XML da NF-e (para download ou integração) */
  static async getXml(id: string, companyId: string): Promise<string> {
    const db = await getDatabase();
    const nfe = await db('nfe').where({ id, company_id: companyId }).select('xml_nfe', 'status').first();
    if (!nfe) throw Object.assign(new Error('NF-e não encontrada'), { status: 404 });
    if (!nfe.xml_nfe) throw Object.assign(new Error('XML não disponível'), { status: 404 });
    return nfe.xml_nfe as string;
  }
}
