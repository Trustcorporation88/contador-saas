/**
 * Testes unitários — CnpjService
 * Cobre: validação local, chamada BrasilAPI, cache, tratamento de erros
 */

// Mocks
jest.mock('axios');
jest.mock('../../src/services/companyService', () => ({
  CompanyService: {
    validateCNPJ: jest.fn((cnpj: string) => {
      // Simular validação: aceitar CNPJs de 14 dígitos conhecidos
      const valid = ['11222333000181', '33000167000101', '00000000000191'];
      return valid.includes(cnpj);
    }),
  },
}));
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import axios from 'axios';
import { CnpjService } from '../../src/services/cnpjService';

const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockBrasilApiResponse = {
  data: {
    cnpj:                         '11222333000181',
    razao_social:                  'EMPRESA TESTE LTDA',
    nome_fantasia:                 'Teste',
    descricao_situacao_cadastral:  'ATIVA',
    situacao_cadastral:            2,
    data_situacao_cadastral:       '2020-01-01',
    descricao_tipo_logradouro:     'Rua',
    logradouro:                    'das Flores',
    numero:                        '100',
    complemento:                   'Sala 1',
    bairro:                        'Centro',
    municipio:                     'São Paulo',
    uf:                            'SP',
    cep:                           '01310100',
    ddd_telefone_1:                '11999999999',
    email:                         'contato@teste.com',
    porte:                         'MICRO EMPRESA',
    descricao_porte:               'Micro Empresa',
    natureza_juridica:             '206-2',
    cnae_fiscal:                   4751201,
    cnae_fiscal_descricao:         'Comércio varejista',
    cnaes_secundarios:             [],
    qsa:                           [{ nome_socio: 'JOÃO SILVA', qualificacao_socio: 'Sócio-Administrador' }],
    capital_social:                50000,
    opcao_pelo_simples:            true,
    opcao_pelo_mei:                false,
  },
};

describe('CnpjService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Limpar cache entre testes
    CnpjService.invalidateCache('11222333000181');
  });

  // ── validate ──────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('deve retornar valid=true para CNPJ válido', () => {
      const result = CnpjService.validate('11222333000181');
      expect(result.valid).toBe(true);
      expect(result.cnpj).toBe('11222333000181');
    });

    it('deve formatar CNPJ corretamente', () => {
      const result = CnpjService.validate('11222333000181');
      expect(result.formatted).toBe('11.222.333/0001-81');
    });

    it('deve remover caracteres não-numéricos antes de validar', () => {
      const result = CnpjService.validate('11.222.333/0001-81');
      expect(result.cnpj).toBe('11222333000181');
    });

    it('deve retornar valid=false para CNPJ inválido', () => {
      const result = CnpjService.validate('12345678901234');
      expect(result.valid).toBe(false);
    });

    it('deve retornar valid=false para string curta', () => {
      const result = CnpjService.validate('123');
      expect(result.valid).toBe(false);
    });
  });

  // ── lookup ────────────────────────────────────────────────────────────────

  describe('lookup()', () => {
    it('deve buscar CNPJ válido na BrasilAPI e retornar dados formatados', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce(mockBrasilApiResponse);
      const result = await CnpjService.lookup('11222333000181');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('11222333000181'),
        expect.any(Object),
      );
      expect(result.razao_social).toBe('EMPRESA TESTE LTDA');
      expect(result.ativa).toBe(true);
      expect(result.cached).toBe(false);
    });

    it('deve retornar resultado do cache na segunda chamada', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce(mockBrasilApiResponse);

      await CnpjService.lookup('11222333000181');
      const cached = await CnpjService.lookup('11222333000181');

      // API chamada apenas uma vez
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(cached.cached).toBe(true);
    });

    it('deve lançar 400 para CNPJ com menos de 14 dígitos', async () => {
      await expect(CnpjService.lookup('123')).rejects.toMatchObject({ status: 400 });
    });

    it('deve lançar 400 para CNPJ com dígitos inválidos', async () => {
      await expect(CnpjService.lookup('12345678901234')).rejects.toMatchObject({ status: 400 });
    });

    it('deve lançar 404 quando BrasilAPI retornar 404', async () => {
      mockedAxios.get = jest.fn().mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Not Found',
      });
      await expect(CnpjService.lookup('11222333000181')).rejects.toMatchObject({ status: 404 });
    });

    it('deve lançar 429 quando BrasilAPI retornar 429 (rate limit)', async () => {
      mockedAxios.get = jest.fn().mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Too Many Requests',
      });
      await expect(CnpjService.lookup('11222333000181')).rejects.toMatchObject({ status: 429 });
    });

    it('deve lançar 503 em falha de rede', async () => {
      mockedAxios.get = jest.fn().mockRejectedValueOnce({
        response: undefined,
        message: 'Network Error',
      });
      await expect(CnpjService.lookup('11222333000181')).rejects.toMatchObject({ status: 503 });
    });

    it('resultado deve ter estrutura correta (campos obrigatórios)', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce(mockBrasilApiResponse);
      const result = await CnpjService.lookup('11222333000181');

      expect(result).toMatchObject({
        cnpj:           expect.any(String),
        razao_social:   expect.any(String),
        situacao:       expect.any(String),
        ativa:          expect.any(Boolean),
        endereco:       expect.objectContaining({ municipio: expect.any(String), uf: expect.any(String) }),
        cnae_principal: expect.objectContaining({ codigo: expect.any(Number) }),
        fonte:          expect.stringContaining('BrasilAPI'),
      });
    });
  });

  // ── invalidateCache ───────────────────────────────────────────────────────

  describe('invalidateCache()', () => {
    it('deve forçar nova chamada à API após invalidação', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue(mockBrasilApiResponse);

      await CnpjService.lookup('11222333000181');
      CnpjService.invalidateCache('11222333000181');
      await CnpjService.lookup('11222333000181');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });
});
