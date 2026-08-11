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

type ApiEnvelope<T> = { data: T } | T;

interface ForgotPasswordPayload {
  email: string;
}

interface ForgotPasswordResponse {
  message: string;
  debugToken?: string;
}

interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const AuthService = {
  /**
   * Faz login com email + senha.
   * Retorna tokens direto, ou { requiresMfa, tempToken } se MFA estiver ativo.
   */
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const response = await api.post<ApiEnvelope<LoginResponse>>('/auth/login', payload);
    const body = response.data as ApiEnvelope<LoginResponse>;
    return ('data' in body ? body.data : body) as LoginResponse;
  },

  /**
   * Segunda etapa do login com TOTP (RFC 6238).
   * Recebe tempToken (emitido no login) + código de 6 dígitos do autenticador.
   */
  async verifyMfa(payload: MfaVerifyPayload): Promise<AuthSuccessResponse> {
    // O tempToken vai no CABEÇALHO, não no corpo: a rota passa por
    // authenticateToken, que monta req.user a partir do Authorization. Mandando
    // só no corpo, o controller respondia 401 "MFA setup required" — o usuário
    // ainda não tem sessão, então o interceptor não anexa nada sozinho.
    const response = await api.post<ApiEnvelope<AuthSuccessResponse>>(
      '/auth/verify-mfa',
      { code: payload.totpToken },
      { headers: { Authorization: `Bearer ${payload.tempToken}` } },
    );
    const body = response.data as ApiEnvelope<AuthSuccessResponse>;
    return ('data' in body ? body.data : body) as AuthSuccessResponse;
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

  async forgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
    const { data } = await api.post<{ data: ForgotPasswordResponse }>('/auth/forgot-password', payload);
    return data.data;
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
    const { data } = await api.post<{ data: { message: string } }>('/auth/reset-password', payload);
    return data.data;
  },
};
