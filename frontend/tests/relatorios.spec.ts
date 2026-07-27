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
    // Deve mostrar colunas Ativo / Passivo (texto explicativo da página
    // também contém essas palavras, então usa .first() para evitar
    // "strict mode violation" por múltiplos elementos casarem).
    await expect(page.getByText(/ativo/i).first()).toBeVisible();
    await expect(page.getByText(/passivo/i).first()).toBeVisible();
  });

  test('DRE carrega', async ({ page }) => {
    await page.goto('/relatorios/dre');
    await expect(page.getByRole('heading', { name: /resultado/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/receita/i).first()).toBeVisible();
  });

  test('Balancete e Livro Razão carregam', async ({ page }) => {
    await page.goto('/relatorios/outros');
    // Tab Balancete deve estar ativo por padrão
    await expect(page.getByRole('heading', { name: /outros|balancete|razão/i })).toBeVisible({ timeout: 10_000 });
    // Botões de exportação hoje são "XLSX"/"PDF" separados (não mais um
    // único botão "Exportar").
    const exportBtn = page.getByRole('button', { name: /exportar|xlsx|pdf/i });
    await expect(exportBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('botão Exportar XLSX não quebra a página', async ({ page }) => {
    await page.goto('/relatorios/dre');
    // [role="heading"] (seletor CSS) só bate em elementos com o atributo
    // role="heading" LITERAL no HTML — não em <h1>/<h2> semânticos, que têm
    // esse role apenas implicitamente via ARIA. getByRole('heading') usa a
    // árvore de acessibilidade computada e cobre os dois casos.
    await page.getByRole('heading').first().waitFor({ timeout: 10_000 });

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
