/**
 * empresas.spec.ts — CRUD de Empresas
 */
import { test, expect } from '@playwright/test';
import { loginAs, ensureCompanySelected } from './helpers';

const CNPJ_TEST = '12.345.678/0001-99';
const NAME_TEST = `Empresa E2E ${Date.now()}`;

test.describe('CRUD Empresas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('lista empresas', async ({ page }) => {
    await page.goto('/empresas');
    await expect(page.getByRole('heading', { name: /empresas/i })).toBeVisible({ timeout: 8000 });
  });

  test('cria nova empresa', async ({ page }) => {
    await page.goto('/empresas');
    await page.getByRole('button', { name: /nova empresa/i }).click();

    // Preenche modal
    const cnpjInput = page.getByLabel(/cnpj/i);
    await cnpjInput.fill(CNPJ_TEST);
    await page.getByLabel(/razão social/i).fill(NAME_TEST);
    await page.getByLabel(/e-mail/i).fill('e2e@teste.com');
    await page.getByLabel(/regime/i).selectOption('simples_nacional');

    await page.getByRole('button', { name: /salvar|criar/i }).click();

    // Empresa deve aparecer na lista
    await expect(page.getByText(NAME_TEST)).toBeVisible({ timeout: 8000 });
  });

  test('edita empresa existente', async ({ page }) => {
    await page.goto('/empresas');
    // Clica no primeiro botão de editar
    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    await editBtn.click();

    // Modal de edição deve estar visível
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

});
