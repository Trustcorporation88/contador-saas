/**
 * "undefined" não pode virar conteúdo de campo.
 *
 * Caso real: duas empresas em produção têm o endereço gravado como "undefined"
 * e "undefined SETE DE SETEMBRO". Veio de uma interpolação com variável vazia
 * — `${tipo} ${logradouro}` sem o tipo — em algum ponto entre a consulta de
 * CNPJ e o banco. Endereço é impresso no DANFE.
 *
 * Havia guarda no frontend, mas com `/^(undefined|null)$/`: só casava a palavra
 * SOZINHA. O caso real é ela GRUDADA no conteúdo, e passava direto. Os dois
 * formatos estão fixados aqui.
 */

import { semPlaceholder, textoLivre } from '../../src/utils/textoLimpo';

describe('textoLivre — o token grudado no conteúdo', () => {

  it('remove "undefined" preservando o resto do endereço', () => {
    // Exatamente o que está gravado na RR VESTUARIO.
    expect(textoLivre('undefined SETE DE SETEMBRO')).toBe('SETE DE SETEMBRO');
  });

  it('descarta quando o valor inteiro é "undefined"', () => {
    // O caso da DAVI CHAVES VOLPATO: não sobra nada, e null é a verdade.
    expect(textoLivre('undefined')).toBeNull();
    expect(textoLivre('  undefined  ')).toBeNull();
    expect(textoLivre('null')).toBeNull();
    expect(textoLivre('NaN')).toBeNull();
  });

  it('junta o espaço que sobra quando um pedaço da composição some', () => {
    // "Rua  VENANCIO..." (com espaço duplo) está gravado na CASA DA CERVEJA:
    // mesma origem, um pedaço vazio no meio da composição.
    expect(textoLivre('Rua  VENANCIO RAMALHO')).toBe('Rua VENANCIO RAMALHO');
    expect(textoLivre('Avenida undefined Paulista')).toBe('Avenida Paulista');
  });

  it('não mexe em endereço legítimo', () => {
    expect(textoLivre('Rua Sete de Setembro')).toBe('Rua Sete de Setembro');
    expect(textoLivre('Avenida Hipodromo')).toBe('Avenida Hipodromo');
    expect(textoLivre('Travessa 15 de Novembro, 1º andar')).toBe('Travessa 15 de Novembro, 1º andar');
  });

  it('não recorta palavra que apenas CONTÉM o token', () => {
    // Sem a borda de palavra, "Rua Nullo" viraria "Rua o". O limite é o \b.
    expect(textoLivre('Rua Nullo')).toBe('Rua Nullo');
    expect(textoLivre('Rua Undefinedo')).toBe('Rua Undefinedo');
    expect(textoLivre('Condomínio Nulls Park')).toBe('Condomínio Nulls Park');
  });

  it('trata vazio, nulo e indefinido como ausência', () => {
    expect(textoLivre('')).toBeNull();
    expect(textoLivre('   ')).toBeNull();
    expect(textoLivre(null)).toBeNull();
    expect(textoLivre(undefined)).toBeNull();
  });

  it('descarta os "não informado" que as consultas de CNPJ devolvem', () => {
    for (const valor of ['n/a', 'N/A', 'não informado', 'nao informado', '-', '--']) {
      expect(textoLivre(valor)).toBeNull();
    }
  });
});

describe('semPlaceholder — descarte de valor inteiro, sem recortar o meio', () => {

  it('preserva e-mail que contém o token', () => {
    // É o motivo de e-mail e telefone não passarem por textoLivre: recortar o
    // meio produziria "@dominio.com", um endereço inválido gravado como bom.
    expect(semPlaceholder('undefined@dominio.com')).toBe('undefined@dominio.com');
    expect(textoLivre('undefined@dominio.com')).toBe('@dominio.com');
  });

  it('descarta quando o valor inteiro não diz nada', () => {
    expect(semPlaceholder('undefined')).toBeNull();
    expect(semPlaceholder('NULL')).toBeNull();
    expect(semPlaceholder('')).toBeNull();
    expect(semPlaceholder(null)).toBeNull();
  });

  it('mantém valor legítimo, só tirando espaço das pontas', () => {
    expect(semPlaceholder('  contato@empresa.com.br  ')).toBe('contato@empresa.com.br');
    expect(semPlaceholder('SP')).toBe('SP');
  });
});
