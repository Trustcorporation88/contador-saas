/**
 * Download dos XMLs capturados.
 *
 * De onde vem: o Fabricio perguntou "onde ele salva os arquivos XML baixados?"
 * olhando a tela que os lista. Os arquivos estavam no volume do servidor e na
 * coluna `xml_content` — e não havia nenhum caminho pela interface até ele.
 * Para escritório de contabilidade isso inutiliza a função: o XML precisa sair
 * do sistema para entrar no programa fiscal.
 *
 * O QUE ESTES TESTES PROVAM, e por que não bastava "gerou sem erro":
 *
 * 1. Que o ZIP é um ZIP DE VERDADE. O teste descompacta o que foi gerado e
 *    confere nome e conteúdo de cada arquivo. Um teste que só checa "não lançou
 *    exceção" passaria com um buffer vazio nomeado .zip — e o usuário
 *    descobriria no fechamento do mês.
 *
 * 2. Que o filtro é pela data de EMISSÃO, não pela de captura. Nota de julho
 *    capturada em agosto pertence a julho: filtrar pela captura misturaria
 *    competências, e é erro que aparece na apuração, não na tela.
 *
 * 3. Que registro sem conteúdo recusa com mensagem, em vez de entregar arquivo
 *    vazio com nome de XML.
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Linhas devolvidas pelo mock, e os filtros que a consulta recebeu. */
const estado: {
  linhas: Array<Record<string, unknown>>;
  uma: Record<string, unknown> | null;
  filtros: Array<[string, string, unknown]>;
} = { linhas: [], uma: null, filtros: [] };

jest.mock('../../src/config/database', () => {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  Object.assign(query, {
    where: jest.fn((...args: unknown[]) => {
      // Registra só as comparações (coluna, operador, valor) — é o que os
      // testes de competência precisam inspecionar.
      if (args.length === 3) {
        estado.filtros.push([String(args[0]), String(args[1]), args[2]]);
      }
      return query;
    }),
    andWhere: jest.fn((...args: unknown[]) => {
      if (args.length === 3) {
        estado.filtros.push([String(args[0]), String(args[1]), args[2]]);
      }
      return query;
    }),
    whereNotNull: jest.fn(chain),
    orderBy: jest.fn(chain),
    limit: jest.fn(() => Promise.resolve(estado.linhas)),
    first: jest.fn(() => Promise.resolve(estado.uma)),
  });
  const db: any = jest.fn(() => query);
  return { getDatabase: jest.fn().mockResolvedValue(db), db };
});

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { XmlDownloadService } from '../../src/services/xmlDownloadService';

const EMPRESA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CHAVE_A = '3'.repeat(44);
const CHAVE_B = '4'.repeat(44);

/** unzip do sistema existe? Sem ele não há como conferir o ZIP de verdade. */
function temUnzip(): boolean {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const itSeDescompacta = temUnzip() ? it : it.skip;

async function coletar(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const partes: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (d) => partes.push(Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(partes)));
    stream.on('error', reject);
  });
}

async function erroDe(p: Promise<unknown>): Promise<Error & { status?: number }> {
  try {
    await p;
  } catch (e) {
    return e as Error & { status?: number };
  }
  throw new Error('esperava falha, e a chamada foi bem-sucedida');
}

beforeEach(() => {
  estado.linhas = [];
  estado.uma = null;
  estado.filtros = [];
});

describe('XML de uma captura', () => {

  it('devolve o conteúdo e nomeia o arquivo com a chave', async () => {
    // O nome é a convenção que os programas fiscais esperam, e permite conferir
    // um lote sem abrir arquivo.
    estado.uma = { id: 'x', chave: CHAVE_A, xml_content: '<nfeProc>ok</nfeProc>' };
    const r = await XmlDownloadService.porId(EMPRESA, 'x');
    expect(r.conteudo).toBe('<nfeProc>ok</nfeProc>');
    expect(r.nomeArquivo).toBe(`${CHAVE_A}.xml`);
  });

  it('captura inexistente responde 404', async () => {
    estado.uma = null;
    const erro = await erroDe(XmlDownloadService.porId(EMPRESA, 'x'));
    expect(erro.status).toBe(404);
  });

  it('SEM CONTEÚDO, RECUSA — não entrega arquivo vazio com nome de XML', async () => {
    // Capturas antigas guardavam só o caminho no disco, que provavelmente já não
    // existe. Entregar 0 byte chamado .xml faria o contador subir um arquivo
    // inválido no programa fiscal e descobrir o problema longe daqui.
    estado.uma = { id: 'x', chave: CHAVE_A, xml_content: '' };
    const erro = await erroDe(XmlDownloadService.porId(EMPRESA, 'x'));
    expect(erro.status).toBe(409);
    expect(erro.message).toMatch(/conte[úu]do/i);
  });
});

describe('ZIP da competência', () => {

  itSeDescompacta('É UM ZIP DE VERDADE: descompacta e confere os arquivos', async () => {
    estado.linhas = [
      { id: 'a', chave: CHAVE_A, xml_content: '<nfeProc>primeira</nfeProc>' },
      { id: 'b', chave: CHAVE_B, xml_content: '<nfeProc>segunda</nfeProc>' },
    ];

    const { zip, nomeArquivo, total } = await XmlDownloadService.zipDaCompetencia(
      EMPRESA, { ano: 2026, mes: 8 },
    );
    expect(total).toBe(2);
    expect(nomeArquivo).toBe('xmls-2026-08.zip');

    const buffer = await coletar(zip);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-teste-'));
    const arquivoZip = path.join(dir, 'saida.zip');
    fs.writeFileSync(arquivoZip, buffer);

    // Descompacta com o unzip do sistema. É o que prova que o arquivo abre em
    // ferramenta de verdade — não só na biblioteca que o escreveu.
    execFileSync('unzip', ['-q', arquivoZip, '-d', dir]);

    const conteudoA = fs.readFileSync(path.join(dir, `${CHAVE_A}.xml`), 'utf-8');
    const conteudoB = fs.readFileSync(path.join(dir, `${CHAVE_B}.xml`), 'utf-8');
    expect(conteudoA).toBe('<nfeProc>primeira</nfeProc>');
    expect(conteudoB).toBe('<nfeProc>segunda</nfeProc>');

    fs.rmSync(dir, { recursive: true, force: true });
  }, 30000);

  it('FILTRA PELA DATA DE EMISSÃO, não pela de captura', async () => {
    // O ponto que decide a competência. Filtrar por captured_at colocaria nota
    // de julho na apuração de agosto.
    estado.linhas = [{ id: 'a', chave: CHAVE_A, xml_content: '<x/>' }];
    await XmlDownloadService.zipDaCompetencia(EMPRESA, { ano: 2026, mes: 7 });

    const colunas = estado.filtros.map(([coluna]) => coluna);
    expect(colunas).toContain('data_emissao');
    expect(colunas).not.toContain('captured_at');
  });

  it('o intervalo do mês é semiaberto, pegando o mês inteiro', async () => {
    // Julho tem 31 dias, fevereiro 28 ou 29. Com ">= 01/07 e < 01/08" o mês sai
    // inteiro sem depender disso e sem erro de fuso que um BETWEEN com '31'
    // introduz.
    estado.linhas = [{ id: 'a', chave: CHAVE_A, xml_content: '<x/>' }];
    await XmlDownloadService.zipDaCompetencia(EMPRESA, { ano: 2026, mes: 7 });

    const comparacoes = estado.filtros.filter(([c]) => c === 'data_emissao');
    expect(comparacoes).toEqual([
      ['data_emissao', '>=', '2026-07-01'],
      ['data_emissao', '<', '2026-08-01'],
    ]);
  });

  it('dezembro vira janeiro do ano seguinte', async () => {
    // O caso que quebra um cálculo ingênuo de "mês + 1".
    estado.linhas = [{ id: 'a', chave: CHAVE_A, xml_content: '<x/>' }];
    await XmlDownloadService.zipDaCompetencia(EMPRESA, { ano: 2026, mes: 12 });

    const comparacoes = estado.filtros.filter(([c]) => c === 'data_emissao');
    expect(comparacoes).toEqual([
      ['data_emissao', '>=', '2026-12-01'],
      ['data_emissao', '<', '2027-01-01'],
    ]);
  });

  it('competência vazia recusa com mensagem que diz o mês', async () => {
    estado.linhas = [];
    const erro = await erroDe(
      XmlDownloadService.zipDaCompetencia(EMPRESA, { ano: 2026, mes: 3 }),
    );
    expect(erro.status).toBe(404);
    expect(erro.message).toMatch(/03\/2026/);
  });

  itSeDescompacta('chave repetida não some do ZIP', async () => {
    // Nome repetido dentro de um ZIP faz alguns descompactadores entregarem só
    // um dos arquivos, em silêncio. Sufixar é feio e é melhor que perder nota.
    estado.linhas = [
      { id: 'aaaaaaaa-1111', chave: CHAVE_A, xml_content: '<x>um</x>' },
      { id: 'bbbbbbbb-2222', chave: CHAVE_A, xml_content: '<x>dois</x>' },
    ];

    const { zip } = await XmlDownloadService.zipDaCompetencia(EMPRESA, {});
    const buffer = await coletar(zip);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-dup-'));
    fs.writeFileSync(path.join(dir, 's.zip'), buffer);
    execFileSync('unzip', ['-q', path.join(dir, 's.zip'), '-d', dir]);

    const arquivos = fs.readdirSync(dir).filter((n) => n.endsWith('.xml'));
    expect(arquivos).toHaveLength(2);

    fs.rmSync(dir, { recursive: true, force: true });
  }, 30000);
});
