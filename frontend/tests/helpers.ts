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
  // getByLabel(/senha/i) hoje bate em 2 elementos: o campo e o botão
  // "Mostrar/Ocultar senha" (aria-label contém "senha") — getByRole com
  // 'textbox' desambigua para o input de verdade.
  await page.getByRole('textbox', { name: /senha/i }).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();

  // Se o login falhar (credenciais / rate limit), a URL não muda — captura
  // a mensagem do alert para o log do CI em vez de um TimeoutError opaco.
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
  } catch (err) {
    const alertText = await page.getByRole('alert').textContent().catch(() => null);
    throw new Error(
      `Login não saiu de /login${alertText ? `: ${alertText.trim()}` : ''}`,
      { cause: err },
    );
  }
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
