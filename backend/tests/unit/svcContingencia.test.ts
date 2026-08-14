import {
  resolverSvc,
  ufsPendentesDeConfirmacao,
  TP_EMIS,
} from '../../src/services/svcContingencia';

describe('svcContingencia', () => {
  const envOriginal = process.env.SVC_UF_MAP;
  afterEach(() => {
    if (envOriginal === undefined) delete process.env.SVC_UF_MAP;
    else process.env.SVC_UF_MAP = envOriginal;
  });

  it('usa 6 para SVC-AN e 7 para SVC-RS (material invertido circula por aí)', () => {
    expect(TP_EMIS['SVC-AN']).toBe(6);
    expect(TP_EMIS['SVC-RS']).toBe(7);
  });

  it('resolve SP como SVC-AN — caso da base atual do escritório', () => {
    delete process.env.SVC_UF_MAP;
    expect(resolverSvc('sp')).toEqual({ svc: 'SVC-AN', tpEmis: 6, origem: 'consenso' });
  });

  it('resolve PR como SVC-RS', () => {
    delete process.env.SVC_UF_MAP;
    expect(resolverSvc('PR').svc).toBe('SVC-RS');
  });

  it('RECUSA as UFs divergentes em vez de chutar', () => {
    delete process.env.SVC_UF_MAP;
    for (const uf of ['CE', 'PA', 'PI']) {
      expect(() => resolverSvc(uf)).toThrow(/divergente/i);
    }
  });

  it('aceita a divergente depois de configurada', () => {
    process.env.SVC_UF_MAP = 'CE=SVC-AN';
    expect(resolverSvc('CE')).toEqual({ svc: 'SVC-AN', tpEmis: 6, origem: 'configuracao' });
  });

  it('configuração vence o consenso — legislação muda sem esperar deploy', () => {
    process.env.SVC_UF_MAP = 'SP=SVC-RS';
    expect(resolverSvc('SP')).toEqual({ svc: 'SVC-RS', tpEmis: 7, origem: 'configuracao' });
  });

  it('ignora entrada malformada em vez de aceitar valor inválido', () => {
    process.env.SVC_UF_MAP = 'CE=SVC-XX,=,PA';
    expect(() => resolverSvc('CE')).toThrow(/divergente/i);
  });

  it('lista o que ainda falta confirmar', () => {
    process.env.SVC_UF_MAP = 'CE=SVC-AN';
    expect(ufsPendentesDeConfirmacao()).toEqual(['PA', 'PI']);
  });

  it('cobre as 27 unidades federativas entre consenso e divergentes', () => {
    delete process.env.SVC_UF_MAP;
    const todas = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
    let resolvidas = 0;
    let divergentes = 0;
    for (const uf of todas) {
      try { resolverSvc(uf); resolvidas += 1; } catch (e) {
        expect((e as { motivo?: string }).motivo).toBe('SVC_DIVERGENTE');
        divergentes += 1;
      }
    }
    expect(resolvidas + divergentes).toBe(27);
    expect(divergentes).toBe(3);
  });
});
