/**
 * Regressão: conta desativada não pode logar.
 *
 * O login validava só e-mail e senha. Desativar um usuário no banco
 * (is_active = false) não tirava o acesso dele — o que também deixava de
 * conter as contas de demonstração criadas com senha fixa no código.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
  getRequestMetricsSnapshot: jest.fn(),
}));

const userRow: Record<string, unknown> = {};

jest.mock('../../src/config/database', () => {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  Object.assign(query, {
    where: jest.fn(chain),
    whereRaw: jest.fn(chain),
    whereNull: jest.fn(chain),
    select: jest.fn(chain),
    update: jest.fn().mockResolvedValue(1),
    insert: jest.fn().mockResolvedValue([1]),
    del: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockImplementation(() => Promise.resolve(userRow.value ?? null)),
  });
  const db: any = jest.fn(() => query);
  Object.assign(db, query, {
    schema: {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
    },
  });
  return { db, getDatabase: jest.fn().mockResolvedValue(db) };
});

import bcrypt from 'bcrypt';
import authService from '../../src/services/authService';

const SENHA = 'Senha@Segura123';

async function comUsuario(overrides: Record<string, unknown>): Promise<void> {
  userRow.value = {
    id: `user-${Math.random().toString(36).slice(2)}`,
    email: `usuario-${Math.random().toString(36).slice(2)}@empresa.com`,
    password_hash: await bcrypt.hash(SENHA, 4),
    role: 'user',
    company_id: 'company-1',
    mfa_enabled: false,
    login_attempts: 0,
    ...overrides,
  };
}

function emailAtual(): string {
  return String((userRow.value as Record<string, unknown>).email);
}

describe('login — conta desativada', () => {
  it('recusa login quando is_active = false, mesmo com a senha correta', async () => {
    await comUsuario({ is_active: false });
    await expect(authService.login(emailAtual(), SENHA)).rejects.toThrow(
      /Invalid email or password/,
    );
  });

  it('recusa login quando a coluna legada active = false', async () => {
    await comUsuario({ active: false });
    await expect(authService.login(emailAtual(), SENHA)).rejects.toThrow(
      /Invalid email or password/,
    );
  });

  it('permite login de conta ativa', async () => {
    await comUsuario({ is_active: true });
    const res = await authService.login(emailAtual(), SENHA);
    expect(res.accessToken).toBeTruthy();
  });

  it('trata schema sem coluna de status como ativo', async () => {
    await comUsuario({});
    const res = await authService.login(emailAtual(), SENHA);
    expect(res.accessToken).toBeTruthy();
  });

  it('continua recusando senha errada em conta ativa', async () => {
    await comUsuario({ is_active: true });
    await expect(authService.login(emailAtual(), 'OutraSenha#1')).rejects.toThrow(
      /Invalid email or password/,
    );
  });
});
