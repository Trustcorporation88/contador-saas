/**
 * Sincronização da tabela de Classificação Tributária (cClassTrib) com o SVRS.
 *
 * Fonte: https://dfe-portal.svrs.rs.gov.br/Dfe/ClassificacaoTributaria
 *
 * O portal não publica endpoint JSON aberto: a página monta as tabelas no
 * navegador a partir de um array embutido (`var dadosOriginais = [...]`), e o
 * próprio botão "Exportar JSON" da página serializa esse mesmo array no cliente.
 * Ou seja, o que este serviço lê É a fonte do export oficial — não é um HTML
 * raspado com regex de <td>, é o payload estruturado antes da renderização.
 *
 * Isso torna o parse sensível a mudanças de layout da página, e é exatamente por
 * isso que existem o piso de sanidade e o log de sincronização abaixo: quando o
 * SVRS mudar a página, o sync tem de FALHAR VISÍVEL, não silenciosamente
 * substituir 164 códigos por zero.
 *
 * Três invariantes, em ordem de importância:
 *
 * 1. NUNCA esvaziar a tabela. Não há DELETE nem TRUNCATE aqui. Uma tabela de
 *    referência vazia derruba a validação de toda emissão; uma tabela
 *    desatualizada, não. O modo de falha tem de ser o menos danoso.
 *
 * 2. NUNCA apagar um código que sumiu da origem. Notas já emitidas o
 *    referenciam, e sem a linha não há como reconstituir a validação daquela
 *    emissão numa fiscalização. Marca-se `ausente_na_origem_desde`.
 *
 * 3. Toda tentativa é registrada, inclusive a que falhou. Sem log, "tabela
 *    correta e estável" e "sync quebrado há três meses" são indistinguíveis.
 */

import { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';

export const URL_SVRS = 'https://dfe-portal.svrs.rs.gov.br/Dfe/ClassificacaoTributaria';

/** Marcador do array embutido na página. */
const MARCADOR = 'var dadosOriginais';

/**
 * Piso de sanidade. A carga de referência (publicação de 2026-06-22) trazia 164
 * códigos. Um resultado muito abaixo disso significa página alterada ou resposta
 * truncada, não revogação em massa — e aí o certo é abortar sem escrever.
 */
export const MINIMO_ESPERADO = 100;

const TIMEOUT_MS = 90_000;

/** Indicador do SVRS -> sigla normalizada do documento. */
const DOCUMENTOS: Record<string, string> = {
  IndNfe: 'NFE', IndNfce: 'NFCE', IndCte: 'CTE', IndCteos: 'CTEOS',
  IndBpe: 'BPE', IndNf3e: 'NF3E', IndNfcom: 'NFCOM', IndNfse: 'NFSE',
  IndBpetm: 'BPETM', IndBpeta: 'BPETA', IndNfag: 'NFAG', IndNfsvia: 'NFSVIA',
  IndNfabi: 'NFABI', IndNfgas: 'NFGAS', IndDere: 'DERE', IndDir: 'DIR',
  IndDuimp: 'DUIMP',
};

export interface ResultadoSync {
  status: 'ok' | 'erro';
  total_recebido: number;
  inseridos: number;
  atualizados: number;
  inalterados: number;
  ausentes: number;
  erro?: string;
}

/**
 * Extrai o array JSON que começa em `inicio`, respeitando strings e escapes.
 *
 * Um `indexOf(']')` pararia no primeiro colchete dentro de uma descrição de
 * texto — e várias descrições da LC 214/2025 têm colchetes.
 */
export function extrairArrayJson(texto: string, inicio: number): string {
  let profundidade = 0;
  let dentroDeString = false;
  let escapando = false;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];

    if (escapando) { escapando = false; continue; }
    if (dentroDeString) {
      if (c === '\\') escapando = true;
      else if (c === '"') dentroDeString = false;
      continue;
    }
    if (c === '"') { dentroDeString = true; continue; }
    if (c === '[' || c === '{') profundidade++;
    else if (c === ']' || c === '}') {
      profundidade--;
      if (profundidade === 0) return texto.slice(inicio, i + 1);
    }
  }
  throw new Error('Array de dados não fecha — página truncada ou alterada.');
}

/** Converte o HTML da página no conjunto de classificações tributárias. */
export function extrairClassificacoes(html: string): Array<Record<string, unknown>> {
  const marcador = html.indexOf(MARCADOR);
  if (marcador === -1) {
    throw new Error(
      `Marcador "${MARCADOR}" não encontrado na página do SVRS. ` +
      'O layout provavelmente mudou — o parse precisa ser revisto.',
    );
  }
  const abre = html.indexOf('[', marcador);
  if (abre === -1) throw new Error('Início do array não encontrado após o marcador.');

  const bruto = extrairArrayJson(html, abre);

  let porCst: Array<Record<string, unknown>>;
  try {
    porCst = JSON.parse(bruto);
  } catch (erro) {
    throw new Error(`Array embutido não é JSON válido: ${(erro as Error).message}`);
  }

  // A página agrupa por CST; o que interessa são as classificações filhas.
  const classificacoes: Array<Record<string, unknown>> = [];
  for (const cst of porCst) {
    const filhas = cst.ClassificacoesTributarias as Array<Record<string, unknown>> | null;
    if (!Array.isArray(filhas)) continue;
    for (const filha of filhas) {
      classificacoes.push({ ...filha, NomeCst: cst.NomeCst });
    }
  }
  return classificacoes;
}

/**
 * Data -> 'YYYY-MM-DD'.
 *
 * Aceita as duas origens: o texto ISO do SVRS ('2026-01-01T00:00:00') e o objeto
 * Date que o driver do Postgres devolve para colunas `date`. Sem tratar o Date,
 * `String(valor).slice(0,10)` vira 'Wed Dec 3' e a comparação de mudanças acusa
 * alteração em todas as linhas a cada sincronização.
 *
 * A leitura do Date usa os componentes LOCAIS de propósito: o driver já
 * materializa a coluna `date` na meia-noite local, e passar por toISOString()
 * devolveria o dia anterior em qualquer fuso a oeste de Greenwich.
 */
function soData(valor: unknown): string | null {
  if (!valor) return null;
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const texto = String(valor).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
}

/**
 * Número comparável.
 *
 * A origem manda `60` (number) e o Postgres devolve `'60.00'` (string, porque
 * `numeric` não cabe em double sem perda). Comparar as duas formas como texto
 * marcaria toda linha como alterada.
 */
function soNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function paraLinha(item: Record<string, unknown>): Record<string, unknown> {
  const codigo = String(item.CodClassTrib ?? '').trim();
  const inicio = soData(item.DthIniVig);

  if (!/^\d{6}$/.test(codigo)) {
    throw new Error(`CodClassTrib fora do formato de 6 dígitos: "${codigo}".`);
  }
  if (!inicio) {
    throw new Error(`cClassTrib ${codigo} veio sem DthIniVig — vigência é obrigatória.`);
  }

  const documentos = Object.entries(DOCUMENTOS)
    .filter(([indicador]) => item[indicador] === true)
    .map(([, sigla]) => sigla);

  return {
    cod_class_trib: codigo,
    cst: String(item.Cst ?? '').trim(),
    nome_cst: (item.NomeCst as string) ?? null,
    nome: (item.NomeClassTrib as string) ?? '',
    nome_reduzido: (item.NomeReduzido as string) ?? null,
    vigencia_inicio: inicio,
    vigencia_fim: soData(item.DthFimVig),
    // Pontos percentuais, como o SVRS publica (60 = 60%). Não converter aqui:
    // converter no meio do caminho é como uma redução vira 6000%.
    perc_red_ibs: item.PercRedIbs ?? null,
    perc_red_cbs: item.PercRedCbs ?? null,
    tipo_aliq: item.TipoAliq ?? null,
    ind_trib_regular: item.IndTribRegular ?? null,
    documentos,
    url_legislacao: (item.TexUrlLegislacao as string) ?? null,
    nro_anexo: item.NroAnexo ?? null,
    publicado_em: soData(item.DthPublicacao),
    // Guarda o registro sem os anexos: são ~4.600 linhas de NCM/NBS que
    // multiplicariam o tamanho da tabela por um dado que ainda não é consumido.
    dados_brutos: JSON.stringify({ ...item, Anexos: undefined, AnexoNew: undefined, CstNavigation: undefined }),
  };
}

/**
 * Assinatura do conteúdo — define o que conta como "mudou".
 *
 * Ignora `sincronizado_em`, que muda a cada execução por definição. Normaliza
 * datas e números para que a linha vinda da origem e a linha vinda do banco
 * sejam comparáveis: sem isso, toda sincronização reportaria 164 atualizações e
 * o log não distinguiria "o SVRS publicou uma alteração" de "o sync rodou".
 */
function assinatura(linha: Record<string, unknown>): string {
  return JSON.stringify([
    String(linha.cst ?? ''),
    String(linha.nome ?? ''),
    linha.nome_reduzido ?? null,
    soData(linha.vigencia_inicio),
    soData(linha.vigencia_fim),
    soNumero(linha.perc_red_ibs),
    soNumero(linha.perc_red_cbs),
    soNumero(linha.tipo_aliq),
    linha.ind_trib_regular ?? null,
    ((linha.documentos ?? []) as string[]).slice().sort().join(','),
    linha.url_legislacao ?? null,
    soNumero(linha.nro_anexo),
    soData(linha.publicado_em),
  ]);
}

async function baixarPagina(url: string): Promise<string> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(url, {
      signal: controle.signal,
      headers: { 'User-Agent': 'contador-saas/sync-cclasstrib' },
    });
    if (!resposta.ok) {
      throw new Error(`SVRS respondeu HTTP ${resposta.status} ${resposta.statusText}.`);
    }
    return await resposta.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executa a sincronização.
 *
 * Falha NÃO propaga exceção por padrão: o sync roda em cron, e derrubar o
 * processo agendado por indisponibilidade do portal do SVRS trocaria um
 * problema pequeno (tabela um dia mais velha) por um grande. O resultado sai
 * com status 'erro' e fica registrado. Passe `lancarErro` para os testes e para
 * a execução manual, onde a falha precisa ser vista na hora.
 */
export async function sincronizar(opcoes: {
  url?: string;
  lancarErro?: boolean;
  html?: string;
} = {}): Promise<ResultadoSync> {
  const url = opcoes.url ?? URL_SVRS;
  const db = await getDatabase();

  const temTabela = await db.schema.hasTable('fiscal_class_trib');
  if (!temTabela) {
    const msg = 'Tabela fiscal_class_trib não existe — a migração 027 não rodou.';
    if (opcoes.lancarErro) throw new Error(msg);
    logger.error('[cClassTrib] ' + msg);
    return { status: 'erro', total_recebido: 0, inseridos: 0, atualizados: 0, inalterados: 0, ausentes: 0, erro: msg };
  }

  const iniciado = new Date();
  let logId: string | undefined;
  const temLog = await db.schema.hasTable('fiscal_class_trib_sync');
  if (temLog) {
    const [criado] = await db('fiscal_class_trib_sync')
      .insert({ iniciado_em: iniciado, status: 'erro', origem: url })
      .returning('id');
    // Nasce como 'erro' e só vira 'ok' ao concluir: se o processo morrer no
    // meio, a tentativa não fica registrada como bem-sucedida.
    logId = typeof criado === 'object' ? (criado as { id: string }).id : (criado as string);
  }

  const registrar = async (dados: Record<string, unknown>) => {
    if (temLog && logId) {
      await db('fiscal_class_trib_sync').where('id', logId)
        .update({ ...dados, concluido_em: new Date() });
    }
  };

  try {
    const html = opcoes.html ?? await baixarPagina(url);
    const itens = extrairClassificacoes(html);

    if (itens.length < MINIMO_ESPERADO) {
      // Aborta ANTES de escrever. Menos códigos que o piso é sinal de página
      // alterada ou resposta truncada — gravar isso apagaria a validação.
      throw new Error(
        `Recebidos ${itens.length} códigos, abaixo do piso de ${MINIMO_ESPERADO}. ` +
        'Nada foi gravado: a tabela anterior foi preservada.',
      );
    }

    const linhas = itens.map(paraLinha);

    const codigos = new Set(linhas.map((l) => l.cod_class_trib as string));
    if (codigos.size !== linhas.length) {
      throw new Error('A origem trouxe cod_class_trib duplicado — parse ou publicação inconsistente.');
    }

    const existentes = await db('fiscal_class_trib').select('*');
    const porCodigo = new Map(existentes.map((l) => [l.cod_class_trib as string, l]));

    let inseridos = 0; let atualizados = 0; let inalterados = 0;
    const agora = new Date();

    await db.transaction(async (trx: Knex.Transaction) => {
      for (const linha of linhas) {
        const atual = porCodigo.get(linha.cod_class_trib as string);

        if (!atual) {
          await trx('fiscal_class_trib').insert({ ...linha, sincronizado_em: agora });
          inseridos++;
          continue;
        }

        // assinatura() normaliza os dois lados, então dá para comparar a linha
        // da origem direto com a linha do banco.
        const mudou = assinatura(linha) !== assinatura(atual);

        // Reapareceu na origem: limpa a marca de ausência.
        const reapareceu = atual.ausente_na_origem_desde !== null;

        if (mudou || reapareceu) {
          await trx('fiscal_class_trib')
            .where('cod_class_trib', linha.cod_class_trib as string)
            .update({ ...linha, ausente_na_origem_desde: null, sincronizado_em: agora });
          atualizados++;
        } else {
          await trx('fiscal_class_trib')
            .where('cod_class_trib', linha.cod_class_trib as string)
            .update({ sincronizado_em: agora });
          inalterados++;
        }
      }

      // Sumiu da origem: marca, não apaga.
      const ausentes = existentes.filter(
        (l) => !codigos.has(l.cod_class_trib as string) && l.ausente_na_origem_desde === null,
      );
      for (const linha of ausentes) {
        await trx('fiscal_class_trib')
          .where('cod_class_trib', linha.cod_class_trib as string)
          .update({ ausente_na_origem_desde: agora });
      }
    });

    const ausentes = existentes.filter((l) => !codigos.has(l.cod_class_trib as string)).length;

    const resultado: ResultadoSync = {
      status: 'ok', total_recebido: linhas.length, inseridos, atualizados, inalterados, ausentes,
    };
    await registrar({ status: 'ok', total_recebido: linhas.length, inseridos, atualizados, inalterados, ausentes });
    logger.info('[cClassTrib] Sincronização concluída', resultado as unknown as Record<string, unknown>);
    return resultado;

  } catch (erro) {
    const mensagem = (erro as Error).message;
    await registrar({ status: 'erro', erro: mensagem });
    logger.error('[cClassTrib] Sincronização falhou', { erro: mensagem });
    if (opcoes.lancarErro) throw erro;
    return { status: 'erro', total_recebido: 0, inseridos: 0, atualizados: 0, inalterados: 0, ausentes: 0, erro: mensagem };
  }
}

export default { sincronizar, extrairClassificacoes, extrairArrayJson, URL_SVRS, MINIMO_ESPERADO };
