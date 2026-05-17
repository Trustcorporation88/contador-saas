import api from '../config/api';
import type { User } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginPayload {
  email: string;
  password: string;
}

type LoginResponse =
  | { user: User; accessToken: string; refreshToken: string }
  | { requiresMfa: true; tempToken: string };

interface MfaVerifyPayload {
  tempToken: string;
  totpToken: string;
}

interface AuthSuccessResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const AuthService = {
  /**
   * Faz login com email + senha.
   * Retorna tokens direto, ou { requiresMfa, tempToken } se MFA estiver ativo.
   */
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', payload);
    return data;
  },

  /**
   * Segunda etapa do login com TOTP (RFC 6238).
   * Recebe tempToken (emitido no login) + código de 6 dígitos do autenticador.
   */
  async verifyMfa(payload: MfaVerifyPayload): Promise<AuthSuccessResponse> {
    const { data } = await api.post<AuthSuccessResponse>(
      '/auth/verify-mfa',
      payload
    );
    return data;
  },

  /**
   * Invalida o refresh token no servidor (best-effort).
   * Falha silenciosa — estado local é limpo de qualquer forma.
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignora erros — sempre limpar estado local
    }
  },
};
