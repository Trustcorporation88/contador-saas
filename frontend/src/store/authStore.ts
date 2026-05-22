import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { DEMO_COMPANY_ID, PUBLIC_ACCESS_ENABLED, PUBLIC_ACCESS_USER } from '../config/publicAccess';

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
      user: PUBLIC_ACCESS_ENABLED ? PUBLIC_ACCESS_USER : null,
      accessToken: null,
      refreshToken: null,
      currentCompanyId: PUBLIC_ACCESS_ENABLED ? DEMO_COMPANY_ID : null,
      isAuthenticated: PUBLIC_ACCESS_ENABLED,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setRefreshToken: (refreshToken) => set({ refreshToken }),

      setCurrentCompany: (companyId) =>
        set({ currentCompanyId: companyId }),

      logout: () =>
        set(
          PUBLIC_ACCESS_ENABLED
            ? {
                user: PUBLIC_ACCESS_USER,
                accessToken: null,
                refreshToken: null,
                currentCompanyId: null,
                isAuthenticated: true,
              }
            : {
                user: null,
                accessToken: null,
                refreshToken: null,
                currentCompanyId: null,
                isAuthenticated: false,
              }
        ),
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
      merge: (persistedState, currentState) => {
        if (PUBLIC_ACCESS_ENABLED) {
          return {
            ...currentState,
            user: PUBLIC_ACCESS_USER,
            accessToken: null,
            refreshToken: null,
            currentCompanyId: DEMO_COMPANY_ID,
            isAuthenticated: true,
          };
        }

        return {
          ...currentState,
          ...(persistedState as Partial<AuthState>),
        };
      },
    }
  )
);
