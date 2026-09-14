/**
 * Testes unitários: applyCompanyContext (fallback de empresa) e o código de
 * erro SEM_EMPRESA_ATIVA nos controllers escopados por empresa.
 *
 * Bug corrigido: usuário criado pela tela de gestão nasce sem users.company_id,
 * o token vem com companyId vazio, e os módulos escopados pelo token (contas a
 * pagar/receber, documentos) respondiam 401 para um usuário autenticado. O
 * frontend tratava 401 como sessão vencida e derrubava a pessoa para o login
 * no primeiro clique. Agora: o middleware resolve a primeira empresa vinculada
 * quando o token não traz nenhuma, e quando não há vínculo algum a resposta é
 * 403 SEM_EMPRESA_ATIVA (que não desloga).
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const vinculoRow: { company_id: string } | undefined = { company_id: 'emp-1' };
let vinculoAtual: { company_id: string } | undefined = vinculoRow;

jest.mock('../../src/config/database', () => {
  const builder: any = {};
  Object.assign(builder, {
    join: jest.fn(() => builder),
    where: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    first: jest.fn(async () => vinculoAtual),
  });
  const db: any = jest.fn(() => builder);
  return { getDatabase: async () => db };
});

jest.mock('../../src/services/tenantService', () => ({
  TenantService: { validateUserAccess: jest.fn(async () => ({ isValid: true })) },
}));

import { applyCompanyContext } from '../../src/middleware/companyContext';
import { ContasPagarController } from '../../src/controllers/contasPagarController';

function makeRes() {
  const res: any = { statusCode: 0, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

describe('applyCompanyContext: fallback da primeira empresa vinculada', () => {
  it('token sem companyId e sem header: assume a primeira empresa vinculada', async () => {
    vinculoAtual = { company_id: 'emp-1' };
    const req: any = { user: { id: 'u1', role: 'accountant', companyId: '' }, headers: {} };
    const next = jest.fn();
    await applyCompanyContext(req, makeRes(), next);
    expect(req.user.companyId).toBe('emp-1');
    expect(next).toHaveBeenCalled();
  });

  it('token sem companyId e sem vínculo nenhum: segue sem empresa (controller decide)', async () => {
    vinculoAtual = undefined;
    const req: any = { user: { id: 'u1', role: 'accountant', companyId: '' }, headers: {} };
    const next = jest.fn();
    await applyCompanyContext(req, makeRes(), next);
    expect(req.user.companyId).toBe('');
    expect(next).toHaveBeenCalled();
  });

  it('token já com companyId: não consulta nada e segue', async () => {
    const req: any = { user: { id: 'u1', role: 'accountant', companyId: 'emp-9' }, headers: {} };
    const next = jest.fn();
    await applyCompanyContext(req, makeRes(), next);
    expect(req.user.companyId).toBe('emp-9');
    expect(next).toHaveBeenCalled();
  });
});

describe('controllers escopados: sem empresa é 403 SEM_EMPRESA_ATIVA, nunca 401', () => {
  it('contas a pagar sem empresa não derruba a sessão', async () => {
    const res = makeRes();
    await ContasPagarController.listar(
      { user: { id: 'u1', role: 'accountant', companyId: '' }, query: {} } as any,
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body?.code).toBe('SEM_EMPRESA_ATIVA');
  });
});
