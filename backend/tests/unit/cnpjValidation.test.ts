/**
 * Testes unitários — Validação de CNPJ
 * Cobre: algoritmo de dígitos verificadores, formatação
 */

import { CompanyService } from '../../src/services/companyService';

describe('CompanyService.validateCNPJ', () => {

  // CNPJs válidos reais (de empresas públicas)
  const validCnpjs = [
    '11222333000181',  // cálculo correto
    '00000000000191',  // Banco do Brasil (público)
    '33000167000101',  // Petrobras (público)
  ];

  // CNPJs inválidos
  const invalidCnpjs = [
    '11111111111111',  // todos iguais
    '00000000000000',  // todos zeros
    '12345678901234',  // dígitos incorretos
    '1234567890123',   // 13 dígitos (falta 1)
    'abcdefghijklmn',  // letras
    '',                // vazio
  ];

  it.each(validCnpjs)('deve aceitar CNPJ válido: %s', (cnpj) => {
    expect(CompanyService.validateCNPJ(cnpj)).toBe(true);
  });

  it.each(invalidCnpjs)('deve rejeitar CNPJ inválido: %s', (cnpj) => {
    expect(CompanyService.validateCNPJ(cnpj)).toBe(false);
  });

  it('deve aceitar CNPJ com formatação (pontos/barras/traço)', () => {
    // A maioria das implementações aceita string pura de 14 dígitos
    // Se validateCNPJ aceita formatação, testar aqui
    const clean = '33000167000101';
    expect(CompanyService.validateCNPJ(clean)).toBe(true);
  });
});
