import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentCompanyId: string | null;
  isAuthenticated: boolean;
  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  setRefreshToken: (token: string) => void;
  setCurrentCompany: (companyId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentCompanyId: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setRefreshToken: (refreshToken) => set({ refreshToken }),

      setCurrentCompany: (companyId) =>
        set({ currentCompanyId: companyId }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          currentCompanyId: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'contador-auth',
      // Persist only what survives a page refresh (not accessToken — short-lived)
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        currentCompanyId: state.currentCompanyId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
