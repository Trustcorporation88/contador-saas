/**
 * Consulta de CNPJ tem de trazer o logradouro.
 *
 * Caso real, 12/08/2026: ao emitir NF-e para o CNPJ 43851429000103 (CASA DA
 * CERVEJA), a consulta preencheu bairro, município, UF, CEP e código IBGE — e
 * deixou o logradouro EM BRANCO. O usuário tinha de digitar a rua à mão em
 * toda emissão.
 *
 * Não era defeito de parse: a BrasilAPI devolve `logradouro: ''` mesmo. Ela e a
 * minhareceita leem o MESMO dump aberto da Receita, então trocar uma pela outra
 * não resolveria. O CNPJá mantém base própria e tem "Rua Herminio Amorim".
 *
 * Estes testes batem nas fontes DE VERDADE. Com resposta gravada, provariam que
 * o parse funciona sobre um arquivo — e o defeito estava no dado, não no parse.
 * A contrapartida é depender de rede: por isso são opt-in, e ficam fora do CI
 * (indisponibilidade de terceiro não pode pintar o build de vermelho).
 *
 *   CNPJ_LIVE_TEST=1 npx jest cnpjEnderecoCompleto
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import axios from 'axios';

const AO_VIVO = process.env.CNPJ_LIVE_TEST === '1';
const describeAoVivo = AO_VIVO ? describe : describe.skip;

/** CASA DA CERVEJA — cliente real do Flávio, e o caso que expôs o problema. */
const CNPJ_SEM_LOGRADOURO_NA_RECEITA = '43851429000103';

if (!AO_VIVO) {
  // eslint-disable-next-line no-console
  console.warn('[cnpjEnderecoCompleto] CNPJ_LIVE_TEST != 1 — pulado (não bate nas fontes).');
}

describeAoVivo('Consulta de CNPJ — endereço completo', () => {

  it('confirma que a Receita realmente não tem o logradouro deste CNPJ', async () => {
    // Fixa o pressuposto da correção. Se um dia a Receita preencher o campo,
    // este teste falha e avisa que o desvio para o CNPJá virou desnecessário —
    // em vez de ele seguir sendo chamado para sempre sem motivo.
    const { data } = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${CNPJ_SEM_LOGRADOURO_NA_RECEITA}`,
      { timeout: 15000 },
    );

    expect(data.bairro).toBeTruthy();
    expect(data.cep).toBeTruthy();
    // O campo que falta, e o motivo de existir uma terceira fonte.
    expect(data.logradouro).toBe('');
  }, 60000);

  it('o CNPJá tem o logradouro que falta', async () => {
    const { data } = await axios.get(
      `https://open.cnpja.com/office/${CNPJ_SEM_LOGRADOURO_NA_RECEITA}`,
      { timeout: 15000 },
    );

    expect(data.address.street).toBeTruthy();
    expect(String(data.address.street).toLowerCase()).toContain('herminio amorim');
  }, 60000);

  it('A CONSULTA DO SISTEMA devolve o endereço completo', async () => {
    // O teste que importa: atravessa o serviço inteiro, com as fontes reais, e
    // exige o campo preenchido. Antes da correção vinha vazio.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CnpjService } = require('../../src/services/cnpjService');

    const r = await CnpjService.lookup(CNPJ_SEM_LOGRADOURO_NA_RECEITA);

    expect(r.endereco.logradouro).toBeTruthy();
    expect(r.endereco.logradouro.toLowerCase()).toContain('herminio amorim');
    // E o que já vinha certo continua certo.
    expect(r.endereco.bairro).toBeTruthy();
    expect(r.endereco.municipio.toUpperCase()).toBe('BAURU');
    expect(r.endereco.uf).toBe('SP');
    expect(String(r.endereco.codigo_municipio_ibge)).toBe('3506003');
  }, 90000);

  it('CNPJ com endereço completo na Receita não vira consulta extra', async () => {
    // O CNPJá tem limite de requisições. Gastá-lo quando a Receita já respondeu
    // tudo o esgotaria à toa, e aí ele não estaria disponível justamente nos
    // casos incompletos, que são os únicos em que faz falta.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CnpjService } = require('../../src/services/cnpjService');

    // Banco do Brasil: cadastro completo na base aberta.
    const r = await CnpjService.lookup('00000000000191');

    expect(r.endereco.logradouro).toBeTruthy();
    expect(r.fonte).not.toContain('CNPJá');
  }, 90000);
});
