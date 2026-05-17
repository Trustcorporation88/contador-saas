import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Config — Contador SaaS
 * Testa os fluxos críticos contra o servidor de dev (Vite:5173 + API:3000)
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,   // testes dependem de estado (auth cookies)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL:   'http://localhost:5173',
    headless:  true,
    trace:     'on-first-retry',
    screenshot: 'only-on-failure',
    video:     'retain-on-failure',
    locale:    'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Inicia o servidor de dev automaticamente antes dos testes
  webServer: {
    command: 'npm run dev',
    url:     'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
