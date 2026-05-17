/**
 * auth.spec.ts — Testes E2E de autenticação
 * Cobre: Login com credenciais válidas/inválidas, redirect, logout
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL    = process.env.TEST_EMAIL    ?? 'admin@contador.dev';
const ADMIN_PASSWORD = process.env.TEST_PASSWORD ?? 'Admin@123';

test.describe('Autenticação', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('exibe página de login', async ({ page }) => {
    await expect(page).toHaveTitle(/Contador/i);
    await expect(page.getByRole('heading', { name: /entrar|login/i })).toBeVisible();
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  test('rejeita credenciais inválidas', async ({ page }) => {
    await page.getByLabel(/e-mail/i).fill('invalido@teste.com');
    await page.getByLabel(/senha/i).fill('senhaerrada');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    await page.getByLabel(/e-mail/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();

    // Aguarda redirecionamento — pode ter MFA ou ir direto ao dashboard
    await page.waitForURL(/\/(dashboard|mfa|verificar)/i, { timeout: 10_000 });
    const url = page.url();
    expect(url).toMatch(/dashboard|mfa|verificar/i);
  });

  test('rota protegida redireciona para login sem token', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

});
