/**
 * Regressão: listagem de empresas para usuário não-admin.
 *
 * Bug: para quem não é admin, a query faz join com company_users — que também
 * tem `id`, `is_active` e `created_at`. Sem qualificar as colunas, o PostgreSQL
 * recusa com "column reference is ambiguous" e a primeira tela depois do login
 * devolvia 500 para todo usuário comum. Passava só para admin, que não faz join.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Colunas passadas a where/count/orderBy, para conferir a qualificação. */
const registro = {
  where: [] as unknown[],
  count: [] as unknown[],
  orderBy: [] as unknown[],
  whereRaw: [] as unknown[],
  joined: false,
};

jest.mock('../../src/config/database', () => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    where: jest.fn((coluna: unknown) => {
      registro.where.push(coluna);
      return builder;
    }),
    whereRaw: jest.fn((sql: unknown) => {
      registro.whereRaw.push(sql);
      return builder;
    }),
    join: jest.fn(() => {
      registro.joined = true;
      return builder;
    }),
    select: jest.fn(chain),
    clearSelect: jest.fn(chain),
    clone: jest.fn(chain),
    count: jest.fn((coluna: unknown) => {
      registro.count.push(coluna);
      return builder;
    }),
    first: jest.fn().mockResolvedValue({ total: '1' }),
    orderBy: jest.fn((coluna: unknown) => {
      registro.orderBy.push(coluna);
      return builder;
    }),
    limit: jest.fn(chain),
    offset: jest.fn().mockResolvedValue([]),
  });
  const db: any = jest.fn(() => builder);
  Object.assign(db, builder);
  return { db, getDatabase: jest.fn().mockResolvedValue(db) };
});

import { CompanyService } from '../../src/services/companyService';

/** Nome de coluna sem prefixo de tabela é ambíguo quando há join. */
function semQualificacao(colunas: unknown[]): string[] {
  return colunas
    .filter((c): c is string => typeof c === 'string')
    .filter((c) => !c.includes('.'));
}

describe('CompanyService.list — usuário não-admin (com join)', () => {
  beforeEach(() => {
    registro.where = [];
    registro.count = [];
    registro.orderBy = [];
    registro.whereRaw = [];
    registro.joined = false;
  });

  it('faz o join com company_users', async () => {
    await CompanyService.list(false, 'user-1', {});
    expect(registro.joined).toBe(true);
  });

  it('qualifica todas as colunas de where, count e orderBy', async () => {
    await CompanyService.list(false, 'user-1', {
      search: 'padaria',
      tax_regime: 'simples_nacional',
      created_from: '2026-01-01',
      created_to: '2026-12-31',
    });

    expect(semQualificacao(registro.where)).toEqual([]);
    expect(semQualificacao(registro.count)).toEqual([]);
    expect(semQualificacao(registro.orderBy)).toEqual([]);
  });

  it('conta pela chave de companies, não por "id" solto', async () => {
    await CompanyService.list(false, 'user-1', {});
    expect(registro.count).toContain('companies.id as total');
  });

  it('filtra is_active da empresa, não o do vínculo', async () => {
    await CompanyService.list(false, 'user-1', {});
    expect(registro.where).toContain('companies.is_active');
    // O is_active do vínculo continua sendo filtrado, com o prefixo dele.
    expect(registro.where).toContain('company_users.is_active');
  });

  it('ordena por created_at da empresa', async () => {
    await CompanyService.list(false, 'user-1', {});
    expect(registro.orderBy).toContain('companies.created_at');
  });

  it('qualifica a busca por razão social no whereRaw', async () => {
    await CompanyService.list(false, 'user-1', { search: 'padaria' });
    expect(String(registro.whereRaw[0])).toContain('companies.legal_name');
  });
});
