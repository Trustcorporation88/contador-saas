import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '../store/authStore';
import { PUBLIC_ACCESS_ENABLED } from './publicAccess';
import { createDemoAdapter } from './demoApi';

const baseUrlFromLegacy = import.meta.env.VITE_API_BASE_URL
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/api\/v1\/?$/, '')
  : '';

const isVercelProduction = 
  typeof window !== 'undefined' && 
  /\.vercel\.app$/i.test(window.location.hostname);

const isHostedFrontend =
  typeof window !== 'undefined' &&
  /(^|\.)procontador\.com\.br$/i.test(window.location.hostname);

// For Vercel and procontador.com.br: use production backend directly
// For local: use dev backend
const BASE_URL = (isVercelProduction || isHostedFrontend)
  ? (import.meta.env.VITE_API_URL || 'https://api.procontador.com.br')
  : import.meta.env.VITE_API_URL || baseUrlFromLegacy || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30_000,
  adapter: PUBLIC_ACCESS_ENABLED ? createDemoAdapter() : undefined,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ────────────────────────────
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig;

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
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<{ data: { accessToken: string; refreshToken: string } }>(
          `${BASE_URL}/api/v1/auth/refresh-token`,
          { refreshToken }
        );
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
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
