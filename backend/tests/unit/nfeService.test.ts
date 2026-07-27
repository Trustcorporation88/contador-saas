/**
 * Testes unitários — NfeService
 * Cobre: geração de chave de acesso, cálculo de impostos, ciclo de vida
 *
 * Usa NFE_EMISSION_MODE=mock: o modo 'real' (assinatura A1 + transmissão à
 * SEFAZ via pynfe, em nfeEmitter.ts) tem cobertura própria em
 * automacao-xml/tests/ e depende de infraestrutura (certificado, rede) fora
 * do escopo de um teste unitário do NfeService.
 */
process.env.NFE_EMISSION_MODE = 'mock';

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// mockNfeRecord em módulo-scope para uso nos testes (não é usado dentro do factory)
const mockNfeRecord = {
  id:               'nfe-uuid-1',
  company_id:       'company-uuid-1',
  numero:           1,
  serie:            1,
  modelo:           55,
  chave_acesso:     '35250811222333000181550010000000011234567890',
  emit_cnpj:        '11222333000181',
  emit_razao_social: 'EMPRESA TESTE LTDA',
  dest_cpf_cnpj:    '98765432000121',
  dest_razao_social: 'CLIENTE TESTE LTDA',
  valor_produtos:   1000.00,
  valor_frete:      0,
  valor_desconto:   0,
  valor_icms:       120.00,
  valor_pis:        6.50,
  valor_cofins:     30.00,
  valor_total:      1000.00,
  status:           'RASCUNHO',
  natureza_operacao: 'VENDA',
  data_emissao:     new Date().toISOString(),
  created_at:       new Date().toISOString(),
  updated_at:       new Date().toISOString(),
  xml_nfe:          '<nfeProc versao="4.00">...</nfeProc>',
};

jest.mock('../../src/config/database', () => {
  // Todos os dados definidos dentro do factory (evita hoisting)
  const nfeRecord = {
    id: 'nfe-uuid-1', company_id: 'company-uuid-1',
    numero: 1, serie: 1, modelo: 55,
    chave_acesso: '35250811222333000181550010000000011234567890',
    emit_cnpj: '11222333000181', emit_razao_social: 'EMPRESA TESTE LTDA',
    dest_cpf_cnpj: '98765432000121', dest_razao_social: 'CLIENTE TESTE LTDA',
    valor_produtos: 1000, valor_frete: 0, valor_desconto: 0,
    valor_icms: 120, valor_pis: 6.5, valor_cofins: 30, valor_total: 1000,
    status: 'RASCUNHO', natureza_operacao: 'VENDA',
    data_emissao: new Date().toISOString(),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    xml_nfe: '<nfeProc versao="4.00">...</nfeProc>',
  };
  const nfeAutorizada = { ...nfeRecord, status: 'AUTORIZADA', protocolo: '20251234567890123', data_autorizacao: new Date().toISOString() };
  const mockCompany = {
    id: 'company-uuid-1', cnpj: '11222333000181', razao_social: 'EMPRESA TESTE LTDA',
    inscricao_estadual: '123456789', inscricao_municipal: '987654321', uf: 'SP',
    cep: '01310100', logradouro: 'Av Paulista', numero_endereco: '1000',
    municipio: 'São Paulo', codigo_municipio: '3550308',
  };
  const mockNumeracao = { serie: 1, modelo: 55, ultimo_numero: 0 };

  const mockTrx: any = jest.fn().mockImplementation(() => mockTrx);
  Object.assign(mockTrx, {
    insert:    jest.fn().mockReturnValue(mockTrx),
    returning: jest.fn().mockResolvedValue([nfeRecord]),
    where:     jest.fn().mockReturnValue(mockTrx),
    update:    jest.fn().mockReturnValue(mockTrx),
    select:    jest.fn().mockReturnValue(mockTrx),
  });

  // db retorna A SI MESMO para que db.first/returning possam ser sobrescritos nos testes
  // A tabela corrente é rastreada para defaults de first()
  let _currentTable = '';
  const mockDb: any = jest.fn().mockImplementation((table: string) => {
    _currentTable = table ?? _currentTable;
    return mockDb;
  });
  // Estado configurável das "notas capturadas" (fiscal_xml_captures) por teste:
  // números já emitidos pela empresa e trazidos pela captura automática da
  // SEFAZ (Distribuição DFe), independente do que foi emitido pelo ProContador.
  const fiscalCapturesState: { numeros: string[] } = { numeros: [] };

  Object.assign(mockDb, {
    where:       jest.fn().mockReturnValue(mockDb),
    andWhere:    jest.fn().mockReturnValue(mockDb),
    select:      jest.fn().mockImplementation(() => {
      if (_currentTable === 'fiscal_xml_captures') {
        return Promise.resolve(fiscalCapturesState.numeros.map((numero) => ({ numero })));
      }
      return mockDb;
    }),
    orderBy:     jest.fn().mockReturnValue(mockDb),
    limit:       jest.fn().mockReturnValue(mockDb),
    offset:      jest.fn().mockReturnValue(mockDb),
    clone:       jest.fn().mockReturnValue(mockDb),
    update:      jest.fn().mockReturnValue(mockDb),
    insert:      jest.fn().mockReturnValue(mockDb),
    returning:   jest.fn().mockImplementation(() => {
      if (_currentTable === 'nfe') return Promise.resolve([nfeAutorizada]);
      return Promise.resolve([nfeRecord]);
    }),
    count:       jest.fn().mockResolvedValue([{ count: '1' }]),
    first:       jest.fn().mockImplementation(() => {
      if (_currentTable === 'nfe_numeracao') return Promise.resolve(mockNumeracao);
      if (_currentTable === 'companies')     return Promise.resolve(mockCompany);
      if (_currentTable === 'fiscal_xml_captures') {
        const calls = mockDb.andWhereRaw.mock.calls as unknown[][];
        const ultimaChamada = calls[calls.length - 1] as [string, unknown[]] | undefined;
        const numeroConsultado = ultimaChamada?.[1]?.[0];
        const encontrado = fiscalCapturesState.numeros.some(
          (n) => Number(n) === Number(numeroConsultado),
        );
        return Promise.resolve(encontrado ? { id: 'capture-1' } : null);
      }
      return Promise.resolve(nfeRecord);
    }),
    transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTrx)),
    whereRaw:    jest.fn().mockReturnValue(mockDb),
    andWhereRaw: jest.fn().mockReturnValue(mockDb),
  });

  // O código de produção usa `getDatabase()` (assíncrono); os testes seguem
  // acessando `db` (o mesmo mock) diretamente para configurar expectativas.
  return {
    db: mockDb,
    getDatabase: jest.fn().mockResolvedValue(mockDb),
    __setFiscalCapturas: (numeros: (number | string)[]) => {
      fiscalCapturesState.numeros = numeros.map(String);
    },
  };
});

jest.mock('../../src/services/nfeEmitter', () => ({
  emitirNfeReal: jest.fn(),
  cancelarNfeReal: jest.fn(),
  getEmissionMode: jest.fn(() => 'mock'),
  getAmbiente: jest.fn(() => 'homologacao'),
  verificarNumeracaoSefaz: jest.fn().mockResolvedValue({
    ok: true,
    sefaz_online: true,
    ja_emitida_sefaz: null,
    disponivel: null,
    cStat: '107',
    motivo: 'SEFAZ online. Sem chave de acesso para consultar previamente.',
    fonte: 'sefaz_status',
    serie: 1,
    numero: 1,
  }),
}));

import { NfeService } from '../../src/services/nfeService';
import { NfeStatus }  from '../../src/models/dtos/nfeDTO';

const baseCreateDTO = {
  destinatario: {
    cpf_cnpj:     '98765432000121',
    razao_social: 'CLIENTE TESTE LTDA',
    email:        'compras@cliente.com',
  },
  itens: [
    {
      codigo_produto:  'PROD001',
      descricao:       'Produto de Teste',
      ncm:             '84714100',
      cfop:            '5102',
      unidade:         'UN',
      quantidade:      10,
      valor_unitario:  100,
      aliquota_icms:   12,
      aliquota_pis:    0.65,
      aliquota_cofins: 3,
    },
  ],
};

describe('NfeService', () => {

  // ── Criação ───────────────────────────────────────────────────────────────

  describe('create()', () => {

    it('deve criar NF-e e retornar registro com ID', async () => {
      const nfe = await NfeService.create('company-uuid-1', baseCreateDTO);
      expect(nfe.id).toBeDefined();
      expect(nfe.status).toBe('RASCUNHO');
    });

    it('deve calcular valor_total corretamente (qtd × unitário)', async () => {
      const nfe = await NfeService.create('company-uuid-1', baseCreateDTO);
      // 10 × 100 = 1000
      expect(nfe.valor_produtos).toBeCloseTo(1000, 0);
      expect(nfe.valor_total).toBeCloseTo(1000, 0);
    });

    it('deve calcular ICMS corretamente (12% sobre valor_total)', async () => {
      const nfe = await NfeService.create('company-uuid-1', baseCreateDTO);
      // 1000 × 12% = 120
      expect(nfe.valor_icms).toBeCloseTo(120, 0);
    });

    it('deve calcular PIS corretamente (0,65%)', async () => {
      const nfe = await NfeService.create('company-uuid-1', baseCreateDTO);
      // 1000 × 0,65% = 6,50
      expect(nfe.valor_pis).toBeCloseTo(6.50, 1);
    });

    it('deve calcular COFINS corretamente (3%)', async () => {
      const nfe = await NfeService.create('company-uuid-1', baseCreateDTO);
      // 1000 × 3% = 30
      expect(nfe.valor_cofins).toBeCloseTo(30, 0);
    });

    it('deve lançar 404 se empresa não existir', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce(null);

      await expect(
        NfeService.create('empresa-inexistente', baseCreateDTO)
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── Autorização ───────────────────────────────────────────────────────────

  describe('authorize()', () => {

    it('deve autorizar NF-e em status RASCUNHO', async () => {
      const nfe = await NfeService.authorize('nfe-uuid-1', 'company-uuid-1');
      expect(nfe.status).toBe('AUTORIZADA');
      expect(nfe.protocolo).toBeDefined();
    });

    it('deve lançar 422 se status não for RASCUNHO nem PENDENTE', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce({ ...mockNfeRecord, status: 'AUTORIZADA' });

      await expect(
        NfeService.authorize('nfe-uuid-1', 'company-uuid-1')
      ).rejects.toMatchObject({ status: 422 });
    });

    it('deve lançar 404 se NF-e não existir', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce(null);

      await expect(
        NfeService.authorize('inexistente', 'company-uuid-1')
      ).rejects.toMatchObject({ status: 404 });
    });

    // Cobre o bug: uma NF-e que falhou uma vez (status PENDENTE, ex.: SEFAZ
    // rejeitou, rede caiu) ficava travada para sempre — authorize() só
    // aceitava RASCUNHO, cancel() só aceitava AUTORIZADA, e não existe
    // endpoint de exclusão/edição. O número/série ficava bloqueado sem
    // nenhuma saída para o usuário ("não consigo editar ela para continuar").
    it('deve permitir nova tentativa de autorização em status PENDENTE', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce({ ...mockNfeRecord, status: 'PENDENTE' });

      const nfe = await NfeService.authorize('nfe-uuid-1', 'company-uuid-1');
      expect(nfe.status).toBe('AUTORIZADA');
    });
  });

  // ── Cancelamento ──────────────────────────────────────────────────────────

  describe('cancel()', () => {

    const justificativa = 'Cancelamento a pedido do cliente conforme solicitação';

    it('deve lançar 400 se justificativa < 15 caracteres', async () => {
      await expect(
        NfeService.cancel('nfe-uuid-1', 'company-uuid-1', 'curta')
      ).rejects.toMatchObject({ status: 400 });
    });

    it('deve lançar 422 se NF-e não estiver AUTORIZADA', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce({ ...mockNfeRecord, status: 'RASCUNHO' });

      await expect(
        NfeService.cancel('nfe-uuid-1', 'company-uuid-1', justificativa)
      ).rejects.toMatchObject({ status: 422 });
    });

    it('deve cancelar NF-e AUTORIZADA com justificativa válida (modo mock)', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce({ ...mockNfeRecord, status: 'AUTORIZADA' });
      db.returning.mockResolvedValueOnce([{
        ...mockNfeRecord,
        status: 'CANCELADA',
        data_cancelamento: new Date().toISOString(),
      }]);

      const nfe = await NfeService.cancel('nfe-uuid-1', 'company-uuid-1', justificativa);
      expect(nfe.status).toBe('CANCELADA');
    });

    // Cobre o bug: cancel() usava SEMPRE o simulador local (mockSefazCancel),
    // mesmo em modo 'real' — uma NF-e cancelada no ProContador continuava
    // autorizada/válida de verdade na SEFAZ. Em modo 'real', o cancelamento
    // precisa necessariamente passar por cancelarNfeReal() (evento SEFAZ).
    describe('em modo real (NFE_EMISSION_MODE=real)', () => {
      const { getEmissionMode, cancelarNfeReal } = require('../../src/services/nfeEmitter');

      afterEach(() => {
        (getEmissionMode as jest.Mock).mockReturnValue('mock');
      });

      it('cancela via cancelarNfeReal (SEFAZ de verdade), nunca via mock local', async () => {
        (getEmissionMode as jest.Mock).mockReturnValue('real');
        (cancelarNfeReal as jest.Mock).mockResolvedValueOnce({
          ok: true,
          ambiente: 'homologacao',
          cStat: '135',
          motivo: 'Evento registrado e vinculado a NF-e',
          protocolo: '135260000000001',
          xml_evento: '<retEvento>...</retEvento>',
        });

        const { db } = require('../../src/config/database');
        db.first.mockResolvedValueOnce({ ...mockNfeRecord, status: 'AUTORIZADA' });
        db.returning.mockResolvedValueOnce([{
          ...mockNfeRecord,
          status: 'CANCELADA',
          status_sefaz: '135',
          data_cancelamento: new Date().toISOString(),
        }]);

        const nfe = await NfeService.cancel('nfe-uuid-1', 'company-uuid-1', justificativa);

        expect(cancelarNfeReal).toHaveBeenCalledTimes(1);
        expect(nfe.status).toBe('CANCELADA');
        expect((nfe as any).status_sefaz).toBe('135');
      });

      it('não marca como cancelada se a SEFAZ rejeitar o evento de cancelamento', async () => {
        (getEmissionMode as jest.Mock).mockReturnValue('real');
        (cancelarNfeReal as jest.Mock).mockResolvedValueOnce({
          ok: false,
          ambiente: 'homologacao',
          cStat: '573',
          motivo: 'Duplicidade de evento',
          protocolo: '',
        });

        const { db } = require('../../src/config/database');
        db.first.mockResolvedValueOnce({ ...mockNfeRecord, status: 'AUTORIZADA' });

        await expect(
          NfeService.cancel('nfe-uuid-1', 'company-uuid-1', justificativa),
        ).rejects.toMatchObject({ status: 422 });
      });
    });
  });

  // ── Verificação de numeração ─────────────────────────────────────────────
  // Cobre o bug relatado: "há uma lacuna entre o último número emitido (7) e
  // o número 822" quando o 822 já havia sido emitido pela empresa (fora do
  // ProContador) e aparecia nas notas capturadas da SEFAZ.

  describe('verificarNumeracao()', () => {
    const setup = (opts: {
      capturados?: (number | string)[];
      localEncontrado?: unknown;
      ultimoNumeroLocal?: number;
    }) => {
      const { db, __setFiscalCapturas } = require('../../src/config/database');
      __setFiscalCapturas(opts.capturados ?? []);
      // Ordem de chamadas .first() dentro de verificarNumeracao(): companies, nfe, nfe_numeracao.
      db.first.mockResolvedValueOnce(mockCompanyForTests);
      db.first.mockResolvedValueOnce(opts.localEncontrado ?? null);
      db.first.mockResolvedValueOnce({
        serie: 1,
        modelo: 55,
        ultimo_numero: opts.ultimoNumeroLocal ?? 7,
      });
    };

    const mockCompanyForTests = {
      id: 'company-uuid-1', cnpj: '11222333000181', legal_name: 'EMPRESA TESTE LTDA', state: 'SP',
    };

    it('detecta número já emitido via captura da SEFAZ e bloqueia a disponibilidade', async () => {
      setup({ capturados: [7, 822], ultimoNumeroLocal: 7 });

      const resultado = await NfeService.verificarNumeracao('company-uuid-1', {
        serie: 1,
        numero: 822,
      });

      expect(resultado.disponivel).toBe(false);
      expect((resultado as any).ja_emitida_capturada).toBe(true);
      expect(resultado.mensagem).toMatch(/notas capturadas/i);
    });

    it('não acusa lacuna de numeração quando o maior número já veio de nota capturada (emitida fora do ProContador)', async () => {
      // Cenário do bug: local só confirma até 7, mas 822 já existe via captura.
      // Pedir o 823 (próximo depois do maior número real) não deve soar alarme de "lacuna".
      setup({ capturados: [7, 822], ultimoNumeroLocal: 7 });

      const resultado = await NfeService.verificarNumeracao('company-uuid-1', {
        serie: 1,
        numero: 823,
      });

      expect(resultado.salto_numeracao).toBe(false);
      expect(resultado.ultimo_numero_registrado).toBe(822);
    });

    it('sem notas capturadas, mantém o comportamento anterior de acusar lacuna', async () => {
      setup({ capturados: [], ultimoNumeroLocal: 7 });

      const resultado = await NfeService.verificarNumeracao('company-uuid-1', {
        serie: 1,
        numero: 822,
      });

      expect(resultado.salto_numeracao).toBe(true);
      expect(resultado.ultimo_numero_registrado).toBe(7);
    });
  });

  // ── getXml ────────────────────────────────────────────────────────────────

  describe('getXml()', () => {
    it('deve retornar XML da NF-e', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce({
        xml_nfe: '<nfeProc versao="4.00">...</nfeProc>',
        status:  'AUTORIZADA',
      });
      const xml = await NfeService.getXml('nfe-uuid-1', 'company-uuid-1');
      expect(xml).toContain('nfeProc');
    });

    it('deve lançar 404 se NF-e não existir', async () => {
      const { db } = require('../../src/config/database');
      db.first.mockResolvedValueOnce(null);
      await expect(
        NfeService.getXml('inexistente', 'company-uuid-1')
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
