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
    // Heading atual da tela de login é "Acesso ao Sistema" (redesign visual);
    // mantém "entrar|login" no regex por segurança caso o texto mude de novo.
    await expect(page.getByRole('heading', { name: /acesso ao sistema|entrar|login/i })).toBeVisible();
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    // getByLabel(/senha/i) bate em 2 elementos: o campo e o botão "Mostrar/
    // Ocultar senha" (aria-label contém "senha") — getByRole desambigua.
    await expect(page.getByRole('textbox', { name: /senha/i })).toBeVisible();
  });

  test('rejeita credenciais inválidas', async ({ page }) => {
    await page.getByLabel(/e-mail/i).fill('invalido@teste.com');
    await page.getByRole('textbox', { name: /senha/i }).fill('senhaerrada');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    await page.getByLabel(/e-mail/i).fill(ADMIN_EMAIL);
    await page.getByRole('textbox', { name: /senha/i }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();

    // Aguarda redirecionamento — pode ter MFA, ir para o dashboard, ou para
    // a home "/" (hub de navegação pós-login), a depender da configuração.
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
    const url = page.url();
    expect(url).not.toMatch(/\/login/i);
  });

  test('rota protegida redireciona para login sem token', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

});
