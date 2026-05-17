/**
 * Testes unitários — Serviço de Autenticação
 * Cobre: JWT, bcrypt, TOTP, validação de entrada
 */

// Mocks antes de qualquer import
jest.mock('../../src/config/database', () => ({
  db: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
  },
}));

import bcrypt       from 'bcrypt';
import jwt          from 'jsonwebtoken';
import speakeasy    from 'speakeasy';
import { AuthService } from '../../src/services/authService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
  id:           'user-uuid-1',
  email:        'joao@contabil.com',
  password:     '',   // será preenchido em beforeAll
  role:         'accountant',
  mfa_enabled:  false,
  mfa_secret:   null,
  company_id:   'company-uuid-1',
  name:         'João Contador',
  created_at:   new Date().toISOString(),
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {

  beforeAll(async () => {
    mockUser.password = await bcrypt.hash('Senha@Segura123', 12);
  });

  // ── bcrypt ─────────────────────────────────────────────────────────────────

  describe('hashPassword', () => {
    it('deve gerar hash diferente da senha original', async () => {
      const hash = await AuthService.hashPassword('MinhaSenh@1');
      expect(hash).not.toBe('MinhaSenh@1');
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('deve gerar hashes distintos para a mesma senha (salt)', async () => {
      const h1 = await AuthService.hashPassword('Iguais@1');
      const h2 = await AuthService.hashPassword('Iguais@1');
      expect(h1).not.toBe(h2);
    });
  });

  describe('verifyPassword', () => {
    it('deve retornar true para senha correta', async () => {
      const valid = await AuthService.verifyPassword('Senha@Segura123', mockUser.password);
      expect(valid).toBe(true);
    });

    it('deve retornar false para senha incorreta', async () => {
      const valid = await AuthService.verifyPassword('SenhaErrada!9', mockUser.password);
      expect(valid).toBe(false);
    });
  });

  // ── JWT ────────────────────────────────────────────────────────────────────

  describe('generateAccessToken', () => {
    it('deve gerar token JWT válido', () => {
      const token = AuthService.generateAccessToken(mockUser as any);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('payload deve conter userId e role', () => {
      const token = AuthService.generateAccessToken(mockUser as any);
      const secret = process.env.JWT_SECRET ?? 'test-secret';
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.role).toBe(mockUser.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('deve gerar refresh token com expiração maior', () => {
      const token = AuthService.generateRefreshToken(mockUser.id);
      expect(typeof token).toBe('string');
      const secret  = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
      const decoded = jwt.verify(token, secret) as any;
      expect(decoded.userId).toBe(mockUser.id);
      // Refresh token deve expirar em > 1h (7d)
      expect(decoded.exp - decoded.iat).toBeGreaterThan(3600);
    });
  });

  describe('verifyAccessToken', () => {
    it('deve verificar token válido e retornar payload', () => {
      const token   = AuthService.generateAccessToken(mockUser as any);
      const payload = AuthService.verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect((payload as any).userId).toBe(mockUser.id);
    });

    it('deve retornar null para token inválido', () => {
      const result = AuthService.verifyAccessToken('token.invalido.aqui');
      expect(result).toBeNull();
    });

    it('deve retornar null para token expirado', () => {
      // Gerar token com expiração passada
      const secret  = process.env.JWT_SECRET ?? 'test-secret';
      const expired = jwt.sign({ userId: mockUser.id }, secret, { expiresIn: -1 });
      const result  = AuthService.verifyAccessToken(expired);
      expect(result).toBeNull();
    });
  });

  // ── TOTP / MFA ─────────────────────────────────────────────────────────────

  describe('generateMfaSecret', () => {
    it('deve gerar secret e URL de QR code', () => {
      const { secret, otpauthUrl } = AuthService.generateMfaSecret('teste@email.com');
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThan(10);
      expect(otpauthUrl).toContain('otpauth://');
      expect(otpauthUrl).toContain('teste');
    });
  });

  describe('verifyMfaToken', () => {
    it('deve validar código TOTP gerado com o mesmo secret', () => {
      const { secret } = AuthService.generateMfaSecret('user@test.com');
      const code = speakeasy.totp({ secret, encoding: 'base32' });
      const valid = AuthService.verifyMfaToken(secret, code);
      expect(valid).toBe(true);
    });

    it('deve rejeitar código TOTP incorreto', () => {
      const { secret } = AuthService.generateMfaSecret('user@test.com');
      const valid = AuthService.verifyMfaToken(secret, '000000');
      expect(valid).toBe(false);
    });
  });
});
