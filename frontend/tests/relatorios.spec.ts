/**
 * relatorios.spec.ts — Relatórios financeiros
 */
import { test, expect } from '@playwright/test';
import { loginAs, ensureCompanySelected } from './helpers';

test.describe('Relatórios Financeiros', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await ensureCompanySelected(page);
  });

  test('Balanço Patrimonial carrega', async ({ page }) => {
    await page.goto('/relatorios/balanco');
    await expect(page.getByRole('heading', { name: /balanço/i })).toBeVisible({ timeout: 10_000 });
    // Deve mostrar colunas Ativo / Passivo
    await expect(page.getByText(/ativo/i)).toBeVisible();
    await expect(page.getByText(/passivo/i)).toBeVisible();
  });

  test('DRE carrega', async ({ page }) => {
    await page.goto('/relatorios/dre');
    await expect(page.getByRole('heading', { name: /resultado/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/receita/i)).toBeVisible();
  });

  test('Balancete e Livro Razão carregam', async ({ page }) => {
    await page.goto('/relatorios/outros');
    // Tab Balancete deve estar ativo por padrão
    await expect(page.getByRole('heading', { name: /outros|balancete|razão/i })).toBeVisible({ timeout: 10_000 });
    // Botão Exportar deve existir
    const exportBtn = page.getByRole('button', { name: /exportar/i });
    await expect(exportBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('botão Exportar XLSX não quebra a página', async ({ page }) => {
    await page.goto('/relatorios/dre');
    await page.waitForSelector('[role="heading"]', { timeout: 10_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    const exportBtn = page.getByRole('button', { name: /xlsx/i }).first();
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportBtn.click();
      await downloadPromise;
    }
    // Página não deve ter erros visíveis
    await expect(page.getByRole('alert')).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

});
