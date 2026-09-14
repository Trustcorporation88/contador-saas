/**
 * Testes unitários: atividadeService (dedução da atividade pelos CNAEs)
 */
import {
  deduzirAtividade,
  divisaoDoCnae,
  ehProduto,
  atividadeValida,
  rotuloAtividade,
} from '../../src/services/atividadeService';

describe('divisaoDoCnae', () => {
  it('lê a divisão de um código de 7 dígitos', () => {
    expect(divisaoDoCnae(4772500)).toBe(47); // comércio varejista de cosméticos
    expect(divisaoDoCnae('4772-5/00')).toBe(47);
  });

  it('repõe zeros à esquerda quando o código chega como número', () => {
    // Agro 0111-3/01 vira 111301 ao virar número; sem o padding leria 11.
    expect(divisaoDoCnae(111301)).toBe(1);
    expect(divisaoDoCnae('0111301')).toBe(1);
  });

  it('ignora vazio, nulo e zero', () => {
    expect(divisaoDoCnae(null)).toBeNull();
    expect(divisaoDoCnae(undefined)).toBeNull();
    expect(divisaoDoCnae('')).toBeNull();
    expect(divisaoDoCnae(0)).toBeNull();
  });
});

describe('ehProduto', () => {
  it.each([1, 10, 33, 45, 46, 47])('divisão %i emite nota de produto', (d) => {
    expect(ehProduto(d)).toBe(true);
  });
  it.each([35, 41, 49, 62, 86, 96])('divisão %i é serviço', (d) => {
    expect(ehProduto(d)).toBe(false);
  });
});

describe('deduzirAtividade', () => {
  it('só comércio varejista: COMERCIO', () => {
    expect(deduzirAtividade(4772500, [])).toBe('COMERCIO');
  });

  it('só serviço: SERVICOS', () => {
    // 9602-5/01 cabeleireiros
    expect(deduzirAtividade(9602501, [])).toBe('SERVICOS');
  });

  it('comércio no principal e serviço no secundário: COMERCIO_SERVICO', () => {
    expect(deduzirAtividade(4772500, [{ codigo: 9602501 }])).toBe('COMERCIO_SERVICO');
  });

  it('serviço no principal e comércio no secundário: COMERCIO_SERVICO', () => {
    expect(deduzirAtividade(9602501, [{ codigo: 4772500 }])).toBe('COMERCIO_SERVICO');
  });

  it('indústria conta como comércio (emite nota de produto)', () => {
    // 2063-1/00 fabricação de cosméticos
    expect(deduzirAtividade(2063100, [])).toBe('COMERCIO');
  });

  it('sem CNAE utilizável: null (campo fica em branco, não chuta)', () => {
    expect(deduzirAtividade(null, [])).toBeNull();
    expect(deduzirAtividade(0, [{ codigo: 0 }])).toBeNull();
    expect(deduzirAtividade(undefined, undefined)).toBeNull();
  });

  it('ignora secundários inválidos sem descartar os válidos', () => {
    expect(deduzirAtividade(4772500, [{ codigo: 0 }, { codigo: null }])).toBe('COMERCIO');
  });
});

describe('atividadeValida / rotuloAtividade', () => {
  it('aceita só os três valores', () => {
    expect(atividadeValida('COMERCIO')).toBe(true);
    expect(atividadeValida('COMERCIO_SERVICO')).toBe(true);
    expect(atividadeValida('SERVICOS')).toBe(true);
    expect(atividadeValida('OUTRO')).toBe(false);
    expect(atividadeValida(null)).toBe(false);
  });
  it('rotula em português', () => {
    expect(rotuloAtividade('COMERCIO_SERVICO')).toBe('Comércio e Serviço');
    expect(rotuloAtividade(null)).toBe('');
  });
});
