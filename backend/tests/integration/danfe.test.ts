/**
 * DANFE — do XML autorizado ao PDF.
 *
 * O sistema emitia a nota e entregava só o XML. Mercadoria não circula com XML,
 * circula com DANFE impresso; sem ele a emissão não servia para o dia a dia.
 *
 * O que estes testes protegem, em ordem de importância:
 *
 * 1. QUE NÃO SE IMPRIMA DANFE DE NOTA NÃO AUTORIZADA. O `xml_nfe` que o sistema
 *    guarda é rascunho de tela — nfeProc sem protocolo, sem enderEmit, sem
 *    enderDest, indIEDest fixo em 9. Um DANFE tirado dele seria um papel com
 *    aparência de documento fiscal e nenhuma nota fiscal por trás. A recusa é
 *    dupla, no serviço e no Python, de propósito: quem chamar o script por fora
 *    também não deve conseguir.
 *
 * 2. Que o PDF seja PDF de verdade. Um teste que só checa "não lançou exceção"
 *    passaria com arquivo vazio ou com JSON de erro salvo com extensão .pdf.
 *
 * O caso de sucesso roda o Python de verdade sobre um nfeProc de verdade — não
 * há como provar renderização com mock. Ele é pulado quando a biblioteca não
 * está instalada, para não pintar o CI de vermelho por falta de dependência.
 *
 * O fixture tem CNPJ, IE e endereço INVENTADOS. O repositório é público: dado
 * de cliente real não entra em arquivo de teste.
 */

/**
 * O mock reexporta TUDO que o módulo real oferece, não só o logger: o teste de
 * rota carrega o app inteiro, e app.ts também importa daqui o middleware
 * `requestLogger` e o `getRequestMetricsSnapshot`. Substituir o módulo só pelo
 * logger fazia o Express receber undefined em app.use() e derrubar a suíte.
 */
jest.mock('../../src/middleware/requestLogger', () => {
  const silencioso = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return {
    logger: silencioso,
    default: silencioso,
    requestLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
    getRequestMetricsSnapshot: () => ({}),
  };
});

/** Linha da tabela nfe que o mock do banco devolve. Trocada por teste. */
let linhaNfe: Record<string, unknown> | undefined;

jest.mock('../../src/config/database', () => ({
  getDatabase: async () => {
    const construtor = {
      where: () => construtor,
      select: () => construtor,
      first: async () => linhaNfe,
    };
    return () => construtor;
  },
}));

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { DanfeService } from '../../src/services/danfeService';
import { getPythonBin } from '../../src/services/nfeEmitter';

const CAMINHO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'nfeproc-autorizada.xml');
const XML_AUTORIZADO = fs.readFileSync(CAMINHO_FIXTURE, 'utf-8');

/**
 * Os regex abaixo toleram prefixo de namespace (`ns0:protNFe`) porque a primeira
 * versão do fixture tinha prefixo e a busca literal por `<protNFe` não casava
 * nada: o XML seguia intacto para o gerador, o DANFE era gerado e os dois testes
 * de recusa "passavam" sem exercer recusa nenhuma. O fixture hoje usa o
 * namespace padrão, como o SEFAZ devolve — e estes regex garantem que uma
 * mudança nele não desative a verificação em silêncio.
 */
const RE_PROT_NFE = /<(?:\w+:)?protNFe[\s\S]*?<\/(?:\w+:)?protNFe>/;
const RE_CSTAT_100 = /<((?:\w+:)?)cStat>100<\/(?:\w+:)?cStat>/;

/** Falha alto e claro se o fixture deixar de casar — em vez de passar à toa. */
function exigirCasamento(regex: RegExp, alvo: string, oQue: string): void {
  if (!regex.test(alvo)) {
    throw new Error(
      `fixture não contém ${oQue}: o teste negativo não exerceria a recusa. `
      + 'Regenere tests/fixtures/nfeproc-autorizada.xml.',
    );
  }
}

const EMPRESA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOTA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/**
 * A biblioteca de renderização está instalada neste ambiente?
 *
 * Usa getPythonBin() — o MESMO resolvedor que o serviço usa — e não um
 * 'python3' escrito à mão. Na primeira versão eu sondava python3 enquanto o
 * serviço executava python: a detecção dizia "dá para renderizar" e a execução
 * morria com ENOENT. Detecção e execução têm de olhar para o mesmo binário.
 */
function temRenderizador(): boolean {
  const python = getPythonBin();
  try {
    execFileSync(python, ['-c', 'import brazilfiscalreport'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const RENDERIZA = temRenderizador();
const itSeRenderiza = RENDERIZA ? it : it.skip;

if (!RENDERIZA) {
  // eslint-disable-next-line no-console
  console.warn('[danfe] brazilfiscalreport não instalado — casos de renderização pulados.');
}

/** Captura o erro de uma promessa, com status, sem depender de rejects.toThrow. */
async function erroDe(promessa: Promise<unknown>): Promise<Error & { status?: number }> {
  try {
    await promessa;
  } catch (e) {
    return e as Error & { status?: number };
  }
  throw new Error('esperava uma falha, e a chamada foi bem-sucedida');
}

beforeEach(() => {
  linhaNfe = undefined;
});

describe('DANFE — recusas', () => {

  it('nota inexistente responde 404', async () => {
    linhaNfe = undefined;
    const erro = await erroDe(DanfeService.gerar(NOTA, EMPRESA));
    expect(erro.status).toBe(404);
  });

  it('RASCUNHO NÃO GERA DANFE, e a mensagem diz por quê', async () => {
    // O caso central. Antes de existir a recusa, o caminho natural seria cair no
    // xml_nfe — que é o rascunho — e imprimir um documento sem valor fiscal.
    linhaNfe = { id: NOTA, numero: 1, serie: 1, status: 'RASCUNHO', chave_acesso: null, xml_proc: null };
    const erro = await erroDe(DanfeService.gerar(NOTA, EMPRESA));
    expect(erro.status).toBe(409);
    expect(erro.message).toMatch(/rascunho/i);
    expect(erro.message).toMatch(/autoriza/i);
  });

  it('PENDENTE (rejeitada pela SEFAZ) não gera DANFE', async () => {
    linhaNfe = { id: NOTA, numero: 1, serie: 1, status: 'PENDENTE', chave_acesso: 'x'.repeat(44), xml_proc: null };
    const erro = await erroDe(DanfeService.gerar(NOTA, EMPRESA));
    expect(erro.status).toBe(409);
    expect(erro.message).toMatch(/não foi autorizada/i);
  });

  it('DENEGADA não gera DANFE', async () => {
    linhaNfe = { id: NOTA, numero: 1, serie: 1, status: 'DENEGADA', chave_acesso: 'x'.repeat(44), xml_proc: null };
    const erro = await erroDe(DanfeService.gerar(NOTA, EMPRESA));
    expect(erro.status).toBe(409);
    expect(erro.message).toMatch(/denegada/i);
  });

  it('AUTORIZADA sem xml_proc explica que falta o XML, e manda buscar na SEFAZ', async () => {
    // Acontece se a autorização gravou o status e perdeu o XML. Aqui o erro não
    // é do usuário, e a mensagem tem de dizer onde ele consegue o documento.
    linhaNfe = { id: NOTA, numero: 1, serie: 1, status: 'AUTORIZADA', chave_acesso: 'x'.repeat(44), xml_proc: null };
    const erro = await erroDe(DanfeService.gerar(NOTA, EMPRESA));
    expect(erro.status).toBe(409);
    expect(erro.message).toMatch(/portal da SEFAZ/i);
  });

  itSeRenderiza('O RASCUNHO DE VERDADE É RECUSADO PELO PYTHON TAMBÉM', async () => {
    // Segunda camada de defesa: aqui o xml_proc está preenchido, então o
    // serviço deixa passar — mas com o conteúdo do rascunho. É o cenário de um
    // dado errado no banco, e o gerador precisa recusar sozinho.
    exigirCasamento(RE_PROT_NFE, XML_AUTORIZADO, 'o bloco protNFe');
    const rascunho = XML_AUTORIZADO.replace(RE_PROT_NFE, '');
    linhaNfe = {
      id: NOTA, numero: 1, serie: 1, status: 'AUTORIZADA',
      chave_acesso: 'x'.repeat(44), xml_proc: rascunho,
    };
    const erro = await erroDe(DanfeService.gerar(NOTA, EMPRESA));
    expect(erro.status).toBe(422);
    expect(erro.message).toMatch(/protNFe|protocolo/i);
  }, 60000);

  itSeRenderiza('nota rejeitada dentro do XML (cStat 539) é recusada', async () => {
    exigirCasamento(RE_CSTAT_100, XML_AUTORIZADO, 'um cStat 100');
    const rejeitada = XML_AUTORIZADO
      .replace(RE_CSTAT_100, '<$1cStat>539</$1cStat>')
      .replace('Autorizado o uso da NF-e', 'Rejeicao: Duplicidade de NF-e');
    linhaNfe = {
      id: NOTA, numero: 1, serie: 1, status: 'AUTORIZADA',
      chave_acesso: 'x'.repeat(44), xml_proc: rejeitada,
    };
    const erro = await erroDe(DanfeService.gerar(NOTA, EMPRESA));
    expect(erro.status).toBe(422);
    expect(erro.message).toMatch(/539/);
  }, 60000);
});

describe('DANFE — geração', () => {

  itSeRenderiza('GERA UM PDF DE VERDADE a partir do XML autorizado', async () => {
    linhaNfe = {
      id: NOTA, numero: 1, serie: 1, status: 'AUTORIZADA',
      chave_acesso: '35260811222333000181550010000000011313105101',
      xml_proc: XML_AUTORIZADO,
    };

    const resultado = await DanfeService.gerar(NOTA, EMPRESA);

    // %PDF no início: é o que distingue PDF de um arquivo vazio ou de um JSON
    // de erro salvo com extensão .pdf.
    expect(resultado.pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(resultado.pdf.length).toBeGreaterThan(2000);
    // %%EOF no fim: PDF truncado abre quebrado no navegador.
    expect(resultado.pdf.subarray(-1024).toString('latin1')).toContain('%%EOF');
    expect(resultado.cancelada).toBe(false);
  }, 60000);

  itSeRenderiza('A FORMA QUE A SEFAZ DEVOLVE DE VERDADE: protNFe com prefixo', async () => {
    // A primeira nota real (12/08/2026, SEFAZ-SP) voltou com namespace MISTURADO:
    // <NFe> no namespace padrão, sem prefixo, e <ns0:protNFe> com prefixo e
    // filhos prefixados. O fixture tinha tudo sem prefixo, então esta combinação
    // — a que acontece em produção — nunca era exercida.
    //
    // Funciona porque a busca é por URI de namespace, não por prefixo. Mas
    // "funciona porque deveria" não é prova: este teste é a prova.
    // O prefixo entra SÓ dentro do bloco protNFe. Na primeira versão eu apliquei
    // o regex ao documento inteiro e prefixei também o <tpAmb> de dentro do
    // <ide>, onde ns0 não está declarado — o XML virou inválido e o gerador
    // recusou com "Namespace prefix ns0 on tpAmb is not defined". O teste
    // acusou; o erro era do teste, não do código.
    const TAGS_DO_PROTOCOLO = 'protNFe|infProt|tpAmb|verAplic|chNFe|dhRecbto|nProt|digVal|cStat|xMotivo';
    const bloco = XML_AUTORIZADO.match(RE_PROT_NFE)?.[0] as string;
    expect(bloco).toBeTruthy();

    const blocoComPrefixo = bloco
      .replace(new RegExp(`<(\\/?)(${TAGS_DO_PROTOCOLO})(\\s|>)`, 'g'), '<$1ns0:$2$3')
      .replace('<ns0:protNFe', '<ns0:protNFe xmlns:ns0="http://www.portalfiscal.inf.br/nfe"');

    const comPrefixo = XML_AUTORIZADO.replace(bloco, blocoComPrefixo);

    // Sem isto, um fixture futuro sem protNFe faria o teste passar à toa.
    expect(comPrefixo).toContain('<ns0:protNFe');
    expect(comPrefixo).toContain('<ns0:cStat>');

    linhaNfe = {
      id: NOTA, numero: 2, serie: 1, status: 'AUTORIZADA',
      chave_acesso: '35260811222333000181550010000000011313105101',
      xml_proc: comPrefixo,
    };

    const resultado = await DanfeService.gerar(NOTA, EMPRESA);
    expect(resultado.pdf.subarray(0, 4).toString()).toBe('%PDF');
  }, 60000);

  itSeRenderiza('o nome do arquivo carrega a chave de acesso', async () => {
    // A chave é como o documento é identificado depois — pelo cliente, pelo
    // fisco e pela própria contabilidade. Nome com o id interno não serve.
    const chave = '35260811222333000181550010000000011313105101';
    linhaNfe = {
      id: NOTA, numero: 1, serie: 1, status: 'AUTORIZADA',
      chave_acesso: chave, xml_proc: XML_AUTORIZADO,
    };
    const resultado = await DanfeService.gerar(NOTA, EMPRESA);
    expect(resultado.nomeArquivo).toBe(`danfe-${chave}.pdf`);
  }, 60000);

  itSeRenderiza('nota CANCELADA gera DANFE marcado como cancelado', async () => {
    // Continua existindo documento: ele serve de comprovante do que foi
    // cancelado. O que muda é a marca d'água.
    linhaNfe = {
      id: NOTA, numero: 1, serie: 1, status: 'CANCELADA',
      chave_acesso: '35260811222333000181550010000000011313105101',
      xml_proc: XML_AUTORIZADO,
    };
    const resultado = await DanfeService.gerar(NOTA, EMPRESA);
    expect(resultado.pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(resultado.cancelada).toBe(true);
  }, 60000);

  it('A ROTA EXISTE E EXIGE TOKEN', async () => {
    // Prova por HTTP, não por leitura do arquivo de rotas. A distinção importa:
    // uma rota escrita no fonte mas registrada depois de um handler que a
    // sombreia passaria por checagem estática e responderia 404 ao usuário.
    // 401 aqui significa duas coisas de uma vez: existe e é protegida.
    const request = (await import('supertest')).default;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const app = require('../../src/app').default;

    const resposta = await request(app).get(`/api/v1/companies/${EMPRESA}/nfe/${NOTA}/danfe`);

    expect(resposta.status).toBe(401);
  }, 60000);

  itSeRenderiza('não deixa arquivo temporário para trás', async () => {
    // O XML autorizado é documento fiscal do cliente e o /tmp é compartilhado
    // com os outros processos do container.
    const os = await import('os');
    const antes = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('danfe-'));

    linhaNfe = {
      id: NOTA, numero: 1, serie: 1, status: 'AUTORIZADA',
      chave_acesso: '35260811222333000181550010000000011313105101',
      xml_proc: XML_AUTORIZADO,
    };
    await DanfeService.gerar(NOTA, EMPRESA);

    const depois = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('danfe-'));
    expect(depois).toEqual(antes);
  }, 60000);
});
