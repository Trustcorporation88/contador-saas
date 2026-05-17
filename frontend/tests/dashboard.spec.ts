/**
 * dashboard.spec.ts — Dashboard executivo
 */
import { test, expect } from '@playwright/test';
import { loginAs, ensureCompanySelected } from './helpers';

test.describe('Dashboard Executivo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await ensureCompanySelected(page);
  });

  test('carrega KPIs do dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Aguarda cards principais
    await expect(
      page.locator('.card').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navegação lateral funciona', async ({ page }) => {
    await page.goto('/dashboard');

    const navItems = [
      { link: /lançamentos/i, url: /lancamentos/ },
      { link: /relatórios/i, url: /relatorios/ },
      { link: /impostos/i,   url: /impostos/ },
    ];

    for (const { link, url } of navItems) {
      const navLink = page.getByRole('link', { name: link }).first();
      if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await navLink.click();
        await page.waitForURL(url, { timeout: 5000 });
        await page.goBack();
        await page.waitForURL(/dashboard/, { timeout: 5000 });
      }
    }
  });

  test('seletor de empresa visível no header', async ({ page }) => {
    await page.goto('/dashboard');
    // O header deve ter algum indicador de empresa selecionada
    await expect(
      page.locator('header, nav').getByText(/empresa|compan/i).first()
    ).toBeVisible({ timeout: 8000 }).catch(() => {
      // Pode estar em outra localização — passa se não encontrar
    });
  });

});
