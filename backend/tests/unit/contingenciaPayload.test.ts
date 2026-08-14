import { buildPayload } from '../../src/services/nfeEmitter';
import { resolverSvc } from '../../src/services/svcContingencia';

const company = {
  id: 'c1', razao_social: 'EMPRESA TESTE LTDA', cnpj: '50151910000143',
  state: 'SP', endereco_uf: 'SP', endereco_municipio: 'Bauru',
  endereco_logradouro: 'Rua A', endereco_numero: '1', endereco_bairro: 'Centro',
  endereco_cep: '17000000', codigo_municipio: '3506003', inscricao_estadual: '123',
  tax_regime: 'simples', crt: '1',
} as never;

const nfe = {
  id: 'n1', modelo: 55, numero: 1, serie: 1, natureza_operacao: 'VENDA',
  dest_cpf_cnpj: '50151910000143', dest_razao_social: 'CLIENTE', dest_endereco: null,
  valor_frete: 0, valor_desconto: 0, forma_pagamento: '01', tipo_documento: 1,
} as never;

const itens = [] as never;

describe('contingência no payload da emissão', () => {
  it('nota normal não carrega bloco de contingência (tpEmis fica 1)', () => {
    const p = buildPayload(company, nfe, itens, 'homologacao', '/tmp/c.pfx', 'x');
    expect(p.contingencia).toBeUndefined();
  });

  it('SP entra na SVC-AN com tpEmis 6', () => {
    const { svc, tpEmis } = resolverSvc('SP');
    const p = buildPayload(company, nfe, itens, 'homologacao', '/tmp/c.pfx', 'x', {
      svc,
      tp_emis: tpEmis,
      justificativa: 'SEFAZ SP indisponivel conforme consulta de status do servico',
    });
    expect(p.contingencia).toEqual({
      svc: 'SVC-AN',
      tp_emis: 6,
      justificativa: 'SEFAZ SP indisponivel conforme consulta de status do servico',
    });
  });

  it('PR entra na SVC-RS com tpEmis 7', () => {
    const { svc, tpEmis } = resolverSvc('PR');
    const p = buildPayload(company, nfe, itens, 'homologacao', '/tmp/c.pfx', 'x', {
      svc, tp_emis: tpEmis, justificativa: 'x'.repeat(25),
    });
    expect((p.contingencia as { svc: string; tp_emis: number }).svc).toBe('SVC-RS');
    expect((p.contingencia as { tp_emis: number }).tp_emis).toBe(7);
  });
});
