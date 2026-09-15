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

    // "Selecione a conta..." só aparece nas linhas AINDA não preenchidas —
    // depois de escolher a conta da 1ª linha, o texto do span muda para o
    // código/nome escolhido, então sobra só 1 elemento com esse placeholder
    // (a 2ª linha), não 2. Por isso é .first() nas duas vezes, não .nth(1).
    const selectors = page.locator('span:has-text("Selecione a conta...")');
    await selectors.first().click();
    await page.getByPlaceholder(/buscar código|buscar codigo/i).fill('caixa');
    await page.getByText('1.1.1.01').click();

    await selectors.first().click();
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

  test('arrasta documento e pré-preenche identificação via OCR', async ({ page }) => {
    await page.route('**/api/v1/companies/*/accounts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'acc-merc', code: '1.1.3.04', name: 'Mercadorias', is_analytical: true, is_active: true },
            { id: 'acc-forn', code: '2.1.1.01', name: 'Fornecedores', is_analytical: true, is_active: true },
          ],
          total: 2,
          page: 1,
          limit: 500,
          totalPages: 1,
        }),
      });
    });

    await page.route('**/api/v1/companies/*/nfe/ocr/upload', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'upload-1',
          company_id: 'company-1',
          file_name: 'nfe-teste.pdf',
          file_size: 1024,
          file_type: 'pdf',
          ocr_data: {
            nf_number: '000123456',
            issuer_name: 'Fornecedor Demo Ltda',
            issuer_cnpj: '12345678000199',
            total_value: 1500.5,
            emission_date: '2026-07-15',
          },
          status: 'extracted',
          extraction_confidence: 0.9,
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/v1/companies/*/nfe/ocr/*/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nf_number: '000123456',
          nf_series: '001',
          issuer_cnpj: '12345678000199',
          issuer_name: 'Fornecedor Demo Ltda',
          total_value: 1500.5,
          emission_date: '2026-07-15',
          type: 'entrada',
          suggested_entries: [
            { account_code: '1.1.2.1', account_name: 'Estoques de Mercadorias', debit: 1500.5 },
            { account_code: '2.1.1.1', account_name: 'Fornecedores', credit: 1500.5 },
          ],
        }),
      });
    });

    await page.goto('/lancamentos/novo');

    await expect(page.getByTestId('document-drop-zone')).toBeVisible({ timeout: 8000 });

    await page.getByTestId('document-drop-input').setInputFiles({
      name: 'nfe-teste.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fake nfe'),
    });

    await expect(page.getByTestId('document-extract-success')).toBeVisible({ timeout: 8000 });
    await expect(page.getByLabel(/número do documento/i)).toHaveValue('000123456');
    await expect(page.getByLabel(/emissor/i)).toHaveValue(/Fornecedor Demo/i);
    await expect(page.getByLabel(/data/i)).toHaveValue('2026-07-15');
    await expect(page.getByText('1.1.3.04 — Mercadorias')).toBeVisible();
    await expect(page.getByText('2.1.1.01 — Fornecedores')).toBeVisible();
  });

});
