/**
 * Testes unitários: ProjetoAlertaService
 *
 * Cobre a régua do MEI (teto proporcional, meses de atividade), o mapeamento
 * projeto→porte→alerta, e a lógica de abrir/atualizar/resolver alertas de uma
 * empresa conforme faturamento e situação no Simples.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// CnpjService.lookup é controlado por teste.
const lookupMock = jest.fn();
jest.mock('../../src/services/cnpjService', () => ({
  CnpjService: { lookup: (...a: unknown[]) => lookupMock(...a) },
}));

// Um "banco" mínimo em memória para company_alertas.
interface Linha { id: string; company_id: string; tipo: string; status: string; severidade: string; mensagem: string; contexto: string; email_enviado_em: null; resolvido_em: string | null; }
const store: Linha[] = [];
let faturamentoFake = 0;
let seq = 1;

function makeDb() {
  const db: any = (tabela: string) => builder(tabela);
  db.fn = { now: () => 'NOW()' };
  db.raw = (s: string) => ({ sql: s });
  return db;

  function builder(tabela: string) {
    let filtro: Record<string, unknown> = {};
    const api: any = {
      where(obj: Record<string, unknown>) { filtro = { ...filtro, ...obj }; return api; },
      whereRaw() { return api; },
      andWhere() { return api; },
      first: async () => {
        if (tabela === 'company_alertas') {
          return store.find((r) => match(r, filtro)) ?? undefined;
        }
        return undefined;
      },
      sum: () => api,
      async then(resolve: (v: unknown) => void) {
        // usado pelo faturamentoAnoAtual: .sum().first() cai no first acima,
        // mas se for await direto, devolve faturamento.
        resolve([{ total: faturamentoFake }]);
      },
      update: async (patch: Record<string, unknown>) => {
        const alvos = store.filter((r) => match(r, filtro));
        for (const r of alvos) Object.assign(r, patch);
        return alvos.length;
      },
      insert: async (row: Record<string, unknown>) => {
        store.push({ id: `a${seq++}`, email_enviado_em: null, resolvido_em: null, ...(row as any) });
        return [{ id: `a${seq}` }];
      },
      orderBy: () => api,
      orderByRaw: () => api,
      select: async () => store.filter((r) => match(r, filtro)),
    };
    // faturamentoAnoAtual faz .where().whereRaw().sum().first()
    api.sum = () => ({ first: async () => ({ total: faturamentoFake }) });
    return api;
  }
  function match(r: Linha, f: Record<string, unknown>) {
    return Object.entries(f).every(([k, v]) => (r as any)[k] === v);
  }
}

const dbFake = makeDb();
jest.mock('../../src/config/database', () => ({
  getDatabase: async () => dbFake,
}));

import {
  ProjetoAlertaService,
  tetoProporcional,
  mesesDesde,
  projetoValido,
  rotuloProjeto,
  TETO_MEI_ANUAL,
} from '../../src/services/projetoAlertaService';

beforeEach(() => {
  store.length = 0;
  faturamentoFake = 0;
  seq = 1;
  lookupMock.mockReset();
});

describe('projetoValido / rotuloProjeto', () => {
  it('aceita projetos conhecidos e rejeita o resto', () => {
    expect(projetoValido('LIDER_MEI')).toBe(true);
    expect(projetoValido('CBPJ_ME')).toBe(true);
    expect(projetoValido('OUTRO')).toBe(false);
    expect(projetoValido(null)).toBe(false);
  });
  it('rotula em português', () => {
    expect(rotuloProjeto('CBPJ_MEI')).toBe('CBPJ MEI');
    expect(rotuloProjeto(null)).toBe('');
  });
});

describe('tetoProporcional', () => {
  it('12 meses = teto cheio', () => {
    expect(tetoProporcional(12)).toBeCloseTo(TETO_MEI_ANUAL);
  });
  it('6 meses = metade', () => {
    expect(tetoProporcional(6)).toBeCloseTo(TETO_MEI_ANUAL / 2);
  });
  it('nunca abaixo de 1 mês nem acima de 12', () => {
    expect(tetoProporcional(0)).toBeCloseTo(TETO_MEI_ANUAL / 12);
    expect(tetoProporcional(99)).toBeCloseTo(TETO_MEI_ANUAL);
  });
});

describe('mesesDesde', () => {
  it('data nula = 12 (assume ano cheio)', () => {
    expect(mesesDesde(null)).toBe(12);
  });
  it('mesmo mês = 1', () => {
    expect(mesesDesde(new Date())).toBe(1);
  });
});

describe('verificarEmpresa, projetos ME (exclusão do Simples)', () => {
  it('abre alerta crítico quando NÃO é optante do Simples', async () => {
    lookupMock.mockResolvedValue({ simples_nacional: false });
    const r = await ProjetoAlertaService.verificarEmpresa(
      { id: 'e1', cnpj: '11222333000181', legal_name: 'Loja ME', projeto: 'LIDER_ME' }, dbFake as any,
    );
    expect(r.abertos).toBe(1);
    const alerta = store.find((a) => a.company_id === 'e1');
    expect(alerta?.tipo).toBe('exclusao_sn');
    expect(alerta?.severidade).toBe('critico');
    expect(alerta?.status).toBe('aberto');
  });

  it('resolve o alerta quando volta a ser optante', async () => {
    // já existe um alerta aberto
    store.push({ id: 'x', company_id: 'e1', tipo: 'exclusao_sn', status: 'aberto', severidade: 'critico', mensagem: 'm', contexto: '{}', email_enviado_em: null, resolvido_em: null });
    lookupMock.mockResolvedValue({ simples_nacional: true });
    const r = await ProjetoAlertaService.verificarEmpresa(
      { id: 'e1', cnpj: '11222333000181', projeto: 'CBPJ_ME' }, dbFake as any,
    );
    expect(r.resolvidos).toBe(1);
    expect(store.find((a) => a.id === 'x')?.status).toBe('resolvido');
  });
});

describe('verificarEmpresa, projetos MEI (desenquadramento)', () => {
  it('abre alerta quando o faturamento passa de 80% do teto', async () => {
    lookupMock.mockResolvedValue({ simples_nacional: true });
    faturamentoFake = 70000; // > 80% de 81000
    const r = await ProjetoAlertaService.verificarEmpresa(
      { id: 'e2', cnpj: '11222333000181', legal_name: 'MEI X', projeto: 'CBPJ_MEI', created_at: new Date(new Date().getFullYear(), 0, 1) }, dbFake as any,
    );
    expect(r.abertos).toBe(1);
    const alerta = store.find((a) => a.company_id === 'e2');
    expect(alerta?.tipo).toBe('desenquadramento_mei');
  });

  it('não abre alerta com faturamento baixo e optante', async () => {
    lookupMock.mockResolvedValue({ simples_nacional: true });
    faturamentoFake = 1000;
    const r = await ProjetoAlertaService.verificarEmpresa(
      { id: 'e3', cnpj: '11222333000181', projeto: 'LIDER_MEI', created_at: new Date(new Date().getFullYear(), 0, 1) }, dbFake as any,
    );
    expect(r.abertos).toBe(0);
    expect(store.length).toBe(0);
  });

  it('abre alerta crítico se saiu do Simples, mesmo com faturamento baixo', async () => {
    lookupMock.mockResolvedValue({ simples_nacional: false });
    faturamentoFake = 100;
    const r = await ProjetoAlertaService.verificarEmpresa(
      { id: 'e4', cnpj: '11222333000181', projeto: 'CBPJ_MEI', created_at: new Date(new Date().getFullYear(), 0, 1) }, dbFake as any,
    );
    expect(r.abertos).toBe(1);
    expect(store.find((a) => a.company_id === 'e4')?.severidade).toBe('critico');
  });

  it('lookup falhando não gera alerta de Simples nem quebra', async () => {
    lookupMock.mockRejectedValue(new Error('timeout'));
    faturamentoFake = 100;
    const r = await ProjetoAlertaService.verificarEmpresa(
      { id: 'e5', cnpj: '11222333000181', projeto: 'CBPJ_MEI', created_at: new Date(new Date().getFullYear(), 0, 1) }, dbFake as any,
    );
    expect(r.abertos).toBe(0);
  });
});

describe('definirProjeto', () => {
  it('rejeita projeto inválido', async () => {
    await expect(ProjetoAlertaService.definirProjeto('e1', 'NAO_EXISTE'))
      .rejects.toMatchObject({ status: 400 });
  });
});
