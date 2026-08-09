/**
 * Testes unitários — nfeEmitter (montagem do payload enviado ao pynfe)
 *
 * Cobre as validações de cadastro que evitam rejeição obscura da SEFAZ:
 * código IBGE do município, UF, CEP e município do destinatário fora da UF.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
  getDatabase: jest.fn(),
}));

jest.mock('../../src/config/env', () => ({
  envConfig: { database: { url: 'postgres://localhost/test' } },
}));

import { buildPayload, validarEmitente } from '../../src/services/nfeEmitter';

const emitente = {
  id: 'company-1',
  cnpj: '11.222.333/0001-81',
  legal_name: 'EMPRESA TESTE LTDA',
  address: 'Av Paulista',
  endereco_numero: '1000',
  endereco_bairro: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  postal_code: '01310-100',
  codigo_municipio: '3550308',
  inscricao_estadual: '123456789',
  tax_regime: 'simples_nacional',
};

const nfe = {
  numero: 1,
  serie: 1,
  modelo: 55,
  natureza_operacao: 'VENDA',
  dest_cpf_cnpj: '98765432000121',
  dest_razao_social: 'CLIENTE TESTE LTDA',
};

const itens = [
  {
    codigo_produto: 'PROD001',
    descricao: 'Produto de Teste',
    ncm: '84714100',
    cfop: '5102',
    unidade: 'UN',
    quantidade: 2,
    valor_unitario: 100,
  },
];

function payloadCom(destEndereco: Record<string, unknown>) {
  return buildPayload(
    emitente,
    {
      ...nfe,
      dest_endereco: JSON.stringify({
        endereco: destEndereco,
        inscricao_estadual: '',
        indicador_ie: 9,
      }),
    },
    itens,
    'homologacao',
    '/tmp/cert.pfx',
    'senha',
  );
}

describe('validarEmitente', () => {
  it('aceita cadastro fiscal completo', () => {
    expect(() => validarEmitente(emitente)).not.toThrow();
  });

  it('recusa código de município com 4 dígitos (código da Receita, não IBGE)', () => {
    expect(() => validarEmitente({ ...emitente, codigo_municipio: '7107' })).toThrow(
      /código IBGE do município \(7 dígitos\)/,
    );
  });

  it('recusa CEP incompleto', () => {
    expect(() => validarEmitente({ ...emitente, postal_code: '0131' })).toThrow(/CEP/);
  });

  it('recusa UF que não é sigla de 2 letras', () => {
    expect(() => validarEmitente({ ...emitente, state: 'São Paulo' })).toThrow(/UF/);
  });

  it('lista todos os campos faltantes de uma vez', () => {
    try {
      validarEmitente({ id: 'x' });
      throw new Error('deveria ter lançado');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('CNPJ');
      expect(msg).toContain('razão social');
      expect(msg).toContain('CEP');
    }
  });
});

describe('buildPayload — município do destinatário', () => {
  it('usa o código IBGE informado para o destinatário', () => {
    const payload = payloadCom({
      logradouro: 'Rua B',
      bairro: 'Centro',
      municipio: 'Campinas',
      uf: 'SP',
      cep: '13010000',
      cod_municipio: '3509502',
    }) as { destinatario: Record<string, unknown> };
    expect(payload.destinatario.cod_municipio).toBe('3509502');
    expect(payload.destinatario.uf).toBe('SP');
  });

  it('recusa destinatário em outra UF sem código IBGE, em vez de mandar o código do emitente', () => {
    expect(() =>
      payloadCom({
        logradouro: 'Rua B',
        bairro: 'Centro',
        municipio: 'Belo Horizonte',
        uf: 'MG',
        cep: '30110000',
      }),
    ).toThrow(/código IBGE do município do destinatário/);
  });

  it('aceita destinatário em outra UF com código IBGE informado', () => {
    const payload = payloadCom({
      logradouro: 'Rua B',
      bairro: 'Centro',
      municipio: 'Belo Horizonte',
      uf: 'MG',
      cep: '30110000',
      cod_municipio: '3106200',
    }) as { destinatario: Record<string, unknown> };
    expect(payload.destinatario.cod_municipio).toBe('3106200');
    expect(payload.destinatario.uf).toBe('MG');
  });

  it('na mesma UF, mantém o fallback para o município do emitente', () => {
    const payload = payloadCom({
      logradouro: 'Rua B',
      bairro: 'Centro',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01001000',
    }) as { destinatario: Record<string, unknown> };
    expect(payload.destinatario.cod_municipio).toBe('3550308');
  });
});

describe('buildPayload — Simples Nacional', () => {
  it('zera ICMS/PIS/COFINS e usa CSOSN 102 com CST NT', () => {
    const payload = payloadCom({
      logradouro: 'Rua B',
      bairro: 'Centro',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01001000',
    }) as { itens: Record<string, unknown>[] };
    const item = payload.itens[0];
    expect(item.icms_modalidade).toBe('102');
    expect(item.icms_aliquota).toBe(0);
    expect(item.pis_modalidade).toBe('07');
    expect(item.cofins_modalidade).toBe('07');
  });
});
