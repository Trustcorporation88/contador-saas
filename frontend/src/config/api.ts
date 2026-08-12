import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { PUBLIC_ACCESS_ENABLED } from "./publicAccess";
import { createDemoAdapter } from "./demoApi";

function normalizeError(err: any): Error {
  const data = err.response?.data as Record<string, unknown> | undefined;
  const msg =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    err.message ||
    "Erro de conexao com o servidor";
  // status e response seguem anexados ao Error de propósito. Em download com
  // responseType 'blob' (XML da nota, DANFE), o corpo do erro chega como Blob:
  // nenhuma das leituras acima encontra a mensagem, e o usuário via só
  // "Request failed with status code 409" em vez do motivo real. Ler o Blob é
  // assíncrono e não caberia aqui, então quem chama recupera o texto a partir
  // de response.data — ver mensagemDeErroDeDownload em services/nfeService.ts.
  return Object.assign(new Error(msg), {
    status: err.response?.status,
    response: err.response,
  });
}

const hostname =
  typeof window !== "undefined" ? window.location.hostname : "";

/**
 * Em desenvolvimento a API está em outra porta; em qualquer host publicado o
 * frontend fala com a própria origem (o rewrite /api do vercel.json encaminha
 * para o backend), o que evita CORS.
 *
 * A checagem é por localhost e não por lista de domínios de produção: com a
 * lista, um domínio novo (app.ocontador.app, por exemplo) não era reconhecido
 * e o app publicado caía no fallback http://localhost:3000, ou seja, quebrava
 * inteiro para o usuário final.
 */
const isLocalHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "[::1]" ||
  hostname.endsWith(".localhost");

const BASE_URL = isLocalHost
  ? import.meta.env.VITE_API_URL || "http://localhost:3000"
  : import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 60000,
  adapter: PUBLIC_ACCESS_ENABLED ? createDemoAdapter() : undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config: any) => {
  const { accessToken, currentCompanyId } = useAuthStore.getState();
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  /**
   * Empresa ativa. Rotas como /contas-pagar, /contas-receber e /documentos não
   * levam o companyId na URL: o backend as escopa por req.user.companyId, que
   * vem do JWT gerado no LOGIN. O middleware applyCompanyContext existe
   * justamente para permitir a troca sem novo token, lendo este header — e o
   * header nunca era enviado.
   *
   * Consequência de não enviar: trocar de empresa no seletor mudava só o rótulo
   * na tela. Esses três módulos continuavam servindo a empresa do login, para
   * sempre, e o contador podia registrar pagamento na empresa errada acreditando
   * ter trocado. Não era cache velho; era a troca não existir.
   */
  if (currentCompanyId && config.headers) {
    config.headers['X-Company-Id'] = currentCompanyId;
  }
  config._retryCount = config._retryCount || 0;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        if (!PUBLIC_ACCESS_ENABLED) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(normalizeError(error));
      }

      try {
        const { data } = await axios.post(
          `${BASE_URL}/api/v1/auth/refresh-token`,
          { refreshToken },
        );
        const accessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        useAuthStore.getState().setAccessToken(accessToken);
        useAuthStore.getState().setRefreshToken(newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch {
        if (!PUBLIC_ACCESS_ENABLED) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(normalizeError(error));
      }
    }

    if (
      error.code === "ECONNABORTED" &&
      originalRequest &&
      (originalRequest._retryCount || 0) < 2
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delayMs = Math.pow(2, originalRequest._retryCount) * 500;

      console.warn(`Retry ${originalRequest._retryCount} after ${delayMs}ms`);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return api(originalRequest);
    }

    return Promise.reject(normalizeError(error));
  },
);

export default api;
