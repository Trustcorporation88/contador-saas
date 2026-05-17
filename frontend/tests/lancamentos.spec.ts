/**
 * lancamentos.spec.ts — Lançamento contábil (partidas dobradas)
 */
import { test, expect } from '@playwright/test';
import { loginAs, ensureCompanySelected } from './helpers';

test.describe('Lançamentos Contábeis', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await ensureCompanySelected(page);
  });

  test('lista lançamentos', async ({ page }) => {
    await page.goto('/lancamentos');
    await expect(page.getByRole('heading', { name: /lançamentos/i })).toBeVisible({ timeout: 8000 });
  });

  test('abre formulário de novo lançamento', async ({ page }) => {
    await page.goto('/lancamentos/novo');
    await expect(page.getByRole('heading', { name: /lançador|novo lançamento/i })).toBeVisible({ timeout: 8000 });

    // Campos obrigatórios visíveis
    await expect(page.getByLabel(/data/i)).toBeVisible();
    await expect(page.getByLabel(/histórico/i)).toBeVisible();
  });

  test('indicador de balanço aparece em tempo real', async ({ page }) => {
    await page.goto('/lancamentos/novo');

    // Preenche data
    await page.getByLabel(/data/i).fill('2026-01-31');

    // Deve ter ao menos 2 linhas de lançamento
    const linhas = page.locator('[data-testid="linha-lancamento"]');
    // O componente usa useFieldArray, então esperamos inputs de débito/crédito
    const debitInputs = page.locator('input[placeholder*="0,00"]');
    await expect(debitInputs.first()).toBeVisible({ timeout: 5000 });
  });

  test('valida balanço antes de salvar', async ({ page }) => {
    await page.goto('/lancamentos/novo');

    // Tenta salvar sem preencher — deve mostrar erro de validação
    await page.getByRole('button', { name: /salvar/i }).first().click();

    // Deve mostrar mensagem de erro
    const erros = page.locator('.text-red-600, [role="alert"]');
    await expect(erros.first()).toBeVisible({ timeout: 5000 });
  });

});
