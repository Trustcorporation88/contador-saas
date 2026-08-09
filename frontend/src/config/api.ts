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
  return new Error(msg);
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
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
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
