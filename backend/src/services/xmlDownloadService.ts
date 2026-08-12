/**
 * Download dos XMLs capturados.
 *
 * O QUE FALTAVA
 *
 * A captura baixava os XMLs e os guardava em dois lugares — no volume do
 * servidor (`/app/data/fiscal-xmls/{cnpj}/{ano}/{mes}/{chave}.xml`) e na coluna
 * `xml_content` — e não havia NENHUM caminho pela interface até o usuário. O
 * Fabricio perguntou "onde ele salva os arquivos XML baixados?" olhando a tela
 * que os lista: os arquivos existiam e eram inalcançáveis.
 *
 * Para escritório de contabilidade isso inutiliza a função: o XML precisa sair
 * daqui para entrar no programa fiscal, e o que ele quer no fim do mês não é um
 * arquivo — é a pasta do mês inteira.
 *
 * DE ONDE VEM O CONTEÚDO
 *
 * Da coluna `xml_content`, não do disco. O disco é do container: some em deploy
 * quando o volume não está montado, e a coluna existe justamente porque isso já
 * aconteceu neste projeto. O banco é a fonte com guarda de cinco anos.
 *
 * O NOME DO ARQUIVO É A CHAVE
 *
 * `{chave}.xml`, com os 44 dígitos. É a convenção que os programas fiscais e o
 * próprio fisco esperam, e é o que permite conferir um lote sem abrir arquivo.
 */

import yazl from 'yazl';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';

export interface XmlCapturado {
  chave: string;
  conteudo: string;
  nomeArquivo: string;
}

/** Teto de arquivos por ZIP: evita montar meio gigabyte em memória sem aviso. */
const MAXIMO_POR_ZIP = 2000;

function digits(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

export class XmlDownloadService {
  /** XML de UMA captura, pelo id da linha. */
  static async porId(companyId: string, id: string): Promise<XmlCapturado> {
    const db = await getDatabase();
    const linha = await db('fiscal_xml_captures')
      .where({ company_id: companyId, id })
      .first();

    if (!linha) {
      throw Object.assign(new Error('XML capturado não encontrado'), { status: 404 });
    }

    const conteudo = String(linha.xml_content || '');
    if (!conteudo.trim()) {
      // Capturas antigas, de antes de a coluna existir, têm só o caminho no
      // disco — que provavelmente já não existe. Dizer isso é melhor que
      // entregar arquivo vazio com nome de XML.
      throw Object.assign(
        new Error(
          'Este registro não tem o conteúdo do XML guardado (captura anterior à '
          + 'gravação em banco). Capture novamente para obter o arquivo.',
        ),
        { status: 409 },
      );
    }

    return {
      chave: String(linha.chave || ''),
      conteudo,
      nomeArquivo: `${digits(linha.chave) || linha.id}.xml`,
    };
  }

  /**
   * ZIP dos XMLs de uma competência.
   *
   * O filtro é por `data_emissao` — a data da NOTA — e não pela data de captura.
   * É o que o contador chama de competência: uma nota de julho capturada em
   * agosto pertence a julho, e apurar pela data de captura misturaria os meses.
   *
   * Sem ano/mês, devolve tudo o que houver (até o teto).
   */
  static async zipDaCompetencia(
    companyId: string,
    filtro: { ano?: number; mes?: number } = {},
  ): Promise<{ zip: NodeJS.ReadableStream; nomeArquivo: string; total: number }> {
    const db = await getDatabase();

    let consulta = db('fiscal_xml_captures')
      .where({ company_id: companyId })
      .whereNotNull('xml_content');

    const { ano, mes } = filtro;
    if (ano && mes) {
      // Intervalo semiaberto no primeiro dia do mês seguinte: pega o mês todo
      // sem depender de quantos dias ele tem, e sem erro de fuso que um
      // BETWEEN com '31' introduz.
      const inicio = new Date(Date.UTC(ano, mes - 1, 1));
      const fim = new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1));
      consulta = consulta
        .where('data_emissao', '>=', inicio.toISOString().slice(0, 10))
        .andWhere('data_emissao', '<', fim.toISOString().slice(0, 10));
    } else if (ano) {
      consulta = consulta
        .where('data_emissao', '>=', `${ano}-01-01`)
        .andWhere('data_emissao', '<', `${ano + 1}-01-01`);
    }

    const linhas = await consulta
      .orderBy('data_emissao', 'asc')
      .limit(MAXIMO_POR_ZIP);

    if (linhas.length === 0) {
      throw Object.assign(
        new Error(
          ano && mes
            ? `Nenhum XML capturado com data de emissão em ${String(mes).padStart(2, '0')}/${ano}.`
            : 'Nenhum XML capturado com conteúdo guardado.',
        ),
        { status: 404 },
      );
    }

    const zip = new yazl.ZipFile();
    const usados = new Set<string>();

    for (const linha of linhas as Array<Record<string, unknown>>) {
      const chave = digits(linha.chave);
      let nome = `${chave || linha.id}.xml`;
      // Duas linhas com a mesma chave não deveriam existir (há UNIQUE), mas um
      // ZIP com nome repetido abre com arquivo faltando em alguns
      // descompactadores — silenciosamente. Melhor sufixar.
      if (usados.has(nome)) nome = `${chave}-${String(linha.id).slice(0, 8)}.xml`;
      usados.add(nome);

      zip.addBuffer(Buffer.from(String(linha.xml_content), 'utf-8'), nome);
    }

    zip.end();

    const sufixo = ano && mes
      ? `${ano}-${String(mes).padStart(2, '0')}`
      : (ano ? String(ano) : 'todos');

    logger.info('ZIP de XMLs capturados', { companyId, total: linhas.length, sufixo });

    return {
      zip: zip.outputStream,
      nomeArquivo: `xmls-${sufixo}.zip`,
      total: linhas.length,
    };
  }
}

export default XmlDownloadService;
