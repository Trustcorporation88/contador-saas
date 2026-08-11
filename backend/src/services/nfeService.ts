/**
 * NF-e Service — Nota Fiscal Eletrônica (Layout SEFAZ 4.00)
 *
 * Implementa o ciclo de vida completo da NF-e:
 *  - Geração de número sequencial por empresa/série
 *  - Geração de chave de acesso (44 dígitos)
 *  - Geração de XML NF-e (layout 4.00 simplificado)
 *  - Autorização e cancelamento junto à SEFAZ
 *
 * Modo de emissão (getEmissionMode(), env NFE_EMISSION_MODE):
 *  - 'real' (padrão): assina com o certificado A1 e transmite de verdade à
 *    SEFAZ via pynfe (nfeEmitter.ts) — tanto na autorização quanto no
 *    cancelamento (evento 110111). Não há nenhuma simulação neste modo.
 *  - 'mock': usa `mockSefazAuthorize`/`mockSefazCancel` abaixo, que geram
 *    protocolos aleatórios sem contato com a SEFAZ. Existe apenas para
 *    desenvolvimento local sem certificado digital — NUNCA deve ser usado
 *    em produção.
 *
 * REFORMA TRIBUTÁRIA: esta nota NÃO destaca IBS, CBS nem Imposto Seletivo.
 * O grupo <gIBSCBS> não é emitido. A justificativa, o que já existe pronto
 * (tabela cClassTrib) e as armadilhas de cálculo estão no comentário dentro
 * do bloco <imposto> em gerarXmlNfe — leia antes de mexer nisso.
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
import {
  emitirNfeReal,
  cancelarNfeReal,
  getEmissionMode,
  getAmbiente,
  verificarNumeracaoSefaz,
  crtFromRegime,
} from './nfeEmitter';

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

/** Código de UF do IBGE (cUF da chave de acesso e do grupo <ide>). */
const CODIGO_UF: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

function codigoUf(uf: string | null | undefined): string {
  return CODIGO_UF[String(uf ?? '').trim().toUpperCase()] ?? '';
}

/**
 * Escapa texto para interpolação segura em XML.
 * Sem isso, uma descrição de produto ou razão social com "&", "<" ou ">"
 * (ex.: "CAFÉ & CIA") gera um XML malformado, que o contador não consegue
 * abrir nem importar no SPED.
 */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Gera protocolo mock (ano + 15 dígitos aleatórios) */
function gerarProtocolo(): string {
  const ano = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 1e15).toString().padStart(15, '0');
  return `${ano}${rand}`;
}

/**
 * tPag aceitos no grupo <pag> da NF-e 4.00 (NT 2020.006).
 * 90 = sem pagamento; 99 = outros.
 */
const FORMAS_PAGAMENTO = new Set([
  '01', '02', '03', '04', '05', '10', '11', '12', '13',
  '15', '16', '17', '18', '19', '90', '99',
]);

function normalizarFormaPagamento(valor: unknown): string {
  const tPag = String(valor ?? '').trim().padStart(2, '0');
  if (!FORMAS_PAGAMENTO.has(tPag)) {
    throw Object.assign(
      new Error(
        `Forma de pagamento inválida ("${String(valor)}"). Use um tPag da NF-e 4.00 (ex.: 01 dinheiro, 03 cartão de crédito, 15 boleto, 17 PIX, 90 sem pagamento).`,
      ),
      { status: 400 },
    );
  }
  return tPag;
}

/** Formata valor para 2 casas em XML */
const fmt2 = (v: number) => v.toFixed(2);
const fmt4 = (v: number) => v.toFixed(4);

// ─── Geração de XML ───────────────────────────────────────────────────────────

/**
 * Data/hora de emissão no formato TData da NF-e (com offset).
 * `toISOString()` cru rotulado como "-03:00" adiantava a hora em 3 horas.
 */
function dhEmi(date: Date, offsetMinutes = -180): string {
  const deslocado = new Date(date.getTime() + offsetMinutes * 60_000);
  const sinal = offsetMinutes <= 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return deslocado.toISOString().replace(/\.\d{3}Z$/, `${sinal}${hh}:${mm}`);
}

type ItemCalculado = NfeItemDTO & {
  numero_item: number;
  valor_total: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
  valor_ipi?: number;
};

/**
 * Grupo de ICMS do item, conforme o regime.
 *
 * Simples Nacional usa CSOSN em <ICMSSN102>, não CST em <ICMS00>. O rascunho
 * emitia ICMS00 com CST para todo mundo, então divergia do XML que o pynfe
 * transmite (que já usava a modalidade 102 para o Simples) — e o XML arquivado
 * para o SPED não era o autorizado.
 */
function grupoIcms(item: ItemCalculado, simplesNacional: boolean): string {
  if (simplesNacional) {
    // CSOSN 102: sem permissão de crédito e sem tributação pelo Simples.
    return `          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>${esc(item.csosn ?? '102')}</CSOSN>
          </ICMSSN102>`;
  }
  return `          <ICMS00>
            <orig>0</orig>
            <CST>${esc(item.cst_icms ?? '00')}</CST>
            <modBC>3</modBC>
            <vBC>${fmt2(item.valor_total)}</vBC>
            <pICMS>${fmt2(item.aliquota_icms ?? 0)}</pICMS>
            <vICMS>${fmt2(item.valor_icms)}</vICMS>
          </ICMS00>`;
}

/** CSTs de IPI que representam operação não tributada (grupo IPINT, sem valor). */
const IPI_CST_NAO_TRIBUTADO = new Set([
  '01', '02', '03', '04', '05', '51', '52', '53', '54', '55',
]);

/**
 * Grupo de IPI do item. Ausente quando não há CST nem alíquota informados —
 * quem não é contribuinte do IPI não destaca o imposto, e o grupo não deve
 * aparecer na nota.
 *
 * A mesma condição e a mesma escolha entre IPITrib e IPINT que o pynfe aplica na
 * emissão real, para o rascunho não mostrar um IPI que a nota autorizada não tem.
 * cEnq 999 = tributação normal (só cigarros e bebidas usam código específico).
 */
function grupoIpi(item: ItemCalculado): string {
  const cst = String(item.cst_ipi ?? '').trim();
  const aliquota = Number(item.aliquota_ipi ?? 0);
  const valor = Number(item.valor_ipi ?? 0);
  const cEnq = esc(item.codigo_enquadramento_ipi ?? '999');

  if (!cst && aliquota <= 0) return '';

  if (IPI_CST_NAO_TRIBUTADO.has(cst)) {
    return `        <IPI>
          <cEnq>${cEnq}</cEnq>
          <IPINT>
            <CST>${esc(cst)}</CST>
          </IPINT>
        </IPI>`;
  }

  // Tributado exige base, alíquota e valor positivos — sem isso a SEFAZ rejeita.
  if (aliquota <= 0 || valor <= 0) return '';

  return `        <IPI>
          <cEnq>${cEnq}</cEnq>
          <IPITrib>
            <CST>${esc(cst || '50')}</CST>
            <vBC>${fmt2(item.valor_total)}</vBC>
            <pIPI>${fmt2(aliquota)}</pIPI>
            <vIPI>${fmt2(valor)}</vIPI>
          </IPITrib>
        </IPI>`;
}

function gerarXmlNfe(
  nfe:        NfeRecord,
  dest_email: string | undefined,
  itens:      ItemCalculado[],
  chave:      string,
  emit:       { uf?: string | null; codigo_municipio?: string | null },
  simplesNacional = false,
  crt = '3',
): string {
  const dtEmissao = dhEmi(new Date(nfe.data_emissao ?? Date.now()));
  const cUF = codigoUf(emit.uf) || chave.slice(0, 2);
  const cMunFG = String(emit.codigo_municipio ?? '').replace(/\D/g, '');
  const tpAmb = nfe.ambiente === 'producao' ? '1' : '2';
  const tPag = String(nfe.forma_pagamento || '01').padStart(2, '0');
  // Somado dos itens e não lido de nfe.valor_ipi: o gerador recebe os itens já
  // calculados, e assim o total do XML nunca diverge das linhas que ele mesmo
  // acabou de escrever.
  const totalIpi = itens.reduce((soma, item) => soma + Number(item.valor_ipi ?? 0), 0);

  // ─── REFORMA TRIBUTÁRIA: por que não há <gIBSCBS> no <imposto> abaixo ───────
  //
  // Situação em 10/08/2026. Leia antes de implementar o destaque de IBS/CBS.
  //
  // POR QUE A NOTA SAI SEM O GRUPO
  // A obrigação legal de informar IBS/CBS existe desde 01/2026 (EC 132/2023 e
  // LC 214/2025). A REJEIÇÃO pela SEFAZ, porém, foi SUSPENSA em 01/08/2026 pelo
  // Ato Técnico Conjunto RFB/CGIBS nº 1/2026 — estava marcada para 03/08/2026.
  // A nota sem o grupo continua sendo autorizada normalmente. A exposição é
  // autuação, não parada de faturamento. Confirme se a suspensão segue valendo
  // antes de decidir a prioridade.
  //
  // O BLOQUEIO TÉCNICO NÃO ESTÁ AQUI
  // A emissão real não usa esta função: usa a pynfe (nfeEmitter.ts →
  // automacao-xml/emitir_nfe.py), e a pynfe 0.6.5 não suporta IBS/CBS. Montar o
  // grupo só aqui seria pior do que não montar: este XML é o RASCUNHO exibido na
  // tela, e o usuário passaria a conferir um documento diferente do transmitido
  // — exatamente o defeito que o grupo de ICMS por regime corrigiu (grupoIcms).
  // Implementar de verdade = fork da pynfe ou serializador próprio.
  //
  // DUAS ARMADILHAS DE CÁLCULO
  // 1. IBS, CBS e IS são "POR FORA": NÃO entram no <vNF>. É o oposto do IPI,
  //    que compõe o total (ver totalIpi acima). Somar IBS/CBS ao vNF infla a
  //    nota e o valor a receber.
  // 2. As reduções vêm em PONTOS PERCENTUAIS na tabela do SVRS (60 = 60%, não
  //    0,6). Ver perc_red_ibs / perc_red_cbs.
  //
  // O QUE JÁ EXISTE PRONTO
  // - fiscal_class_trib (migração 027): tabela cClassTrib sincronizada com o
  //   SVRS por cron diário, viva em produção.
  // - classTribService.validar({ codigo, data, documento: 'NFE' }) responde se o
  //   código vale NA DATA DE EMISSÃO e para NF-e. Use isto: dos 164 códigos
  //   publicados só 97 valem para NF-e, e 3 já foram revogados. NUNCA fixe a
  //   lista em constante — ela muda por ato normativo até 2032.
  // - reformaTributariaService calcula IBS/CBS, mas só atende ao simulador.
  //
  // E valide contra o XSD OFICIAL, não contra blog técnico: a hierarquia das
  // tags do gIBSCBS mudou 11 vezes em 17 meses de revisões da NT.
  // ───────────────────────────────────────────────────────────────────────────

  const itensXml = itens.map(item => `
    <det nItem="${item.numero_item}">
      <prod>
        <cProd>${esc(item.codigo_produto)}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${esc(item.descricao)}</xProd>
        <NCM>${esc(item.ncm ?? '00000000')}</NCM>
        <CFOP>${esc(item.cfop)}</CFOP>
        <uCom>${esc(item.unidade ?? 'UN')}</uCom>
        <qCom>${fmt4(item.quantidade)}</qCom>
        <vUnCom>${fmt4(item.valor_unitario)}</vUnCom>
        <vProd>${fmt2(item.valor_total)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
${grupoIcms(item, simplesNacional)}
        </ICMS>
${grupoIpi(item)}
        <PIS>
          <PISAliq>
            <CST>${esc(item.cst_pis ?? '01')}</CST>
            <vBC>${fmt2(item.valor_total)}</vBC>
            <pPIS>${fmt2(item.aliquota_pis ?? 0.65)}</pPIS>
            <vPIS>${fmt2(item.valor_pis)}</vPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>${esc(item.cst_cofins ?? '01')}</CST>
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
        <cUF>${cUF}</cUF>
        <cNF>${chave.slice(35, 43)}</cNF>
        <natOp>${esc(nfe.natureza_operacao)}</natOp>
        <mod>${nfe.modelo}</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dtEmissao}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${cMunFG}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${chave[43]}</cDV>
        <tpAmb>${tpAmb}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>4.00</verProc>
      </ide>
      <emit>
        <CNPJ>${esc(nfe.emit_cnpj)}</CNPJ>
        <xNome>${esc(nfe.emit_razao_social)}</xNome>
        <CRT>${esc(crt)}</CRT>
      </emit>
      <dest>
        <${nfe.dest_cpf_cnpj.length === 14 ? 'CNPJ' : 'CPF'}>${esc(nfe.dest_cpf_cnpj)}</${nfe.dest_cpf_cnpj.length === 14 ? 'CNPJ' : 'CPF'}>
        <xNome>${esc(nfe.dest_razao_social)}</xNome>
        ${dest_email ? `<email>${esc(dest_email)}</email>` : ''}
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
          <vIPI>${fmt2(totalIpi)}</vIPI>
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
          <tPag>${esc(tPag)}</tPag>
          <vPag>${fmt2(tPag === '90' ? 0 : nfe.valor_total)}</vPag>
        </detPag>
      </pag>
      ${nfe.informacoes_adicionais ? `<infAdic><infCpl>${esc(nfe.informacoes_adicionais)}</infCpl></infAdic>` : ''}
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

/**
 * Arredonda para centavos com meio-para-cima, igual ao ROUND_HALF_UP usado no
 * emissor Python. Somar valores não arredondados e só arredondar o total fazia
 * o valor gravado divergir em centavos do XML autorizado.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Impostos do item, na mesma regra que o emissor usa para montar o XML.
 *
 * No Simples Nacional a nota sai com CSOSN 102 e PIS/COFINS CST 07, todos com
 * valor zero (o imposto está no DAS). O cálculo aqui aplicava 0,65% e 3% de
 * qualquer jeito, então o valor gravado no banco não batia com o documento
 * autorizado e os relatórios mostravam imposto que a nota não tem.
 */
function calcularImpostosItem(
  item: NfeItemDTO,
  simplesNacional: boolean,
): {
  valor_total: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
  valor_ipi: number;
} {
  const valor_total = round2(item.quantidade * item.valor_unitario);
  // IPI independe do regime: quem é contribuinte destaca, quem não é não informa
  // alíquota e o grupo não aparece na nota. Fica de fora do curto-circuito do
  // Simples justamente por isso.
  const valor_ipi = round2(valor_total * (item.aliquota_ipi ?? 0) / 100);

  if (simplesNacional) {
    return { valor_total, valor_icms: 0, valor_pis: 0, valor_cofins: 0, valor_ipi };
  }
  const valor_icms  = round2(valor_total * (item.aliquota_icms   ?? 0) / 100);
  const valor_pis   = round2(valor_total * (item.aliquota_pis    ?? 0) / 100);
  const valor_cofins = round2(valor_total * (item.aliquota_cofins ?? 0) / 100);
  return { valor_total, valor_icms, valor_pis, valor_cofins, valor_ipi };
}

// ─── Serviço principal ────────────────────────────────────────────────────────

export class NfeService {

  /**
   * Validade da trava de transmissão à SEFAZ. Vencida, a nota volta a aceitar
   * nova tentativa — cobre queda do processo no meio da autorização.
   */
  private static readonly TRANSMISSAO_LOCK_MS = 10 * 60 * 1000;

  /** Solta a trava de transmissão (nova tentativa fica liberada). */
  private static async liberarTravaTransmissao(id: string, companyId: string): Promise<void> {
    try {
      const db = await getDatabase();
      await db('nfe').where({ id, company_id: companyId }).update({ transmitindo_em: null });
    } catch (error) {
      logger.warn('Falha ao liberar trava de transmissão da NF-e', {
        id,
        companyId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Maior número de NF-e (série/modelo) emitido por esta empresa e encontrado
   * nas notas capturadas automaticamente da SEFAZ (Distribuição DFe).
   *
   * Cobre o caso de números emitidos fora do ProContador (ex.: outro emissor,
   * emissão manual no portal da SEFAZ) que a captura automática identificou:
   * sem isso, `nfe_numeracao` (que só é atualizada por notas emitidas AQUI)
   * fica desatualizada e o sistema acusa uma "lacuna" para um número que na
   * verdade já existe — mesmo aparecendo na lista de notas capturadas.
   */
  private static async maxNumeroCapturado(
    companyId: string,
    serie: number,
    modelo: number,
  ): Promise<number | null> {
    try {
      const db = await getDatabase();
      const rows = await db('fiscal_xml_captures')
        .where({ company_id: companyId, doc_type: 'nfe', direcao: 'saida' })
        .whereRaw("modelo ~ '^[0-9]+$'")
        .whereRaw("serie ~ '^[0-9]+$'")
        .whereRaw("numero ~ '^[0-9]+$'")
        .andWhereRaw('modelo::int = ?', [modelo])
        .andWhereRaw('serie::int = ?', [serie])
        .select('numero');

      if (!Array.isArray(rows) || rows.length === 0) return null;
      const numeros = rows.map((r) => Number(r.numero)).filter((n) => Number.isFinite(n));
      return numeros.length > 0 ? Math.max(...numeros) : null;
    } catch (error) {
      logger.warn('Falha ao consultar máximo de numeração capturada da SEFAZ', {
        companyId,
        serie,
        modelo,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /** Verifica se um número/série/modelo específico já aparece nas notas capturadas da SEFAZ. */
  private static async numeroJaCapturado(
    companyId: string,
    serie: number,
    modelo: number,
    numero: number,
  ): Promise<boolean> {
    try {
      const db = await getDatabase();
      const row = await db('fiscal_xml_captures')
        .where({ company_id: companyId, doc_type: 'nfe', direcao: 'saida' })
        .whereRaw("modelo ~ '^[0-9]+$'")
        .whereRaw("serie ~ '^[0-9]+$'")
        .whereRaw("numero ~ '^[0-9]+$'")
        .andWhereRaw('modelo::int = ?', [modelo])
        .andWhereRaw('serie::int = ?', [serie])
        .andWhereRaw('numero::int = ?', [numero])
        .first();
      return Boolean(row);
    } catch (error) {
      logger.warn('Falha ao consultar captura da SEFAZ por número', {
        companyId,
        serie,
        modelo,
        numero,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Próximo número de NF-e para empresa/série.
   *
   * A reserva é feita em um único UPDATE ... RETURNING, atômico no banco. Ler
   * o contador e gravar depois deixava duas emissões simultâneas pegarem o
   * mesmo número: a segunda estourava na constraint única como erro 500, ou
   * (pior) as duas iam para a SEFAZ com o mesmo número.
   */
  private static async proximoNumero(
    companyId: string,
    serie: number,
    modelo: number,
  ): Promise<number> {
    const db = await getDatabase();
    const capturado = await NfeService.maxNumeroCapturado(companyId, serie, modelo);
    const piso = Math.max(capturado ?? 0, 0);

    const reservado = await db('nfe_numeracao')
      .where({ company_id: companyId, serie, modelo })
      .update({
        // GREATEST cobre o caso de nota emitida fora do ProContador com número
        // maior que o contador local.
        ultimo_numero: db.raw('GREATEST(ultimo_numero, ?) + 1', [piso]),
      })
      .returning('ultimo_numero');

    const numero = Array.isArray(reservado) && reservado.length > 0
      ? Number(
        typeof reservado[0] === 'object'
          ? (reservado[0] as { ultimo_numero: number | string }).ultimo_numero
          : reservado[0],
      )
      : NaN;

    if (Number.isFinite(numero) && numero > 0) return numero;

    // Primeira nota da série: cria a linha. onConflict cobre duas requisições
    // simultâneas chegando aqui juntas — a perdedora incrementa a linha da
    // vencedora em vez de falhar.
    const inicial = piso + 1;
    const [criado] = await db('nfe_numeracao')
      .insert({ company_id: companyId, serie, modelo, ultimo_numero: inicial })
      .onConflict(['company_id', 'serie', 'modelo'])
      .merge({ ultimo_numero: db.raw('GREATEST(nfe_numeracao.ultimo_numero, ?) + 1', [piso]) })
      .returning('ultimo_numero');

    return Number(
      typeof criado === 'object'
        ? (criado as { ultimo_numero: number | string }).ultimo_numero
        : criado,
    );
  }

  /** Atualiza contador local para não regredir após número manual. */
  private static async sincronizarNumeracao(
    companyId: string,
    serie: number,
    modelo: number,
    numeroUsado: number,
  ): Promise<void> {
    const db = await getDatabase();
    const row = await db('nfe_numeracao')
      .where({ company_id: companyId, serie, modelo })
      .first();
    if (!row) {
      await db('nfe_numeracao').insert({
        company_id: companyId,
        serie,
        modelo,
        ultimo_numero: numeroUsado,
      });
      return;
    }
    if (Number(row.ultimo_numero) < numeroUsado) {
      await db('nfe_numeracao')
        .where({ company_id: companyId, serie, modelo })
        .update({ ultimo_numero: numeroUsado });
    }
  }

  /**
   * Valida número/série: base local + SEFAZ (status; consulta por chave se existir).
   */
  static async verificarNumeracao(
    companyId: string,
    opts: { serie: number; numero: number; modelo?: number },
  ) {
    const db = await getDatabase();
    const serie = opts.serie;
    const numero = opts.numero;
    const modelo = opts.modelo ?? 55;

    if (!Number.isInteger(serie) || serie < 1 || serie > 999) {
      throw Object.assign(new Error('Série inválida (1–999).'), { status: 400 });
    }
    if (!Number.isInteger(numero) || numero < 1) {
      throw Object.assign(new Error('Número da NF-e inválido.'), { status: 400 });
    }

    const company = await db('companies').where({ id: companyId }).first();
    if (!company) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });

    const local = await db('nfe')
      .where({ company_id: companyId, serie, modelo, numero })
      .first();

    // AUTORIZADA/CANCELADA/DENEGADA ocupam o número de forma definitiva.
    // RASCUNHO/PENDENTE são reutilizáveis: o usuário pode atualizar os dados
    // e reenviar à SEFAZ (senão o número fica eternamente travado — bug 823).
    let chaveLocal: string | null = null;
    const jaEmitidaLocal = Boolean(local);
    const localReutilizavel =
      !!local &&
      (local.status === NfeStatus.PENDENTE || local.status === NfeStatus.RASCUNHO);
    const localBloqueante = jaEmitidaLocal && !localReutilizavel;
    if (local) {
      chaveLocal = local.chave_acesso || null;
    }

    // Ordem cronológica: compara com o último número já confirmado nesta série/modelo.
    // A SEFAZ não oferece consulta pública "por número" (só por chave de acesso),
    // então a garantia de sequência combina o contador local (notas emitidas
    // AQUI) com o maior número já visto nas notas capturadas da SEFAZ — senão o
    // sistema acusa uma "lacuna" para números que na verdade já foram emitidos
    // (só que por fora do ProContador) e aparecem na lista de capturas.
    const numeracao = await db('nfe_numeracao')
      .where({ company_id: companyId, serie, modelo })
      .first();
    const maxCapturado = await NfeService.maxNumeroCapturado(companyId, serie, modelo);

    // Notas emitidas pela própria empresa fora do ProContador (outro emissor,
    // portal da SEFAZ, etc.) e trazidas pela captura automática (Distribuição
    // DFe) também ocupam o número, mesmo sem registro na tabela `nfe` local.
    //
    // A consulta vale também quando existe registro local reutilizável: é
    // exatamente o caso da nota que ficou PENDENTE porque a resposta da SEFAZ
    // se perdeu, mas foi autorizada de verdade e voltou na captura. Antes a
    // checagem era pulada sempre que havia registro local, o número era dado
    // como livre e a reemissão levava cStat 539 (duplicidade).
    const jaEmitidaCapturada =
      !jaEmitidaLocal || localReutilizavel
        ? await NfeService.numeroJaCapturado(companyId, serie, modelo, numero)
        : false;
    let ultimoNumeroRegistrado: number | null = numeracao
      ? Number(numeracao.ultimo_numero)
      : null;
    if (maxCapturado != null) {
      ultimoNumeroRegistrado =
        ultimoNumeroRegistrado != null
          ? Math.max(ultimoNumeroRegistrado, maxCapturado)
          : maxCapturado;
    }
    const foraDeOrdem =
      ultimoNumeroRegistrado != null &&
      numero <= ultimoNumeroRegistrado &&
      !jaEmitidaLocal &&
      !jaEmitidaCapturada;
    const saltoNumeracao =
      ultimoNumeroRegistrado != null && numero > ultimoNumeroRegistrado + 1;

    const sefaz = await verificarNumeracaoSefaz({
      companyId,
      uf: String(company.state || ''),
      serie,
      numero,
      modelo,
      chave: chaveLocal,
    });

    const jaEmitidaSefaz = sefaz.ja_emitida_sefaz === true;
    // SEFAZ offline / status ilegível não deve travar número livre: a autorização
    // real confirma na SEFAZ. Antes, parse frágil de status gerava "fora de operação".
    const disponivelBase =
      !localBloqueante &&
      !jaEmitidaCapturada &&
      !jaEmitidaSefaz &&
      !foraDeOrdem;
    // RASCUNHO/PENDENTE: liberar reemissão mesmo se a consulta SEFAZ vier
    // ambígua/offline — a autorização real confirma. Bloqueia apenas quando há
    // confirmação de que a nota existe na SEFAZ: consulta por chave
    // (ja_emitida_sefaz) ou XML já capturado para o mesmo número.
    const disponivel = localReutilizavel
      ? !jaEmitidaSefaz && !jaEmitidaCapturada
      : disponivelBase &&
        (sefaz.disponivel === true ||
          sefaz.disponivel === null ||
          sefaz.disponivel === undefined);

    let mensagem: string;
    if (localReutilizavel && jaEmitidaCapturada) {
      // A tentativa anterior chegou a ser autorizada — só a resposta se perdeu.
      // Reenviar aqui resultaria em cStat 539 (duplicidade).
      mensagem =
        `Número ${numero} série ${serie} está ${local.status} no ProContador, mas a SEFAZ já ` +
        'tem uma NF-e autorizada com esse número (encontrada nas notas capturadas): a emissão '
        + 'anterior foi concluída e só a resposta se perdeu. Não reenvie — use o próximo número livre.';
    } else if (localReutilizavel && jaEmitidaSefaz) {
      mensagem =
        `Número ${numero} série ${serie} está ${local.status} no ProContador, mas a SEFAZ confirma `
        + 'NF-e já autorizada com essa chave. Não reenvie — use o próximo número livre.';
    } else if (localReutilizavel) {
      mensagem =
        `Número ${numero} série ${serie} está ${local.status} no ProContador ` +
        '(emissão anterior incompleta). Confirme para atualizar os dados e reenviar à SEFAZ.';
    } else if (localBloqueante) {
      mensagem = `Número ${numero} série ${serie} já existe no ProContador (status ${local.status}).`;
    } else if (jaEmitidaCapturada) {
      mensagem = `Número ${numero} série ${serie} já foi emitido por esta empresa — encontrado nas notas capturadas da SEFAZ. Escolha outro número.`;
    } else if (jaEmitidaSefaz) {
      mensagem = `SEFAZ confirma NF-e já emitida para número ${numero} série ${serie}.`;
    } else if (foraDeOrdem) {
      mensagem = `Fora de ordem cronológica: o último número confirmado nesta série foi ${ultimoNumeroRegistrado}. Use um número maior que ${ultimoNumeroRegistrado}.`;
    } else if (!sefaz.sefaz_online && disponivelBase) {
      mensagem =
        `Número ${numero}/${serie} livre na base local. Aviso: consulta de status SEFAZ ` +
        `indisponível (${sefaz.motivo || 'sem detalhe'}). Você pode emitir — a SEFAZ confirma na autorização.`;
    } else if (!sefaz.sefaz_online) {
      mensagem = `SEFAZ offline: ${sefaz.motivo}`;
    } else if (saltoNumeracao) {
      mensagem = `Atenção: há uma lacuna entre o último número emitido (${ultimoNumeroRegistrado}) e o número ${numero}. Se os números ${ultimoNumeroRegistrado! + 1} a ${numero - 1} não forem usados em outro sistema, eles precisarão ser inutilizados junto à SEFAZ.`;
    } else if (sefaz.ja_emitida_sefaz === null) {
      mensagem = `Número ${numero}/${serie} livre na base local e em ordem cronológica. ${sefaz.motivo}`;
    } else {
      mensagem = `Número ${numero}/${serie} disponível e em ordem cronológica.`;
    }

    return {
      disponivel,
      reutilizavel: localReutilizavel,
      serie,
      numero,
      modelo,
      ultimo_numero_registrado: ultimoNumeroRegistrado,
      fora_de_ordem: foraDeOrdem,
      salto_numeracao: saltoNumeracao,
      ja_emitida_capturada: jaEmitidaCapturada,
      local: local
        ? {
          id: local.id,
          status: local.status,
          chave_acesso: local.chave_acesso,
          data_emissao: local.data_emissao,
        }
        : null,
      sefaz: {
        online: sefaz.sefaz_online,
        ja_emitida: sefaz.ja_emitida_sefaz,
        cStat: sefaz.cStat,
        motivo: sefaz.motivo,
        fonte: sefaz.fonte,
      },
      mensagem,
    };
  }

  /**
   * Checagens que não dependem de acesso ao banco: destinatário e itens.
   * Rodam antes da reserva de numeração para não queimar um número da série.
   */
  private static validarDadosBasicos(dto: CreateNfeDTO): void {
    if (!Array.isArray(dto.itens) || dto.itens.length === 0) {
      throw Object.assign(
        new Error('Informe pelo menos um item na NF-e.'),
        { status: 400 },
      );
    }

    const documento = String(dto.destinatario?.cpf_cnpj ?? '').replace(/\D/g, '');
    if (documento.length !== 11 && documento.length !== 14) {
      throw Object.assign(
        new Error(
          `Documento do destinatário inválido: use 11 dígitos (CPF) ou 14 (CNPJ). Você enviou ${documento.length} dígito(s).`,
        ),
        { status: 400 },
      );
    }

    if (!String(dto.destinatario?.razao_social ?? '').trim()) {
      throw Object.assign(
        new Error('Informe a razão social / nome do destinatário.'),
        { status: 400 },
      );
    }

    const natureza = String(dto.natureza_operacao ?? '').trim();
    if (natureza.length > 60) {
      throw Object.assign(
        new Error('Natureza da operação deve ter no máximo 60 caracteres.'),
        { status: 400 },
      );
    }
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

    // Valida ANTES de reservar o número: um erro depois da reserva consome um
    // número da série e deixa uma lacuna que precisaria ser inutilizada na SEFAZ.
    NfeService.validarDadosBasicos(dto);

    let numero: number;
    if (dto.numero != null) {
      if (!dto.confirmar_numero_manual) {
        throw Object.assign(
          new Error(
            'Para informar o número manualmente, confirme o campo confirmar_numero_manual=true após validar no SEFAZ.',
          ),
          { status: 400 },
        );
      }
      const check = await NfeService.verificarNumeracao(companyId, {
        serie,
        numero: Number(dto.numero),
        modelo,
      });
      if (!check.disponivel) {
        throw Object.assign(new Error(check.mensagem), { status: 409 });
      }
      numero = Number(dto.numero);
      await NfeService.sincronizarNumeracao(companyId, serie, modelo, numero);
    } else {
      numero = await NfeService.proximoNumero(companyId, serie, modelo);
    }

    // Mesma decisão de regime usada pelo emissor: no Simples a nota sai com
    // CSOSN 102 e PIS/COFINS zerados, e o valor gravado tem que acompanhar.
    const simplesNacional = crtFromRegime(company.tax_regime, company.crt) === '1';

    // Calcular totais — NCM no banco é VARCHAR(8) só dígitos (ex.: 84212300)
    const itensCalc = dto.itens.map((item, idx) => {
      const ncm = String(item.ncm ?? '')
        .replace(/\D/g, '')
        .slice(0, 8);
      const cfop = String(item.cfop ?? '')
        .replace(/\D/g, '')
        .slice(0, 4);
      // NCM é obrigatório na NF-e. Vazio virava "00000000" no emissor e a SEFAZ
      // rejeitava com mensagem genérica, longe do campo que o usuário errou.
      if (ncm.length !== 8) {
        throw Object.assign(
          new Error(
            `NCM obrigatório no item ${idx + 1}: informe os 8 dígitos (ex.: 84212300)${item.ncm ? `. Você enviou "${item.ncm}"` : ''}.`,
          ),
          { status: 400 },
        );
      }
      if (!cfop || cfop.length !== 4) {
        throw Object.assign(
          new Error(`CFOP inválido no item ${idx + 1}: use 4 dígitos (ex.: 5102).`),
          { status: 400 },
        );
      }
      if (!String(item.descricao ?? '').trim()) {
        throw Object.assign(
          new Error(`Descrição obrigatória no item ${idx + 1}.`),
          { status: 400 },
        );
      }
      if (!(Number(item.quantidade) > 0)) {
        throw Object.assign(
          new Error(`Quantidade do item ${idx + 1} deve ser maior que zero.`),
          { status: 400 },
        );
      }
      if (!(Number(item.valor_unitario) >= 0)) {
        throw Object.assign(
          new Error(`Valor unitário inválido no item ${idx + 1}.`),
          { status: 400 },
        );
      }
      const normalized = { ...item, ncm, cfop };
      return {
        ...normalized,
        numero_item: idx + 1,
        ...calcularImpostosItem(normalized, simplesNacional),
      };
    });

    const valor_produtos = round2(itensCalc.reduce((s, i) => s + i.valor_total, 0));
    const valor_icms     = round2(itensCalc.reduce((s, i) => s + i.valor_icms,  0));
    const valor_pis      = round2(itensCalc.reduce((s, i) => s + i.valor_pis,   0));
    const valor_cofins   = round2(itensCalc.reduce((s, i) => s + i.valor_cofins, 0));
    const valor_ipi      = round2(itensCalc.reduce((s, i) => s + (i.valor_ipi ?? 0), 0));
    const valor_frete    = round2(dto.valor_frete    ?? 0);
    const valor_desconto = round2(dto.valor_desconto ?? 0);
    if (valor_frete < 0 || valor_desconto < 0) {
      throw Object.assign(
        new Error('Frete e desconto não podem ser negativos.'),
        { status: 400 },
      );
    }
    if (valor_desconto > valor_produtos + valor_frete) {
      throw Object.assign(
        new Error(
          `Desconto (R$ ${valor_desconto.toFixed(2)}) é maior que o total dos produtos mais o frete (R$ ${(valor_produtos + valor_frete).toFixed(2)}).`,
        ),
        { status: 400 },
      );
    }
    // vNF = vProd + vFrete − vDesc + vIPI (NF-e 4.00). O IPI compõe o total da
    // nota; ICMS/PIS/COFINS não, porque já estão dentro do preço. Sem IPI
    // informado, valor_ipi é zero e o total fica idêntico ao de antes.
    const valor_total    = round2(valor_produtos + valor_frete - valor_desconto + valor_ipi);

    // Gerar chave de acesso. O cUF vem da UF da empresa: com '35' fixo, a chave
    // do rascunho saía com o código de São Paulo para empresa de qualquer estado.
    const cUF = codigoUf(company.state);
    if (!cUF) {
      throw Object.assign(
        new Error(
          'UF da empresa inválida ou não cadastrada. Informe a UF (sigla de 2 letras) no cadastro da empresa antes de emitir NF-e.',
        ),
        { status: 422 },
      );
    }
    const emissao = new Date();
    const aamm  = dhEmi(emissao).slice(2, 7).replace('-', '');
    const cnpj  = (company.cnpj ?? '').replace(/\D/g, '');
    const cNF   = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const chave = gerarChaveAcesso(cUF, aamm, cnpj, modelo, serie, numero, 1, cNF);

    // Se já existe RASCUNHO/PENDENTE com este número, atualiza em vez de
    // inserir (evita unique conflict e destrava emissão após falha anterior).
    const existente = await db('nfe')
      .where({ company_id: companyId, serie, modelo, numero })
      .first();
    const reutilizarId =
      existente &&
      (existente.status === NfeStatus.PENDENTE || existente.status === NfeStatus.RASCUNHO)
        ? String(existente.id)
        : null;

    // Montar registro base para gerar XML
    const nfeBase: NfeRecord = {
      id:               reutilizarId || randomUUID(),
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
      forma_pagamento:  normalizarFormaPagamento(dto.forma_pagamento ?? '01'),
      informacoes_adicionais: dto.informacoes_adicionais,
      data_emissao:     emissao.toISOString(),
      created_at:       reutilizarId ? existente.created_at : emissao.toISOString(),
      updated_at:       emissao.toISOString(),
    };

    const xml = gerarXmlNfe(nfeBase, dto.destinatario.email, itensCalc, chave, {
      uf: company.state,
      codigo_municipio: company.codigo_municipio,
    }, simplesNacional, crtFromRegime(company.tax_regime));

    return await db.transaction(async trx => {
      let record: NfeRecord;

      if (reutilizarId) {
        const [updated] = await trx('nfe')
          .where({ id: reutilizarId, company_id: companyId })
          .update({
            chave_acesso: nfeBase.chave_acesso,
            ambiente: nfeBase.ambiente,
            emit_cnpj: nfeBase.emit_cnpj,
            emit_razao_social: nfeBase.emit_razao_social,
            dest_cpf_cnpj: nfeBase.dest_cpf_cnpj,
            dest_razao_social: nfeBase.dest_razao_social,
            dest_email: nfeBase.dest_email,
            dest_endereco: nfeBase.dest_endereco,
            valor_produtos: nfeBase.valor_produtos,
            valor_frete: nfeBase.valor_frete,
            valor_desconto: nfeBase.valor_desconto,
            valor_icms: nfeBase.valor_icms,
            valor_pis: nfeBase.valor_pis,
            valor_cofins: nfeBase.valor_cofins,
            valor_total: nfeBase.valor_total,
            status: NfeStatus.RASCUNHO,
            status_sefaz: null,
            status_motivo: null,
            protocolo: null,
            natureza_operacao: nfeBase.natureza_operacao,
            forma_pagamento: nfeBase.forma_pagamento,
            informacoes_adicionais: nfeBase.informacoes_adicionais,
            data_emissao: nfeBase.data_emissao,
            xml_nfe: xml,
            updated_at: nfeBase.updated_at,
          })
          .returning('*');
        await trx('nfe_itens').where({ nfe_id: reutilizarId }).del();
        record = updated as NfeRecord;
        logger.info('NF-e PENDENTE/RASCUNHO reutilizada', {
          id: reutilizarId,
          numero,
          chave,
          companyId,
        });
      } else {
        const [inserted] = await trx('nfe').insert({
          ...nfeBase,
          xml_nfe: xml,
        }).returning('*');
        record = inserted as NfeRecord;
        logger.info('NF-e criada', { id: record.id, numero, chave, companyId });
      }

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
          // As colunas aliquota_ipi/valor_ipi existiam desde a criação da tabela
          // sem nada que as gravasse. Sem persistir, o valor do IPI da nota
          // autorizada não aparecia em relatório nem no SPED.
          aliquota_ipi:    item.aliquota_ipi ?? 0,
          valor_ipi:       item.valor_ipi ?? 0,
        })),
      );

      return record;
    });
  }

  /**
   * Autorizar NF-e junto à SEFAZ (ou simulador em modo mock).
   * Transições: RASCUNHO → AUTORIZADA | PENDENTE → AUTORIZADA (nova tentativa)
   *
   * PENDENTE é aceito aqui de propósito: é o status que a nota fica quando
   * uma tentativa anterior falhou (SEFAZ rejeitou, rede caiu, etc.) — sem
   * isso, uma nota que falhou uma vez travava para sempre (nunca virava
   * AUTORIZADA nem podia ser cancelada, já que cancel() exige AUTORIZADA),
   * e o número/série ficava bloqueado sem nenhuma saída para o usuário.
   */
  static async authorize(id: string, companyId: string): Promise<NfeRecord> {
    const db = await getDatabase();
    const nfe = await db('nfe').where({ id, company_id: companyId }).first();
    if (!nfe) throw Object.assign(new Error('NF-e não encontrada'), { status: 404 });
    if (nfe.status !== NfeStatus.RASCUNHO && nfe.status !== NfeStatus.PENDENTE) {
      throw Object.assign(
        new Error(`NF-e não pode ser autorizada no status ${nfe.status}`),
        { status: 422 },
      );
    }

    // Trava a nota para esta tentativa em um único UPDATE condicional. Dois
    // cliques em "Autorizar" (ou duas requisições) passavam pela checagem acima
    // antes de qualquer gravação e transmitiam a MESMA nota duas vezes à SEFAZ —
    // a segunda voltava como duplicidade 539.
    //
    // A trava é um timestamp com expiração, não um status novo: se o processo
    // morrer no meio da transmissão, a nota se destrava sozinha em vez de ficar
    // presa em um estado do qual nem authorize() nem cancel() a tiram.
    const travaExpiraEmMs = NfeService.TRANSMISSAO_LOCK_MS;
    const travou = await db('nfe')
      .where({ id, company_id: companyId })
      .where((qb) =>
        qb
          .whereNull('transmitindo_em')
          .orWhere('transmitindo_em', '<', new Date(Date.now() - travaExpiraEmMs)),
      )
      .update({ transmitindo_em: new Date() });

    if (!travou) {
      throw Object.assign(
        new Error(
          'Esta NF-e já está sendo transmitida à SEFAZ. Aguarde o resultado antes de tentar de novo.',
        ),
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const mode = getEmissionMode();

    // ── Modo real: assina com A1 e transmite à SEFAZ via pynfe ──
    if (mode === 'real') {
      const company = await db('companies').where({ id: companyId }).first();
      if (!company) {
        await NfeService.liberarTravaTransmissao(id, companyId);
        throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
      }
      const itens = await db('nfe_itens').where({ nfe_id: id }).orderBy('numero_item');

      let result;
      try {
        result = await emitirNfeReal(company, nfe, itens);
      } catch (error) {
        await NfeService.liberarTravaTransmissao(id, companyId);
        throw error;
      }

      if (!result.ok) {
        // Falha de autorização: registra motivo e mantém como PENDENTE
        await db('nfe').where({ id, company_id: companyId }).update({
          status:        NfeStatus.PENDENTE,
          status_sefaz:  result.cStat,
          status_motivo: result.motivo,
          ambiente:      result.ambiente,
          transmitindo_em: null,
        });
        const dup =
          result.cStat === '539' ||
          /duplicidade/i.test(result.motivo || '');
        throw Object.assign(
          new Error(
            dup
              ? `Número/série já emitido na SEFAZ (cStat ${result.cStat}): ${result.motivo}. Escolha o próximo número livre.`
              : `SEFAZ rejeitou a NF-e (${result.cStat || 's/ código'}): ${result.motivo}`,
          ),
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
          transmitindo_em:  null,
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
        transmitindo_em:  null,
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

    const now = new Date().toISOString();
    const mode = getEmissionMode();

    // ── Modo real: envia o evento de cancelamento (110111) de verdade à SEFAZ ──
    if (mode === 'real') {
      const company = await db('companies').where({ id: companyId }).first();
      if (!company) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });

      const result = await cancelarNfeReal(
        company,
        { chave_acesso: nfe.chave_acesso, protocolo: nfe.protocolo, modelo: nfe.modelo },
        justificativa.trim(),
      );

      if (!result.ok) {
        throw Object.assign(
          new Error(
            `SEFAZ rejeitou o cancelamento (${result.cStat || 's/ código'}): ${result.motivo}`,
          ),
          { status: 422 },
        );
      }

      const [updated] = await db('nfe')
        .where({ id, company_id: companyId })
        .update({
          status:                     NfeStatus.CANCELADA,
          status_sefaz:               result.cStat,
          status_motivo:              result.motivo,
          xml_cancelamento:           result.xml_evento,
          data_cancelamento:          now,
          justificativa_cancelamento: justificativa.trim(),
        })
        .returning('*');

      logger.info('NF-e cancelada (real)', {
        id,
        cStat: result.cStat,
        justificativa: justificativa.slice(0, 30),
      });
      return updated as NfeRecord;
    }

    // ── Modo mock: simulador (desenvolvimento) ──
    const sefaz = await mockSefazCancel(nfe.chave_acesso, justificativa);

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

    logger.info('NF-e cancelada (mock)', { id, justificativa: justificativa.slice(0, 30) });
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

  /**
   * Obter XML da NF-e (para download ou integração).
   *
   * Para nota AUTORIZADA devolve o `xml_proc` — o nfeProc assinado e com o
   * protocolo da SEFAZ, que é o documento com valor fiscal e o único aceito
   * pela contabilidade/SPED. O `xml_nfe` é apenas a prévia do rascunho gerada
   * localmente (não assinada), e servi-la como se fosse a nota autorizada
   * entregava ao usuário um arquivo sem validade.
   */
  static async getXml(id: string, companyId: string): Promise<string> {
    const db = await getDatabase();
    const nfe = await db('nfe')
      .where({ id, company_id: companyId })
      .select('xml_nfe', 'xml_proc', 'status')
      .first();
    if (!nfe) throw Object.assign(new Error('NF-e não encontrada'), { status: 404 });
    if (nfe.xml_proc) return nfe.xml_proc as string;
    if (nfe.status === NfeStatus.AUTORIZADA) {
      throw Object.assign(
        new Error(
          'XML autorizado (nfeProc) não disponível para esta NF-e. Baixe o XML pelo portal da SEFAZ ou reprocesse a autorização.',
        ),
        { status: 404 },
      );
    }
    if (!nfe.xml_nfe) throw Object.assign(new Error('XML não disponível'), { status: 404 });
    return nfe.xml_nfe as string;
  }
}
