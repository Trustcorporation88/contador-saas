import { test, expect, type Page, type Route } from '@playwright/test';

const companyId = 'company-beta';

function authState(role: 'admin' | 'viewer' = 'admin') {
  return {
    state: {
      user: {
        id: 'user-beta',
        name: 'QA Beta',
        email: 'qa@contador.dev',
        role,
      },
      accessToken: null,
      refreshToken: 'refresh-beta',
      currentCompanyId: companyId,
      isAuthenticated: true,
    },
    version: 0,
  };
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname.endsWith('/documentos')) {
      return fulfillJson(route, {
        success: true,
        data: [
          {
            id: 'doc-1',
            company_id: companyId,
            created_by: 'user-beta',
            tipo: 'nfe',
            numero: '123',
            serie: '1',
            descricao: 'NF-e de venda',
            data_emissao: '2026-05-10',
            data_vencimento: '2026-05-20',
            valor_total: 1500,
            status: 'registrado',
            registrado_no_diario: true,
            is_active: true,
            itens: [],
            anexos: [],
            created_at: '2026-05-10T10:00:00.000Z',
            updated_at: '2026-05-10T10:00:00.000Z',
          },
        ],
        pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
      });
    }

    if (pathname.endsWith('/documentos/stats/estatisticas')) {
      return fulfillJson(route, {
        success: true,
        data: {
          total_documentos: 1,
          total_valor: 1500,
          por_tipo: { nfe: { quantidade: 1, valor_total: 1500 } },
          por_status: { registrado: { quantidade: 1, valor_total: 1500 } },
        },
      });
    }

    if (pathname.endsWith(`/companies/${companyId}/journal-entries`)) {
      return fulfillJson(route, {
        data: [
          {
            id: 'journal-1',
            company_id: companyId,
            created_by: 'user-beta',
            entry_date: '2026-05-12',
            description: 'Lançamento contábil de teste',
            reference_type: 'NF',
            reference_number: '123',
            total_debit: 1500,
            total_credit: 1500,
            is_posted: true,
            created_at: '2026-05-12T10:00:00.000Z',
            updated_at: '2026-05-12T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    }

    if (pathname.endsWith('/contas-receber')) {
      return fulfillJson(route, {
        success: true,
        data: [
          {
            id: 'cr-1',
            categoria: 'boleto',
            numero_titulo: 'REC-001',
            descricao: 'Mensalidade cliente premium',
            cliente_nome: 'Cliente Exemplo Ltda',
            cliente_cnpj: '12345678000190',
            data_emissao: '2026-05-01',
            data_vencimento: '2026-05-25',
            valor_original: 8500,
            valor_recebido: 5000,
            juros: 0,
            multa: 0,
            desconto: 0,
            status: 'parcial',
            saldo_aberto: 3500,
            dias_atraso: 0,
          },
        ],
      });
    }

    if (pathname.endsWith('/contas-receber/stats/estatisticas')) {
      return fulfillJson(route, {
        success: true,
        data: {
          total_titulos: 1,
          total_aberto: 3500,
          total_recebido: 5000,
          total_vencido: 0,
          proximos_7_dias: 3500,
          proximos_14_dias: 3500,
          proximos_30_dias: 3500,
          por_status: { parcial: { quantidade: 1, valor: 3500 } },
        },
      });
    }

    if (pathname.endsWith('/contas-pagar')) {
      return fulfillJson(route, {
        success: true,
        data: [
          {
            id: 'cp-1',
            categoria: 'fornecedor',
            numero_titulo: 'PAG-001',
            descricao: 'Fornecedor de insumos',
            fornecedor_nome: 'Insumos Brasil Ltda',
            fornecedor_cnpj: '12345678000190',
            data_emissao: '2026-05-01',
            data_vencimento: '2026-05-22',
            valor_original: 4250,
            valor_pago: 2000,
            juros: 0,
            multa: 0,
            desconto: 0,
            status: 'parcial',
            saldo_aberto: 2250,
            dias_atraso: 0,
          },
        ],
      });
    }

    if (pathname.endsWith('/contas-pagar/stats/estatisticas')) {
      return fulfillJson(route, {
        success: true,
        data: {
          total_titulos: 1,
          total_aberto: 2250,
          total_pago: 2000,
          total_vencido: 0,
          proximos_7_dias: 2250,
          proximos_14_dias: 2250,
          proximos_30_dias: 2250,
          por_status: { parcial: { quantidade: 1, valor: 2250 } },
        },
      });
    }

    if (pathname.endsWith(`/companies/${companyId}/reports/executive-summary`)) {
      return fulfillJson(route, {
        company_id: companyId,
        date_from: '2026-05-01',
        date_to: '2026-05-31',
        generated_at: '2026-05-18T12:00:00.000Z',
        total_revenue: 92000,
        total_expenses: 74500,
        net_income: 17500,
        open_receivables: 3500,
        open_payables: 2250,
        overdue_receivables: 0,
        overdue_payables: 0,
        current_assets: 120000,
        current_liabilities: 45000,
        equity_total: 80000,
      });
    }

    if (pathname.endsWith(`/companies/${companyId}/reports/cash-flow-summary`)) {
      return fulfillJson(route, {
        company_id: companyId,
        generated_at: '2026-05-18T12:00:00.000Z',
        months: 12,
        series: [
          { month: 'jun/25', revenue: 70000, expenses: 62000, net_income: 8000 },
          { month: 'set/25', revenue: 75000, expenses: 68000, net_income: 7000 },
          { month: 'dez/25', revenue: 81000, expenses: 69000, net_income: 12000 },
          { month: 'mar/26', revenue: 87000, expenses: 72000, net_income: 15000 },
          { month: 'mai/26', revenue: 92000, expenses: 74500, net_income: 17500 },
        ],
        totals: { revenue: 405000, expenses: 345500, net_income: 59500 },
      });
    }

    if (pathname.endsWith(`/companies/${companyId}/reports/client-summary/monthly`)) {
      return fulfillJson(route, {
        company_id: companyId,
        period_type: 'monthly',
        label: 'maio de 2026',
        date_from: '2026-05-01',
        date_to: '2026-05-31',
        generated_at: '2026-05-19T09:30:00.000Z',
        metrics: {
          revenue: 92000,
          expenses: 74500,
          net_income: 17500,
          open_receivables: 3500,
          open_payables: 2250,
          overdue_receivables: 0,
          overdue_payables: 0,
          current_assets: 120000,
          current_liabilities: 45000,
          cash_position: 75000,
          equity_total: 80000,
          taxes_due: 6800,
          pending_tax_items: 1,
        },
        comparison: {
          label: 'abril de 2026',
          revenue: 87000,
          expenses: 72000,
          net_income: 15000,
          cash_position: 69000,
        },
        alerts: [
          { level: 'warning', code: 'pending_taxes', message: 'Existem apurações tributárias pendentes no período.' },
        ],
      });
    }

    if (pathname.endsWith(`/companies/${companyId}/reports/client-summary/annual`)) {
      return fulfillJson(route, {
        company_id: companyId,
        period_type: 'annual',
        label: '2026',
        date_from: '2026-01-01',
        date_to: '2026-12-31',
        generated_at: '2026-05-19T09:30:00.000Z',
        metrics: {
          revenue: 405000,
          expenses: 345500,
          net_income: 59500,
          open_receivables: 3500,
          open_payables: 2250,
          overdue_receivables: 0,
          overdue_payables: 0,
          current_assets: 120000,
          current_liabilities: 45000,
          cash_position: 75000,
          equity_total: 80000,
          taxes_due: 21500,
          pending_tax_items: 2,
        },
        comparison: {
          label: '2025',
          revenue: 380000,
          expenses: 332000,
          net_income: 48000,
          cash_position: 61000,
        },
        alerts: [
          { level: 'info', code: 'period_ok', message: 'Resumo sem pendências críticas no período analisado.' },
        ],
      });
    }

    if (pathname.endsWith(`/companies/${companyId}/reports/income-statement`)) {
      return fulfillJson(route, {
        company_id: companyId,
        date_from: '2026-05-01',
        date_to: '2026-05-31',
        generated_at: '2026-05-18T12:00:00.000Z',
        revenues: [{ account_id: 'rev-1', code: '3.1.1', name: 'Receita de Serviços', type: 'REVENUE', debit_total: 0, credit_total: 92000, balance: 92000 }],
        expenses: [{ account_id: 'exp-1', code: '4.1.1', name: 'Despesas Operacionais', type: 'EXPENSE', debit_total: 74500, credit_total: 0, balance: 74500 }],
        gross_revenue: 92000,
        total_expenses: 74500,
        net_income: 17500,
      });
    }

    if (pathname.endsWith(`/companies/${companyId}/reports/balance-sheet`)) {
      return fulfillJson(route, {
        company_id: companyId,
        date_to: '2026-05-31',
        generated_at: '2026-05-18T12:00:00.000Z',
        assets: {
          current: [{ account_id: 'asset-1', code: '1.1.1', name: 'Caixa', type: 'ASSET', debit_total: 120000, credit_total: 0, balance: 120000 }],
          non_current: [],
          total: 120000,
        },
        liabilities: {
          current: [{ account_id: 'liab-1', code: '2.1.1', name: 'Fornecedores', type: 'LIABILITY', debit_total: 0, credit_total: 45000, balance: 45000 }],
          non_current: [],
          total: 45000,
        },
        equity: {
          items: [{ account_id: 'eq-1', code: '2.3.1', name: 'Patrimônio Líquido', type: 'EQUITY', debit_total: 0, credit_total: 75000, balance: 75000 }],
          total: 75000,
        },
        total_assets: 120000,
        total_liabilities_and_equity: 120000,
        is_balanced: true,
      });
    }

    if (pathname.endsWith('/reports/income-statement/export') || pathname.endsWith('/reports/balance-sheet/export')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: 'beta-export',
      });
    }

    if (pathname.includes('/cnpj/')) {
      return fulfillJson(route, {
        success: true,
        data: {
          razao_social: 'Empresa Mock Ltda',
          nome_fantasia: 'Empresa Mock',
          contato: { email: 'financeiro@mock.dev', telefone: '1133334444' },
        },
      });
    }

    return fulfillJson(route, { success: true, data: [] });
  });
}

test.describe('Release Beta com Documentação Completa', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((payload) => {
      window.localStorage.setItem('contador-auth', JSON.stringify(payload));
    }, authState('admin'));
    await mockApi(page);
  });

  test('cobre as 5 prioridades do MVP em navegação funcional', async ({ page }) => {
    await page.goto('/documentos');
    await expect(page.getByRole('heading', { name: 'Documentos Fiscais' })).toBeVisible();
    await expect(page.getByRole('button', { name: /novo documento/i })).toBeVisible();
    await page.getByRole('button', { name: /novo documento/i }).click();
    await expect(page.getByRole('heading', { name: /novo documento fiscal/i })).toBeVisible();

    await page.goto('/lancamentos');
    await expect(page.getByRole('heading', { name: 'Diário Contábil' })).toBeVisible();
    await expect(page.getByRole('link', { name: /novo lançamento/i })).toBeVisible();
    await expect(page.getByText(/leitura rápida/i)).toBeVisible();

    await page.goto('/contas-receber');
    await expect(page.getByRole('heading', { name: 'Contas a Receber' })).toBeVisible();
    await expect(page.getByRole('button', { name: /novo título/i })).toBeVisible();
    await expect(page.getByText(/cliente exemplo ltda/i)).toBeVisible();

    await page.goto('/contas-pagar');
    await expect(page.getByRole('heading', { name: 'Contas a Pagar' })).toBeVisible();
    await expect(page.getByRole('button', { name: /nova obrigação/i })).toBeVisible();
    await expect(page.getByText(/insumos brasil ltda/i)).toBeVisible();

    await page.getByRole('button', { name: /relatórios/i }).click();
    await page.getByRole('link', { name: /fluxo de caixa/i }).click();
    await expect(page.getByRole('heading', { name: /fluxo de caixa \+ relatórios básicos/i })).toBeVisible();
    await expect(page.getByText(/receita total/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /dre xlsx/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /balanço pdf/i })).toBeVisible();
  });

  test('exibe a aba Cliente com resumo mensal e anual', async ({ page }) => {
    await page.goto('/cliente');

    await expect(page.getByRole('main').getByRole('heading', { name: 'Cliente' })).toBeVisible();
    await expect(page.getByText(/resumo executivo mensal e anual/i)).toBeVisible();
    await expect(page.getByText(/faturamento do mês/i)).toBeVisible();
    await expect(page.getByText(/impostos apurados/i)).toBeVisible();
    await expect(page.getByText(/existem apurações tributárias pendentes/i)).toBeVisible();
    await expect(page.getByText(/comparativo com 2025/i)).toBeVisible();
  });

  test('redireciona viewer para a aba Cliente e oculta menus operacionais', async ({ page }) => {
    await page.addInitScript((payload) => {
      window.localStorage.setItem('contador-auth', JSON.stringify(payload));
    }, authState('viewer'));

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/cliente$/);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Cliente' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cliente' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Empresas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /relatórios/i })).toHaveCount(0);
  });
});