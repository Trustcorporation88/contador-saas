/**
 * Classificação Tributária (cClassTrib) — consulta e validação.
 *
 * No grupo gIBSCBS da NF-e, o CST diz QUAL é a situação tributária (tributada,
 * isenta, reduzida) e o cClassTrib diz POR QUE, amarrando na hipótese legal da
 * LC 214/2025. A SEFAZ valida o par, e valida contra a tabela vigente na data
 * de emissão.
 *
 * Este serviço só LÊ. Quem popula a tabela é o classTribSyncService.
 *
 * Duas decisões que definem o comportamento:
 *
 * 1. A validação é por DATA DE EMISSÃO, nunca por "hoje". Uma nota de janeiro
 *    reemitida em agosto tem de ser validada contra a tabela de janeiro, senão
 *    o sistema recusa um código que era válido quando o fato gerador ocorreu.
 *
 * 2. Tabela vazia não é "código inexistente". Se o sync nunca rodou, dizer
 *    "código 000001 não existe" manda o usuário procurar erro no lugar errado —
 *    ele conferiria a legislação, não a sincronização. O motivo devolvido
 *    distingue os dois casos.
 */

import { getDatabase } from '../config/database';

/** Documentos fiscais aos quais um cClassTrib pode se aplicar (normalizado do SVRS). */
export type DocumentoFiscal =
  | 'NFE' | 'NFCE' | 'CTE' | 'CTEOS' | 'BPE' | 'NF3E' | 'NFCOM' | 'NFSE'
  | 'BPETM' | 'BPETA' | 'NFAG' | 'NFSVIA' | 'NFABI' | 'NFGAS' | 'DERE'
  | 'DIR' | 'DUIMP';

export interface ClassTrib {
  cod_class_trib: string;
  cst: string;
  nome_cst: string | null;
  nome: string;
  nome_reduzido: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  /** Pontos percentuais: 60 significa 60%, não 0,6. */
  perc_red_ibs: number | null;
  perc_red_cbs: number | null;
  tipo_aliq: number | null;
  ind_trib_regular: boolean | null;
  documentos: DocumentoFiscal[];
  url_legislacao: string | null;
  nro_anexo: number | null;
  publicado_em: string | null;
  ausente_na_origem_desde: Date | null;
  sincronizado_em: Date;
}

export type MotivoInvalido =
  | 'TABELA_VAZIA'
  | 'CODIGO_INEXISTENTE'
  | 'FORA_DE_VIGENCIA'
  | 'DOCUMENTO_NAO_PERMITIDO';

export interface ResultadoValidacao {
  valido: boolean;
  motivo?: MotivoInvalido;
  /** Texto pronto para exibir ao usuário e para registrar no log fiscal. */
  mensagem?: string;
  registro?: ClassTrib;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `vigencia_fim` é tratada como INCLUSIVA: o código vale ATÉ aquele dia.
 *
 * É a leitura usual de "fim de vigência" nas tabelas fiscais brasileiras, mas o
 * SVRS não a explicita, e a diferença é de exatamente um dia. Fica isolada aqui
 * para ser trocada num ponto só caso a validação da SEFAZ mostre o contrário.
 */
const VIGENCIA_FIM_INCLUSIVA = true;

/**
 * Normaliza data para YYYY-MM-DD sem passar por `new Date()`.
 *
 * `new Date('2026-01-01')` produz meia-noite UTC, que em São Paulo é 31/12 às
 * 21h. Formatar isso de volta devolve o dia anterior, e um código que vence em
 * 01/01 passaria a vencer em 31/12. O mesmo cuidado do taxCalculationService.
 */
function normalizarData(valor: string | Date): string {
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const texto = String(valor ?? '').trim();
  // Aceita '2026-01-01' e '2026-01-01T00:00:00'.
  const soData = texto.slice(0, 10);
  if (!DATA_ISO.test(soData)) {
    throw Object.assign(
      new Error(`Data inválida: "${valor}". Esperado YYYY-MM-DD.`),
      { status: 400 },
    );
  }
  return soData;
}

/** Data de hoje no fuso de São Paulo, em YYYY-MM-DD. */
export function hojeSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return partes; // en-CA já formata como YYYY-MM-DD
}

function paraRegistro(linha: Record<string, unknown>): ClassTrib {
  return {
    ...linha,
    // Postgres devolve numeric como string; devolver assim faria
    // `perc_red_ibs * base` virar concatenação em JS.
    perc_red_ibs: linha.perc_red_ibs === null || linha.perc_red_ibs === undefined
      ? null : Number(linha.perc_red_ibs),
    perc_red_cbs: linha.perc_red_cbs === null || linha.perc_red_cbs === undefined
      ? null : Number(linha.perc_red_cbs),
    vigencia_inicio: normalizarData(linha.vigencia_inicio as string | Date),
    vigencia_fim: linha.vigencia_fim
      ? normalizarData(linha.vigencia_fim as string | Date) : null,
    publicado_em: linha.publicado_em
      ? normalizarData(linha.publicado_em as string | Date) : null,
    documentos: (linha.documentos ?? []) as DocumentoFiscal[],
  } as ClassTrib;
}

/** Quantos códigos existem na tabela, independentemente de vigência. */
export async function total(): Promise<number> {
  const db = await getDatabase();
  if (!(await db.schema.hasTable('fiscal_class_trib'))) return 0;
  const linha = await db('fiscal_class_trib').count<{ count: string }>({ count: '*' }).first();
  return Number(linha?.count ?? 0);
}

/**
 * Códigos vigentes numa data, opcionalmente restritos a um documento.
 *
 * Sem o filtro de documento a lista tem 164 códigos e a maioria é rejeitada na
 * NF-e — oferecer todos ao usuário é oferecer a rejeição.
 */
export async function listarVigentes(opcoes: {
  data?: string | Date;
  documento?: DocumentoFiscal;
  cst?: string;
} = {}): Promise<ClassTrib[]> {
  const db = await getDatabase();
  if (!(await db.schema.hasTable('fiscal_class_trib'))) return [];

  const data = opcoes.data ? normalizarData(opcoes.data) : hojeSaoPaulo();

  const linhas = await db('fiscal_class_trib')
    .where('vigencia_inicio', '<=', data)
    .andWhere((builder) => (VIGENCIA_FIM_INCLUSIVA
      ? builder.whereNull('vigencia_fim').orWhere('vigencia_fim', '>=', data)
      : builder.whereNull('vigencia_fim').orWhere('vigencia_fim', '>', data)))
    // `?` sozinho é operador de jsonb no Knex; para text[] usa-se ANY.
    .modify((q) => (opcoes.documento
      ? q.whereRaw('? = ANY (documentos)', [opcoes.documento]) : q))
    .modify((q) => (opcoes.cst ? q.where('cst', opcoes.cst) : q))
    .orderBy('cod_class_trib');

  return linhas.map(paraRegistro);
}

/** Busca um código específico, vigente ou não. */
export async function buscar(codigo: string): Promise<ClassTrib | null> {
  const db = await getDatabase();
  if (!(await db.schema.hasTable('fiscal_class_trib'))) return null;
  const linha = await db('fiscal_class_trib')
    .where('cod_class_trib', String(codigo ?? '').trim())
    .first();
  return linha ? paraRegistro(linha) : null;
}

/**
 * Valida um cClassTrib para uma emissão.
 *
 * Devolve o motivo em vez de só `false` porque cada motivo leva a uma ação
 * diferente: código inexistente é erro de cadastro, fora de vigência é norma
 * que mudou, documento não permitido é o código certo no documento errado, e
 * tabela vazia é problema de infraestrutura — não do usuário.
 */
export async function validar(entrada: {
  codigo: string;
  data?: string | Date;
  documento?: DocumentoFiscal;
}): Promise<ResultadoValidacao> {
  const codigo = String(entrada.codigo ?? '').trim();
  const data = entrada.data ? normalizarData(entrada.data) : hojeSaoPaulo();

  if (!codigo) {
    return {
      valido: false,
      motivo: 'CODIGO_INEXISTENTE',
      mensagem: 'cClassTrib não informado.',
    };
  }

  const registro = await buscar(codigo);

  if (!registro) {
    // Antes de acusar o código, verificar se há tabela. Os dois casos são
    // indistinguíveis para quem consulta, e a ação corretiva é oposta.
    if ((await total()) === 0) {
      return {
        valido: false,
        motivo: 'TABELA_VAZIA',
        mensagem:
          'A tabela de Classificação Tributária nunca foi sincronizada com o SVRS. ' +
          'Não é possível validar o cClassTrib até que a sincronização rode.',
      };
    }
    return {
      valido: false,
      motivo: 'CODIGO_INEXISTENTE',
      mensagem: `cClassTrib ${codigo} não consta na tabela publicada pelo SVRS.`,
    };
  }

  if (data < registro.vigencia_inicio) {
    return {
      valido: false,
      motivo: 'FORA_DE_VIGENCIA',
      registro,
      mensagem:
        `cClassTrib ${codigo} só passa a vigorar em ${registro.vigencia_inicio} ` +
        `e a emissão é de ${data}.`,
    };
  }

  const fim = registro.vigencia_fim;
  const encerrado = fim !== null && (VIGENCIA_FIM_INCLUSIVA ? data > fim : data >= fim);
  if (encerrado) {
    return {
      valido: false,
      motivo: 'FORA_DE_VIGENCIA',
      registro,
      mensagem:
        `cClassTrib ${codigo} teve a vigência encerrada em ${fim} ` +
        `e a emissão é de ${data}.`,
    };
  }

  if (entrada.documento && !registro.documentos.includes(entrada.documento)) {
    return {
      valido: false,
      motivo: 'DOCUMENTO_NAO_PERMITIDO',
      registro,
      mensagem:
        `cClassTrib ${codigo} não é aceito em ${entrada.documento}. ` +
        `Documentos permitidos: ${registro.documentos.join(', ') || 'nenhum'}.`,
    };
  }

  return { valido: true, registro };
}

/** Última sincronização registrada, ou null se nunca rodou. */
export async function ultimaSincronizacao(): Promise<{
  status: string;
  iniciado_em: Date;
  concluido_em: Date | null;
  total_recebido: number | null;
  erro: string | null;
} | null> {
  const db = await getDatabase();
  if (!(await db.schema.hasTable('fiscal_class_trib_sync'))) return null;
  const linha = await db('fiscal_class_trib_sync').orderBy('iniciado_em', 'desc').first();
  return linha ?? null;
}

export default {
  total, listarVigentes, buscar, validar, ultimaSincronizacao, hojeSaoPaulo,
};
