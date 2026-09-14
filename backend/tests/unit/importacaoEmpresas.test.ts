/**
 * Testes unitários: importação de empresas por planilha
 *
 * Cobre os casos reais encontrados na planilha das Líderes: CNPJ com o zero à
 * esquerda comido pelo Excel, linhas de anotação no lugar do CNPJ, categoria
 * MEI dentro do projeto Líder ME, e as variações de escrita da atividade.
 */
import {
  cnpjValido,
  normalizarCnpj,
  mapearProjeto,
  mapearAtividade,
} from '../../src/services/importacaoEmpresasService';

describe('normalizarCnpj', () => {
  it('repõe o zero à esquerda que o Excel come', () => {
    // Caso real: MARIA DO CARMO veio como número 1477539000107
    expect(normalizarCnpj(1477539000107)).toBe('01477539000107');
  });
  it('mantém CNPJ já completo e tira máscara', () => {
    expect(normalizarCnpj('38.089.747/0001-30')).toBe('38089747000130');
    expect(normalizarCnpj('38089747000130')).toBe('38089747000130');
  });
  it('texto sem dígitos vira vazio', () => {
    expect(normalizarCnpj('MIGRANDO')).toBe('');
    expect(normalizarCnpj(null)).toBe('');
  });
});

describe('cnpjValido', () => {
  it('aceita CNPJ real da planilha', () => {
    expect(cnpjValido('38089747000130')).toBe(true);
    expect(cnpjValido('01477539000107')).toBe(true);
  });
  it('rejeita dígito verificador errado, tamanho errado e repetidos', () => {
    expect(cnpjValido('38089747000131')).toBe(false);
    expect(cnpjValido('123')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
  });
});

describe('mapearProjeto', () => {
  it('LIDER ME vira LIDER_ME', () => {
    expect(mapearProjeto('LIDER ME ', 'ME')).toBe('LIDER_ME');
  });
  it('categoria MEI vence o texto do projeto', () => {
    // Caso real: linhas MEI dentro da planilha do projeto Líder ME
    expect(mapearProjeto('LIDER ME ', 'MEI')).toBe('LIDER_MEI');
  });
  it('CBPJ segue a mesma regra', () => {
    expect(mapearProjeto('CBPJ ME', 'ME')).toBe('CBPJ_ME');
    expect(mapearProjeto('CBPJ ME', 'MEI')).toBe('CBPJ_MEI');
  });
  it('sem categoria, usa o que está escrito no projeto', () => {
    expect(mapearProjeto('LIDER MEI', '')).toBe('LIDER_MEI');
    expect(mapearProjeto('LIDER ME', null)).toBe('LIDER_ME');
  });
  it('projeto desconhecido ou vazio vira null', () => {
    expect(mapearProjeto('', 'ME')).toBeNull();
    expect(mapearProjeto('OUTRO PROJETO', 'ME')).toBeNull();
  });
});

describe('mapearAtividade', () => {
  it('reconhece as variações de escrita da planilha', () => {
    expect(mapearAtividade('Serviço')).toBe('SERVICOS');
    expect(mapearAtividade('Serviço/Comércio')).toBe('COMERCIO_SERVICO');
    expect(mapearAtividade('Serviço / Comércio')).toBe('COMERCIO_SERVICO');
    expect(mapearAtividade('COMERCIO')).toBe('COMERCIO');
  });
  it('vazio vira null (campo fica em branco, sem chutar)', () => {
    expect(mapearAtividade('')).toBeNull();
    expect(mapearAtividade(null)).toBeNull();
  });
});
