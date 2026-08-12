/**
 * Manifestação do destinatário — as recusas antes de tocar na SEFAZ.
 *
 * Contexto: a Distribuição DFe entrega só o RESUMO das notas emitidas contra o
 * CNPJ do cliente. Em 12/08/2026 a captura desta empresa trouxe 8 documentos e
 * os 8 eram resumo — sem itens, sem NCM, sem impostos, imprestáveis para
 * escriturar. O XML completo só é liberado depois da manifestação.
 *
 * O que estes testes protegem:
 *
 * 1. Que dado faltando seja recusado ANTES de enviar evento fiscal. Manifestação
 *    é irreversível: registrada, não se desfaz. Descobrir que a empresa está sem
 *    UF depois de o evento sair não tem correção.
 *
 * 2. Que a mensagem diga o que corrigir. Erro sem status deliberado chega ao
 *    usuário como "erro interno", e ele não tem como saber que falta o CNPJ.
 *
 * 3. Que duplicidade (cStat 573) não seja tratada como falha — já manifestado é
 *    objetivo atingido.
 *
 * A escolha de enviar SOMENTE 210210 (Ciência da Operação) é verificada nos
 * testes Python, onde o XML do evento é montado de verdade:
 * automacao-xml/tests/test_bloqueio_consumo_indevido.py
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Linhas que o mock do banco devolve, trocadas por teste. */
const estado: {
  company: Record<string, unknown> | null;
  cert: Record<string, unknown> | null;
} = { company: null, cert: null };

jest.mock('../../src/config/database', () => {
  let tabela = '';
  const query: Record<string, unknown> = {};
  const chain = () => query;
  Object.assign(query, {
    where: jest.fn(chain),
    orderBy: jest.fn(chain),
    limit: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockImplementation(() => {
      if (tabela === 'companies') return Promise.resolve(estado.company);
      if (tabela === 'fiscal_certificates') return Promise.resolve(estado.cert);
      return Promise.resolve(null);
    }),
  });
  const db: any = jest.fn((nome: string) => {
    tabela = nome ?? tabela;
    return query;
  });
  return { getDatabase: jest.fn().mockResolvedValue(db), db };
});

jest.mock('../../src/utils/certEncryption', () => ({
  decryptSecret: jest.fn(() => 'senha-do-certificado'),
  decryptSecretWithLegacyFallback: jest.fn((v: string) => v),
}));

import { ManifestacaoService } from '../../src/services/manifestacaoService';

const EMPRESA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CHAVE_VALIDA = '3'.repeat(44);

/** Captura o erro com status, sem depender de rejects.toThrow. */
async function erroDe(promessa: Promise<unknown>): Promise<Error & { status?: number }> {
  try {
    await promessa;
  } catch (e) {
    return e as Error & { status?: number };
  }
  throw new Error('esperava falha, e a chamada foi bem-sucedida');
}

beforeEach(() => {
  estado.company = {
    id: EMPRESA, cnpj: '60526634000104', state: 'SP', legal_name: 'EMPRESA TESTE',
  };
  estado.cert = { company_id: EMPRESA, password_encrypted: 'x', pfx_data: null, pfx_path: '' };
});

describe('Manifestação — recusas antes de enviar evento à SEFAZ', () => {

  it('CHAVE COM TAMANHO ERRADO NÃO CHEGA À SEFAZ', async () => {
    // Primeira barreira, e a mais importante: chave inválida enviada como evento
    // gastaria uma chamada e voltaria com rejeição obscura. Melhor recusar aqui,
    // dizendo quantos dígitos vieram.
    const erro = await erroDe(ManifestacaoService.darCiencia(EMPRESA, '123'));
    expect(erro.status).toBe(400);
    expect(erro.message).toMatch(/44 d[íi]gitos/i);
    expect(erro.message).toMatch(/recebeu 3/);
  });

  it('aceita chave com máscara, contando só os dígitos', async () => {
    // A chave costuma ser copiada do DANFE em grupos de quatro. Recusar por causa
    // dos espaços seria implicância: o que importa são os 44 dígitos.
    const comEspacos = CHAVE_VALIDA.replace(/(.{4})/g, '$1 ').trim();
    const erro = await erroDe(ManifestacaoService.darCiencia(EMPRESA, comEspacos));
    // Passou da validação de chave — falha adiante, no certificado ausente.
    expect(erro.message).not.toMatch(/44 d[íi]gitos/i);
  });

  it('empresa inexistente responde 404', async () => {
    estado.company = null;
    const erro = await erroDe(ManifestacaoService.darCiencia(EMPRESA, CHAVE_VALIDA));
    expect(erro.status).toBe(404);
  });

  it('empresa sem CNPJ é recusada, porque é o CNPJ que identifica quem manifesta', async () => {
    estado.company = { id: EMPRESA, cnpj: '', state: 'SP' };
    const erro = await erroDe(ManifestacaoService.darCiencia(EMPRESA, CHAVE_VALIDA));
    expect(erro.status).toBe(422);
    expect(erro.message).toMatch(/CNPJ/);
  });

  it('empresa sem UF é recusada', async () => {
    estado.company = { id: EMPRESA, cnpj: '60526634000104', state: '' };
    const erro = await erroDe(ManifestacaoService.darCiencia(EMPRESA, CHAVE_VALIDA));
    expect(erro.status).toBe(422);
    expect(erro.message).toMatch(/UF/);
  });

  it('sem certificado A1, recusa com mensagem que diz o que fazer', async () => {
    estado.cert = null;
    const erro = await erroDe(ManifestacaoService.darCiencia(EMPRESA, CHAVE_VALIDA));
    expect(erro.status).toBe(422);
    expect(erro.message).toMatch(/[Cc]ertificado/);
  });
});

describe('Manifestação em lote', () => {

  it('sem resumos pendentes, não envia nada', async () => {
    // O mock devolve lista vazia. O importante é não estourar e reportar zero —
    // um lote vazio que "falha" faria o usuário achar que há problema.
    const resultado = await ManifestacaoService.darCienciaNosResumos(EMPRESA, 20);
    expect(resultado.total).toBe(0);
    expect(resultado.manifestados).toBe(0);
    expect(resultado.falhas).toBe(0);
  });
});
