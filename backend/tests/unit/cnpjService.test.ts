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
    descricao_tipo_de_logradouro:  'Rua',
    logradouro:                    'das Flores',
    numero:                        '100',
    complemento:                   'Sala 1',
    bairro:                        'Centro',
    municipio:                     'São Paulo',
    uf:                            'SP',
    cep:                           '01310100',
    codigo_municipio_ibge:         3550308,
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

/**
 * CnpjService.lookup() usa TrustCorp como provedor primário (tenta várias
 * URLs candidatas) e cai para a BrasilAPI só se o TrustCorp não encontrar
 * nada. Este helper mocka axios.get de forma consciente da URL: qualquer
 * chamada para "trustcorp" recebe o comportamento de trustcorp (por padrão,
 * 404 em todas as tentativas — "não encontrado lá"), e qualquer chamada
 * para "brasilapi" recebe o comportamento configurado para o teste.
 */
function mockLookupProviders(opts: {
  trustcorp?: 'not-found' | { status: number };
  brasilapi: 'success' | { status: number } | 'network-error';
}) {
  mockedAxios.get = jest.fn().mockImplementation((url: string) => {
    if (url.includes('trustcorp')) {
      if (opts.trustcorp && opts.trustcorp !== 'not-found') {
        return Promise.reject({ response: { status: opts.trustcorp.status }, message: 'TrustCorp error' });
      }
      return Promise.reject({ response: { status: 404 }, message: 'Not Found' });
    }
    if (url.includes('brasilapi')) {
      if (opts.brasilapi === 'success') return Promise.resolve(mockBrasilApiResponse);
      if (opts.brasilapi === 'network-error') return Promise.reject({ response: undefined, message: 'Network Error' });
      return Promise.reject({ response: { status: opts.brasilapi.status }, message: 'BrasilAPI error' });
    }
    return Promise.reject(new Error(`URL não mockada neste teste: ${url}`));
  });
}

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
    it('deve buscar CNPJ válido (fallback BrasilAPI) e retornar dados formatados', async () => {
      // TrustCorp (provedor primário) não encontra em nenhuma URL candidata;
      // cai para a BrasilAPI, que tem os dados oficiais da Receita Federal.
      mockLookupProviders({ brasilapi: 'success' });
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
      mockLookupProviders({ brasilapi: 'success' });

      await CnpjService.lookup('11222333000181');
      const chamadasAntesDoCache = (mockedAxios.get as jest.Mock).mock.calls.length;
      const cached = await CnpjService.lookup('11222333000181');

      // Nenhuma chamada adicional à API na segunda busca (veio do cache)
      expect((mockedAxios.get as jest.Mock).mock.calls.length).toBe(chamadasAntesDoCache);
      expect(cached.cached).toBe(true);
    });

    it('deve lançar 400 para CNPJ com menos de 14 dígitos', async () => {
      await expect(CnpjService.lookup('123')).rejects.toMatchObject({ status: 400 });
    });

    it('deve lançar 400 para CNPJ com dígitos inválidos', async () => {
      await expect(CnpjService.lookup('12345678901234')).rejects.toMatchObject({ status: 400 });
    });

    it('deve lançar 404 quando nenhum provedor encontrar o CNPJ', async () => {
      mockLookupProviders({ brasilapi: { status: 404 } });
      await expect(CnpjService.lookup('11222333000181')).rejects.toMatchObject({ status: 404 });
    });

    it('deve lançar 429 quando a BrasilAPI retornar 429 (rate limit)', async () => {
      mockLookupProviders({ brasilapi: { status: 429 } });
      await expect(CnpjService.lookup('11222333000181')).rejects.toMatchObject({ status: 429 });
    });

    it('deve lançar 503 em falha de rede em ambos os provedores', async () => {
      mockLookupProviders({ brasilapi: 'network-error' });
      await expect(CnpjService.lookup('11222333000181')).rejects.toMatchObject({ status: 503 });
    });

    it('resultado deve ter estrutura correta (campos obrigatórios)', async () => {
      mockLookupProviders({ brasilapi: 'success' });
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
      expect(result.endereco.logradouro).toBe('Rua das Flores');
      expect(result.endereco.logradouro).not.toMatch(/undefined/i);
      expect(result.endereco.codigo_municipio_ibge).toBe('3550308');
    });

    it('não deve gerar logradouro "undefined" quando tipo/logradouro vêm vazios da BrasilAPI', async () => {
      mockedAxios.get = jest.fn().mockImplementation((url: string) => {
        if (url.includes('trustcorp')) {
          return Promise.reject({ response: { status: 404 }, message: 'Not Found' });
        }
        if (url.includes('brasilapi')) {
          return Promise.resolve({
            data: {
              ...mockBrasilApiResponse.data,
              descricao_tipo_de_logradouro: '',
              // Simula o bug: campo legado ausente (undefined) + logradouro vazio
              descricao_tipo_logradouro: undefined,
              logradouro: '',
              numero: '',
              bairro: 'PARQUE JULIO NOBREGA',
              municipio: 'BAURU',
              uf: 'SP',
              cep: '17031450',
            },
          });
        }
        return Promise.reject(new Error(`URL não mockada: ${url}`));
      });

      CnpjService.invalidateCache('11222333000181');
      const result = await CnpjService.lookup('11222333000181');
      expect(result.endereco.logradouro).toBe('');
      expect(result.endereco.logradouro).not.toContain('undefined');
      expect(result.endereco.numero).toBe('');
      expect(result.endereco.bairro).toBe('PARQUE JULIO NOBREGA');
    });
  });

  // ── invalidateCache ───────────────────────────────────────────────────────

  describe('invalidateCache()', () => {
    it('deve forçar nova chamada à API após invalidação', async () => {
      mockLookupProviders({ brasilapi: 'success' });

      await CnpjService.lookup('11222333000181');
      const chamadasAntesDeInvalidar = (mockedAxios.get as jest.Mock).mock.calls.length;
      CnpjService.invalidateCache('11222333000181');
      await CnpjService.lookup('11222333000181');

      // Após invalidar, uma nova rodada completa de chamadas é feita (não é
      // servido do cache) — mesmo comportamento da primeira busca.
      expect((mockedAxios.get as jest.Mock).mock.calls.length).toBe(2 * chamadasAntesDeInvalidar);
    });
  });
});
