/**
 * Testes unitários: permissões de empresa no CompanyController
 *
 * Duas regras cobertas:
 *  1. Criar empresa: admin e contador (accountant) podem; manager, auditor e
 *     viewer não. O contador cria as empresas dos clientes dele e é vinculado
 *     automaticamente pelo CompanyService.create.
 *  2. Editar empresa: admin edita qualquer uma; os demais papéis só editam
 *     empresa a que estão vinculados (company_users). Sem isso, qualquer
 *     usuário autenticado editava qualquer empresa informando o id.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const createMock = jest.fn();
const updateMock = jest.fn();
const vinculoMock = jest.fn();
jest.mock('../../src/services/companyService', () => ({
  CompanyService: {
    create: (...a: unknown[]) => createMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    usuarioTemVinculo: (...a: unknown[]) => vinculoMock(...a),
  },
}));

import { CompanyController } from '../../src/controllers/companyController';

function makeRes() {
  const res: any = { statusCode: 0, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

const corpoValido = { cnpj: '11222333000181', name: 'Empresa X', tax_regime: 'simples_nacional' };

beforeEach(() => {
  createMock.mockReset().mockResolvedValue({ id: 'c1' });
  updateMock.mockReset().mockResolvedValue({ id: 'c1', name: 'Empresa X' });
  vinculoMock.mockReset();
});

describe('createCompany: quem pode criar', () => {
  it.each(['admin', 'accountant'])('papel %s cria empresa', async (role) => {
    const res = makeRes();
    await CompanyController.createCompany(
      { user: { id: 'u1', role }, body: corpoValido } as any, res,
    );
    expect(res.statusCode).toBe(201);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ cnpj: corpoValido.cnpj }), 'u1');
  });

  it.each(['manager', 'auditor', 'viewer'])('papel %s é barrado com 403', async (role) => {
    const res = makeRes();
    await CompanyController.createCompany(
      { user: { id: 'u1', role }, body: corpoValido } as any, res,
    );
    expect(res.statusCode).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('updateCompany: admin ou vinculado', () => {
  const reqBase = (role: string) => ({
    user: { id: 'u1', role },
    params: { id: 'c1' },
    body: { name: 'Novo nome' },
  }) as any;

  it('admin edita sem precisar de vínculo', async () => {
    const res = makeRes();
    await CompanyController.updateCompany(reqBase('admin'), res);
    expect(res.statusCode).toBe(200);
    expect(vinculoMock).not.toHaveBeenCalled();
  });

  it('contador vinculado edita', async () => {
    vinculoMock.mockResolvedValue(true);
    const res = makeRes();
    await CompanyController.updateCompany(reqBase('accountant'), res);
    expect(vinculoMock).toHaveBeenCalledWith('u1', 'c1');
    expect(res.statusCode).toBe(200);
  });

  it('contador SEM vínculo recebe 403 e o update não roda', async () => {
    vinculoMock.mockResolvedValue(false);
    const res = makeRes();
    await CompanyController.updateCompany(reqBase('accountant'), res);
    expect(res.statusCode).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('viewer sem vínculo também recebe 403', async () => {
    vinculoMock.mockResolvedValue(false);
    const res = makeRes();
    await CompanyController.updateCompany(reqBase('viewer'), res);
    expect(res.statusCode).toBe(403);
  });
});
