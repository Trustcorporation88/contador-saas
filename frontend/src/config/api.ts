import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import { PUBLIC_ACCESS_ENABLED } from "./publicAccess";
import { createDemoAdapter } from "./demoApi";

function normalizeError(err: AxiosError): Error {
  const data = err.response?.data as Record<string, unknown> | undefined;
  const msg =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    err.message ||
    "Erro de conexao com o servidor";
  return new Error(msg);
}

const isVercelProduction =
  typeof window !== "undefined" &&
  /\.vercel\.app$/i.test(window.location.hostname);

const isHostedFrontend =
  typeof window !== "undefined" &&
  /(^|\.)procontador\.com\.br$/i.test(window.location.hostname);

const isProduction = isVercelProduction || isHostedFrontend;

const BASE_URL = isProduction
  ? ""
  : import.meta.env.VITE_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 60_000, // Increased to 60s to handle cold starts on Vercel
  adapter: PUBLIC_ACCESS_ENABLED ? createDemoAdapter() : undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Initialize retry count for this request
  (config as any)._retryCount = (config as any)._retryCount || 0;
  return config;
});

// ─── Response interceptor: auto-refresh on 401 + retry on timeout ────────────
type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _retryCount?: number;
};

api.interceptors.response.use(
  (response: any) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig;

    // Handle 401 Unauthorized - refresh token
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
        const { data } = await axios.post<{
          data: { accessToken: string; refreshToken: string };
        }>(`${BASE_URL}/api/v1/auth/refresh-token`, { refreshToken });
        useAuthStore.getState().setAccessToken(data.data.accessToken);
        useAuthStore.getState().setRefreshToken(data.data.refreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        }
        return api(originalRequest);
      } catch {
        if (!PUBLIC_ACCESS_ENABLED) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(normalizeError(error));
      }
    }

    // Retry on timeout (ECONNABORTED) with exponential backoff
    if (
      error.code === "ECONNABORTED" &&
      originalRequest &&
      (originalRequest._retryCount || 0) < 2
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delayMs = Math.pow(2, originalRequest._retryCount) * 500; // 500ms, 1000ms

      console.warn(
        `Request timeout, retrying (attempt ${originalRequest._retryCount}/2) after ${delayMs}ms`,
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return api(originalRequest);
    }

    return Promise.reject(normalizeError(error));
  },
);

export default api;
