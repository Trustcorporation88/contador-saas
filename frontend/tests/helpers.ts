/**
 * helpers.ts — Helpers compartilhados para E2E
 */
import { Page } from '@playwright/test';

const ADMIN_EMAIL    = process.env.TEST_EMAIL    ?? 'admin@contador.dev';
const ADMIN_PASSWORD = process.env.TEST_PASSWORD ?? 'Admin@123';

/**
 * Faz login e retorna para a página raiz da app autenticada.
 * Chama antes dos testes que precisam de sessão ativa.
 */
export async function loginAs(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel(/e-mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
  // Aguarda sair da página de login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

/**
 * Garante que há uma empresa selecionada no contexto da sessão.
 * Se nenhuma empresa estiver ativa, navega para /empresas e seleciona a primeira.
 */
export async function ensureCompanySelected(page: Page) {
  const url = page.url();
  // Se já está no dashboard com empresa, ok
  if (url.includes('/dashboard')) return;

  await page.goto('/empresas');
  // Clica no primeiro botão "Selecionar" se existir
  const selectBtn = page.getByRole('button', { name: /selecionar/i }).first();
  if (await selectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await selectBtn.click();
  }
  await page.goto('/dashboard');
}
