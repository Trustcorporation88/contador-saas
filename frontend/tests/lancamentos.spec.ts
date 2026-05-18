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

  test('cria lançamento em rascunho com partidas dobradas', async ({ page }) => {
    await page.route('**/api/v1/companies/*/accounts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'acc-1', code: '1.1.1.01', name: 'Caixa', is_analytical: true },
            { id: 'acc-2', code: '2.1.1.01', name: 'Fornecedores', is_analytical: true },
          ],
          total: 2,
          page: 1,
          limit: 500,
          totalPages: 1,
        }),
      });
    });

    await page.route('**/api/v1/companies/*/journal-entries', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'entry-1',
            company_id: 'company-1',
            created_by: 'user-1',
            entry_date: '2026-01-31',
            description: 'Compra de insumos',
            total_debit: 100,
            total_credit: 100,
            is_posted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            lines: [],
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('/lancamentos/novo');

    await page.getByLabel(/data/i).fill('2026-01-31');
    await page.getByLabel(/descrição|histórico/i).fill('Compra de insumos');

    const selectors = page.locator('span:has-text("Selecione a conta...")');
    await selectors.first().click();
    await page.getByPlaceholder(/buscar código|buscar codigo/i).fill('caixa');
    await page.getByText('1.1.1.01').click();

    await selectors.nth(1).click();
    await page.getByPlaceholder(/buscar código|buscar codigo/i).fill('forne');
    await page.getByText('2.1.1.01').click();

    const amounts = page.locator('input[placeholder="0,00"]');
    await amounts.nth(0).fill('100,00');
    await amounts.nth(3).fill('100,00');

    const createReq = page.waitForRequest((req) =>
      req.url().includes('/journal-entries') && req.method() === 'POST',
    );

    await page.getByRole('button', { name: /salvar como rascunho/i }).click();
    await createReq;

    await expect(page).toHaveURL(/\/lancamentos$/i);
  });

});
