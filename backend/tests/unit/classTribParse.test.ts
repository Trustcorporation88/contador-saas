/**
 * Extração da tabela cClassTrib da página do SVRS.
 *
 * O fixture (tests/fixtures/svrs-classificacao-tributaria.html) é a página REAL
 * do portal, com os 164 códigos e seus valores originais; só foram removidos os
 * Anexos (≈4.600 linhas de NCM/NBS) para caber no repositório. O prólogo e o
 * epílogo em volta do array também são os reais — um fixture que eu montasse do
 * zero provaria apenas que o parser lê o formato que eu mesmo inventei.
 */

import fs from 'fs';
import path from 'path';
import {
  extrairArrayJson, extrairClassificacoes, MINIMO_ESPERADO,
} from '../../src/services/classTribSyncService';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'svrs-classificacao-tributaria.html');
const html = fs.readFileSync(FIXTURE, 'utf8');

describe('cClassTrib — extração da página do SVRS', () => {

  it('extrai os 164 códigos da página real', () => {
    const itens = extrairClassificacoes(html);
    expect(itens).toHaveLength(164);
    expect(new Set(itens.map((i) => i.CodClassTrib)).size).toBe(164);
  });

  it('o total real fica acima do piso de sanidade', () => {
    // Se o piso passar do que a origem publica, todo sync legítimo aborta.
    expect(extrairClassificacoes(html).length).toBeGreaterThan(MINIMO_ESPERADO);
  });

  it('preserva os zeros à esquerda do código', () => {
    const itens = extrairClassificacoes(html);
    const codigos = itens.map((i) => String(i.CodClassTrib));
    // '000001' virando 1 quebraria a emissão: o campo tem 6 posições fixas.
    expect(codigos).toContain('000001');
    expect(codigos.every((c) => /^\d{6}$/.test(c))).toBe(true);
  });

  it('traz a vigência encerrada dos códigos de incorporação imobiliária', () => {
    const itens = extrairClassificacoes(html);
    const encerrados = itens.filter((i) => i.DthFimVig);
    expect(encerrados.map((i) => i.CodClassTrib).sort())
      .toEqual(['220001', '220002', '220003']);
    for (const item of encerrados) {
      expect(String(item.DthFimVig).slice(0, 10)).toBe('2026-01-01');
    }
  });

  it('herda o nome do CST do grupo pai', () => {
    const itens = extrairClassificacoes(html);
    const primeiro = itens.find((i) => i.CodClassTrib === '000001');
    expect(primeiro?.Cst).toBe('000');
    expect(primeiro?.NomeCst).toBe('Tributação integral');
  });

  it('a acentuação sobrevive ao parse', () => {
    const itens = extrairClassificacoes(html);
    const texto = itens.map((i) => i.NomeClassTrib).join(' ');
    expect(texto).toContain('Situações tributadas integralmente pelo IBS e CBS.');
    expect(texto).not.toContain('Ã§');
  });

  it('nem todo código vale para NF-e', () => {
    const itens = extrairClassificacoes(html);
    const nfe = itens.filter((i) => i.IndNfe === true);
    // 97 de 164. Oferecer os 164 na emissão é oferecer a rejeição.
    expect(nfe.length).toBe(97);
    expect(nfe.length).toBeLessThan(itens.length);
  });

  it('as reduções vêm em pontos percentuais, não em fração', () => {
    const itens = extrairClassificacoes(html);
    const valores = new Set(itens.map((i) => i.PercRedIbs).filter((v) => v !== null));
    // 60 significa 60%. Se algum dia vier 0.6, aplicar como percentual erra por
    // 100x — o teste trava a unidade em que a origem publica.
    expect(valores).toContain(60);
    expect([...valores].every((v) => Number(v) >= 0 && Number(v) <= 100)).toBe(true);
    expect([...valores].some((v) => Number(v) > 1)).toBe(true);
  });
});

describe('cClassTrib — leitura balanceada do array', () => {

  it('não para num colchete que está dentro de uma string', () => {
    // As descrições vêm da LC 214/2025 e podem conter colchetes a qualquer
    // publicação. Um indexOf(']') cortaria o array no meio.
    const texto = 'var dadosOriginais = [{"n":"item [a] e [b]","x":1}];';
    const bruto = extrairArrayJson(texto, texto.indexOf('['));
    expect(JSON.parse(bruto)).toEqual([{ n: 'item [a] e [b]', x: 1 }]);
  });

  it('não se confunde com aspas escapadas', () => {
    const texto = String.raw`x = [{"n":"aspa \" e ] fecha"}];`;
    const bruto = extrairArrayJson(texto, texto.indexOf('['));
    expect(JSON.parse(bruto)).toEqual([{ n: 'aspa " e ] fecha' }]);
  });

  it('acusa array que não fecha em vez de devolver lixo', () => {
    expect(() => extrairArrayJson('x = [{"a":1}', 4))
      .toThrow(/não fecha/i);
  });
});

describe('cClassTrib — falha visível quando a página muda', () => {

  it('acusa a ausência do marcador', () => {
    // Cenário real: o SVRS troca o nome da variável ou passa a carregar por
    // AJAX. Tem de falhar dizendo o que houve, não devolver lista vazia.
    expect(() => extrairClassificacoes('<html><body>outra pagina</body></html>'))
      .toThrow(/marcador.*não encontrado|layout/i);
  });

  it('acusa JSON inválido em vez de engolir', () => {
    expect(() => extrairClassificacoes('var dadosOriginais = [{"a": }];'))
      .toThrow(/JSON válido/i);
  });

  it('devolve vazio quando a estrutura muda para sem classificações filhas', () => {
    // Não é erro de parse: é página válida sem os dados. Quem barra este caso é
    // o piso de sanidade no sincronizar(), testado na integração.
    const texto = 'var dadosOriginais = [{"Cst":"000","ClassificacoesTributarias":null}];';
    expect(extrairClassificacoes(texto)).toEqual([]);
  });
});
