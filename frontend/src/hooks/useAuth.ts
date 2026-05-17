import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AuthService } from '../services/authService';

// ─── Result types ─────────────────────────────────────────────────────────────

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResult {
  success: boolean;
  requiresMfa?: boolean;
  tempToken?: string;
  error?: string;
}

interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth      = useAuthStore((s) => s.setAuth);
  const storeLogout  = useAuthStore((s) => s.logout);

  /**
   * Etapa 1 do login. Se o usuário tiver MFA ativo, retorna requiresMfa + tempToken.
   * Em caso de sucesso direto, navega para /dashboard.
   */
  async function login(payload: LoginPayload): Promise<LoginResult> {
    setLoading(true);
    try {
      const response = await AuthService.login(payload);

      if ('requiresMfa' in response && response.requiresMfa) {
        return { success: false, requiresMfa: true, tempToken: response.tempToken };
      }

      if ('user' in response) {
        setAuth(response.user, response.accessToken, response.refreshToken);
        navigate('/dashboard', { replace: true });
        return { success: true };
      }

      return { success: false, error: 'Resposta inválida do servidor' };
    } catch (err) {
      return { success: false, error: extractMessage(err) };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Etapa 2 do login (MFA). Envia tempToken + código TOTP de 6 dígitos.
   * Em caso de sucesso, navega para /dashboard.
   */
  async function verifyMfa(tempToken: string, totpToken: string): Promise<ActionResult> {
    setLoading(true);
    try {
      const response = await AuthService.verifyMfa({ tempToken, totpToken });
      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/dashboard', { replace: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: extractMessage(err) };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Logout: invalida token no servidor + limpa estado local + redireciona.
   */
  async function logout(): Promise<void> {
    setLoading(true);
    try {
      await AuthService.logout();
    } finally {
      storeLogout();
      setLoading(false);
      navigate('/login', { replace: true });
    }
  }

  return { login, verifyMfa, logout, loading };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractMessage(err: unknown): string {
  if (err != null && typeof err === 'object') {
    const e = err as {
      response?: { data?: { message?: string; error?: string } };
      message?: string;
    };
    if (e.response?.data?.message) return e.response.data.message;
    if (e.response?.data?.error)   return e.response.data.error;
    if (e.message)                  return e.message;
  }
  return 'Erro de conexão. Verifique se o servidor está acessível.';
}
