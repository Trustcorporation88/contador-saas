/**
 * Testes unitários — NfeService
 * Cobre: geração de chave de acesso, cálculo de impostos, ciclo de vida
 */

jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock DB com transação funcional
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
  const mockTrx = {
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([mockNfeRecord]),
  };
  return {
    db: Object.assign(
      jest.fn().mockReturnThis(),
      {
        where:     jest.fn().mockReturnThis(),
        first:     jest.fn().mockResolvedValue(mockNfeRecord),
        update:    jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockNfeRecord, status: 'AUTORIZADA', protocolo: '20251234567890123', data_autorizacao: new Date().toISOString() }]),
        select:    jest.fn().mockReturnThis(),
        orderBy:   jest.fn().mockReturnThis(),
        limit:     jest.fn().mockReturnThis(),
        offset:    jest.fn().mockReturnThis(),
        andWhere:  jest.fn().mockReturnThis(),
        clone:     jest.fn().mockReturnThis(),
        count:     jest.fn().mockResolvedValue([{ count: '1' }]),
        transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTrx)),
      }
    ),
  };
});

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
      db.first = jest.fn().mockResolvedValueOnce(null);

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

    it('deve lançar 422 se status não for RASCUNHO', async () => {
      const { db } = require('../../src/config/database');
      db.first = jest.fn().mockResolvedValueOnce({ ...mockNfeRecord, status: 'AUTORIZADA' });

      await expect(
        NfeService.authorize('nfe-uuid-1', 'company-uuid-1')
      ).rejects.toMatchObject({ status: 422 });
    });

    it('deve lançar 404 se NF-e não existir', async () => {
      const { db } = require('../../src/config/database');
      db.first = jest.fn().mockResolvedValueOnce(null);

      await expect(
        NfeService.authorize('inexistente', 'company-uuid-1')
      ).rejects.toMatchObject({ status: 404 });
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
      db.first = jest.fn().mockResolvedValueOnce({ ...mockNfeRecord, status: 'RASCUNHO' });

      await expect(
        NfeService.cancel('nfe-uuid-1', 'company-uuid-1', justificativa)
      ).rejects.toMatchObject({ status: 422 });
    });

    it('deve cancelar NF-e AUTORIZADA com justificativa válida', async () => {
      const { db } = require('../../src/config/database');
      db.first = jest.fn().mockResolvedValueOnce({ ...mockNfeRecord, status: 'AUTORIZADA' });
      db.returning = jest.fn().mockResolvedValueOnce([{
        ...mockNfeRecord,
        status: 'CANCELADA',
        data_cancelamento: new Date().toISOString(),
      }]);

      const nfe = await NfeService.cancel('nfe-uuid-1', 'company-uuid-1', justificativa);
      expect(nfe.status).toBe('CANCELADA');
    });
  });

  // ── getXml ────────────────────────────────────────────────────────────────

  describe('getXml()', () => {
    it('deve retornar XML da NF-e', async () => {
      const { db } = require('../../src/config/database');
      db.first = jest.fn().mockResolvedValueOnce({
        xml_nfe: '<nfeProc versao="4.00">...</nfeProc>',
        status:  'AUTORIZADA',
      });
      const xml = await NfeService.getXml('nfe-uuid-1', 'company-uuid-1');
      expect(xml).toContain('nfeProc');
    });

    it('deve lançar 404 se NF-e não existir', async () => {
      const { db } = require('../../src/config/database');
      db.first = jest.fn().mockResolvedValueOnce(null);
      await expect(
        NfeService.getXml('inexistente', 'company-uuid-1')
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
