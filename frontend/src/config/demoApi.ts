import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { DEMO_COMPANY_ID, PUBLIC_ACCESS_USER } from './publicAccess';

const nowIso = '2026-05-19T12:00:00.000Z';
const demoCompany = {
  id: DEMO_COMPANY_ID,
  cnpj: '12345678000195',
  name: 'Pro Contador Demo Ltda',
  email: 'financeiro@procontador.demo.br',
  phone: '(11) 4000-2026',
  tax_regime: 'lucro_presumido',
  fiscal_year_start: 1,
  is_active: true,
  created_at: '2026-01-02T09:00:00.000Z',
  updated_at: nowIso,
};

const accountList = [
  {
    id: 'acc-caixa',
    code: '1.1.1',
    name: 'Caixa e Bancos',
    type: 'ASSET',
    is_analytical: true,
    balance: 185000,
    debit_total: 285000,
    credit_total: 100000,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'acc-clientes',
    code: '1.1.2',
    name: 'Clientes',
    type: 'ASSET',
    is_analytical: true,
    balance: 42000,
    debit_total: 92000,
    credit_total: 50000,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'acc-forn',
    code: '2.1.1',
    name: 'Fornecedores',
    type: 'LIABILITY',
    is_analytical: true,
    balance: 36000,
    debit_total: 10000,
    credit_total: 46000,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'acc-imp',
    code: '2.1.4',
    name: 'Impostos a Recolher',
    type: 'LIABILITY',
    is_analytical: true,
    balance: 18400,
    debit_total: 0,
    credit_total: 18400,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'acc-pl',
    code: '2.3.1',
    name: 'Patrimonio Liquido',
    type: 'EQUITY',
    is_analytical: true,
    balance: 172600,
    debit_total: 0,
    credit_total: 172600,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'acc-receita',
    code: '3.1.1',
    name: 'Receita de Servicos',
    type: 'REVENUE',
    is_analytical: true,
    balance: 148000,
    debit_total: 0,
    credit_total: 148000,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'acc-despesa',
    code: '4.1.1',
    name: 'Despesas Operacionais',
    type: 'EXPENSE',
    is_analytical: true,
    balance: 109400,
    debit_total: 109400,
    credit_total: 0,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

const accountHierarchy = [
  {
    code: '1',
    name: 'Ativo',
    type: 'ASSET',
    is_analytical: false,
    balance: 227000,
    children: [
      { code: '1.1.1', name: 'Caixa e Bancos', type: 'ASSET', is_analytical: true, balance: 185000 },
      { code: '1.1.2', name: 'Clientes', type: 'ASSET', is_analytical: true, balance: 42000 },
    ],
  },
  {
    code: '2',
    name: 'Passivo e PL',
    type: 'LIABILITY',
    is_analytical: false,
    balance: 227000,
    children: [
      { code: '2.1.1', name: 'Fornecedores', type: 'LIABILITY', is_analytical: true, balance: 36000 },
      { code: '2.1.4', name: 'Impostos a Recolher', type: 'LIABILITY', is_analytical: true, balance: 18400 },
      { code: '2.3.1', name: 'Patrimonio Liquido', type: 'EQUITY', is_analytical: true, balance: 172600 },
    ],
  },
];

const journalEntries = [
  {
    id: 'journal-1',
    company_id: DEMO_COMPANY_ID,
    created_by: PUBLIC_ACCESS_USER.id,
    entry_date: '2026-05-05',
    description: 'Reconhecimento de receita de servicos recorrentes',
    reference_type: 'NF',
    reference_number: 'NF-1052',
    total_debit: 18500,
    total_credit: 18500,
    is_posted: true,
    created_at: nowIso,
    updated_at: nowIso,
    lines: [
      { id: 'line-1', journal_entry_id: 'journal-1', account_id: 'acc-clientes', account_code: '1.1.2', account_name: 'Clientes', debit: 18500, credit: 0, line_number: 1 },
      { id: 'line-2', journal_entry_id: 'journal-1', account_id: 'acc-receita', account_code: '3.1.1', account_name: 'Receita de Servicos', debit: 0, credit: 18500, line_number: 2 },
    ],
  },
  {
    id: 'journal-2',
    company_id: DEMO_COMPANY_ID,
    created_by: PUBLIC_ACCESS_USER.id,
    entry_date: '2026-05-10',
    description: 'Pagamento de fornecedores estrategicos',
    reference_type: 'BOLETO',
    reference_number: 'PAG-2026-44',
    total_debit: 9600,
    total_credit: 9600,
    is_posted: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'journal-3',
    company_id: DEMO_COMPANY_ID,
    created_by: PUBLIC_ACCESS_USER.id,
    entry_date: '2026-05-17',
    description: 'Provisao de impostos do periodo',
    reference_type: 'MANUAL',
    reference_number: 'TAX-2026-05',
    total_debit: 6800,
    total_credit: 6800,
    is_posted: false,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

const dashboardBalanceSheet = {
  date: '2026-05-31',
  ativo: {
    circulante: [
      { accountId: 'acc-caixa', accountCode: '1.1.1', accountName: 'Caixa e Bancos', balance: 185000 },
      { accountId: 'acc-clientes', accountCode: '1.1.2', accountName: 'Clientes', balance: 42000 },
    ],
    naoCirculante: [],
    total: 227000,
  },
  passivo: {
    circulante: [
      { accountId: 'acc-forn', accountCode: '2.1.1', accountName: 'Fornecedores', balance: 36000 },
      { accountId: 'acc-imp', accountCode: '2.1.4', accountName: 'Impostos a Recolher', balance: 18400 },
    ],
    naoCirculante: [],
    total: 54400,
  },
  patrimonioLiquido: {
    items: [{ accountId: 'acc-pl', accountCode: '2.3.1', accountName: 'Patrimonio Liquido', balance: 172600 }],
    total: 172600,
  },
};

const dashboardDre = {
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  receitaBruta: [{ accountId: 'acc-receita', accountCode: '3.1.1', accountName: 'Receita de Servicos', value: 148000 }],
  deducoes: [{ accountId: 'tax-ded', accountCode: '3.9.1', accountName: 'Deducoes Comerciais', value: 10000 }],
  receitaLiquida: 138000,
  custoVendas: 24000,
  lucroBruto: 114000,
  despesasOperacionais: [{ accountId: 'acc-despesa', accountCode: '4.1.1', accountName: 'Despesas Operacionais', value: 85400 }],
  resultadoOperacional: 28600,
  receitasFinanceiras: 1200,
  despesasFinanceiras: 1800,
  resultadoAntesIR: 28000,
  impostos: 6800,
  lucroLiquido: 21200,
};

const reportBalanceSheet = {
  company_id: DEMO_COMPANY_ID,
  date_to: '2026-05-31',
  generated_at: nowIso,
  assets: {
    current: [
      { account_id: 'acc-caixa', code: '1.1.1', name: 'Caixa e Bancos', type: 'ASSET', debit_total: 285000, credit_total: 100000, balance: 185000 },
      { account_id: 'acc-clientes', code: '1.1.2', name: 'Clientes', type: 'ASSET', debit_total: 92000, credit_total: 50000, balance: 42000 },
    ],
    non_current: [],
    total: 227000,
  },
  liabilities: {
    current: [
      { account_id: 'acc-forn', code: '2.1.1', name: 'Fornecedores', type: 'LIABILITY', debit_total: 10000, credit_total: 46000, balance: 36000 },
      { account_id: 'acc-imp', code: '2.1.4', name: 'Impostos a Recolher', type: 'LIABILITY', debit_total: 0, credit_total: 18400, balance: 18400 },
    ],
    non_current: [],
    total: 54400,
  },
  equity: {
    items: [{ account_id: 'acc-pl', code: '2.3.1', name: 'Patrimonio Liquido', type: 'EQUITY', debit_total: 0, credit_total: 172600, balance: 172600 }],
    total: 172600,
  },
  total_assets: 227000,
  total_liabilities_and_equity: 227000,
  is_balanced: true,
};

const incomeStatement = {
  company_id: DEMO_COMPANY_ID,
  date_from: '2026-05-01',
  date_to: '2026-05-31',
  generated_at: nowIso,
  revenues: [{ account_id: 'acc-receita', code: '3.1.1', name: 'Receita de Servicos', type: 'REVENUE', debit_total: 0, credit_total: 148000, balance: 148000 }],
  expenses: [{ account_id: 'acc-despesa', code: '4.1.1', name: 'Despesas Operacionais', type: 'EXPENSE', debit_total: 109400, credit_total: 0, balance: 109400 }],
  gross_revenue: 148000,
  total_expenses: 109400,
  net_income: 38600,
};

const executiveSummary = {
  company_id: DEMO_COMPANY_ID,
  date_from: '2026-05-01',
  date_to: '2026-05-31',
  generated_at: nowIso,
  total_revenue: 148000,
  total_expenses: 109400,
  net_income: 38600,
  open_receivables: 42000,
  open_payables: 18400,
  overdue_receivables: 6500,
  overdue_payables: 3200,
  current_assets: 227000,
  current_liabilities: 54400,
  equity_total: 172600,
};

const cashFlowSummary = {
  company_id: DEMO_COMPANY_ID,
  generated_at: nowIso,
  months: 6,
  series: [
    { month: 'dez/25', revenue: 112000, expenses: 89000, net_income: 23000 },
    { month: 'jan/26', revenue: 119000, expenses: 91000, net_income: 28000 },
    { month: 'fev/26', revenue: 121000, expenses: 94000, net_income: 27000 },
    { month: 'mar/26', revenue: 133000, expenses: 101000, net_income: 32000 },
    { month: 'abr/26', revenue: 142000, expenses: 108000, net_income: 34000 },
    { month: 'mai/26', revenue: 148000, expenses: 109400, net_income: 38600 },
  ],
  totals: { revenue: 775000, expenses: 592400, net_income: 182600 },
};

const clientMonthlySummary = {
  company_id: DEMO_COMPANY_ID,
  period_type: 'monthly',
  label: 'maio de 2026',
  date_from: '2026-05-01',
  date_to: '2026-05-31',
  generated_at: nowIso,
  metrics: {
    revenue: 148000,
    expenses: 109400,
    net_income: 38600,
    open_receivables: 42000,
    open_payables: 18400,
    overdue_receivables: 6500,
    overdue_payables: 3200,
    current_assets: 227000,
    current_liabilities: 54400,
    cash_position: 185000,
    equity_total: 172600,
    taxes_due: 6800,
    pending_tax_items: 1,
  },
  comparison: {
    label: 'abril de 2026',
    revenue: 142000,
    expenses: 108000,
    net_income: 34000,
    cash_position: 172000,
  },
  alerts: [
    { level: 'info', code: 'demo_mode', message: 'Voce esta navegando em um ambiente demo com dados ficticios estaveis.' },
    { level: 'warning', code: 'receivables', message: 'Ha titulos a receber vencidos no valor de R$ 6,5 mil.' },
  ],
};

const clientAnnualSummary = {
  ...clientMonthlySummary,
  period_type: 'annual',
  label: '2026',
  date_from: '2026-01-01',
  date_to: '2026-12-31',
  metrics: {
    ...clientMonthlySummary.metrics,
    revenue: 775000,
    expenses: 592400,
    net_income: 182600,
    taxes_due: 41200,
    pending_tax_items: 2,
  },
  comparison: {
    label: '2025',
    revenue: 641000,
    expenses: 531400,
    net_income: 109600,
    cash_position: 132000,
  },
  alerts: [{ level: 'info', code: 'growth', message: 'A companhia apresenta crescimento anual consistente no ambiente demo.' }],
};

const trialBalance = {
  company_id: DEMO_COMPANY_ID,
  date_from: '2026-05-01',
  date_to: '2026-05-31',
  generated_at: nowIso,
  items: accountList.map((account) => ({
    account_id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    debit_total: account.debit_total ?? 0,
    credit_total: account.credit_total ?? 0,
    balance: account.balance,
  })),
  totals: { debit: 496400, credit: 496400 },
  is_balanced: true,
};

const auditStats = {
  total_logs: 248,
  today_logs: 18,
  failed_actions: 2,
  top_actions: [
    { action: 'UPDATE', count: 92 },
    { action: 'CREATE', count: 61 },
    { action: 'LOGIN', count: 38 },
  ],
};

const auditLogs = {
  data: [
    {
      id: 'audit-1',
      user_id: PUBLIC_ACCESS_USER.id,
      action: 'UPDATE',
      entity_type: 'company',
      entity_id: DEMO_COMPANY_ID,
      old_value: { tax_regime: 'lucro_real' },
      new_value: { tax_regime: 'lucro_presumido' },
      ip_address: '203.0.113.10',
      status: 'SUCCESS',
      timestamp: '2026-05-18T14:00:00.000Z',
    },
    {
      id: 'audit-2',
      user_id: PUBLIC_ACCESS_USER.id,
      action: 'LOGIN',
      entity_type: 'auth',
      entity_id: PUBLIC_ACCESS_USER.id,
      ip_address: '203.0.113.10',
      status: 'SUCCESS',
      timestamp: '2026-05-19T08:15:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 50,
  totalPages: 1,
};

const accessAudit = {
  data: [
    {
      id: 'access-1',
      user_id: PUBLIC_ACCESS_USER.id,
      company_id: DEMO_COMPANY_ID,
      action: 'VIEW',
      description: 'Acesso ao dashboard executivo',
      success: true,
      ip_address: '203.0.113.10',
      created_at: '2026-05-19T08:16:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  totalPages: 1,
};

const contasReceber = [
  {
    id: 'cr-1',
    categoria: 'boleto',
    numero_titulo: 'REC-2026-001',
    descricao: 'Mensalidade enterprise',
    cliente_nome: 'Grupo Horizonte SA',
    cliente_cnpj: '11111111000191',
    cliente_email: 'financeiro@horizonte.demo.br',
    data_emissao: '2026-05-01',
    data_vencimento: '2026-05-25',
    valor_original: 26500,
    valor_recebido: 18000,
    juros: 0,
    multa: 0,
    desconto: 0,
    status: 'parcial',
    saldo_aberto: 8500,
    dias_atraso: 0,
  },
  {
    id: 'cr-2',
    categoria: 'pix',
    numero_titulo: 'REC-2026-002',
    descricao: 'Projeto de implantacao',
    cliente_nome: 'Industria Aurora Ltda',
    data_emissao: '2026-04-20',
    data_vencimento: '2026-05-10',
    valor_original: 12000,
    valor_recebido: 5500,
    juros: 0,
    multa: 0,
    desconto: 0,
    status: 'vencido',
    saldo_aberto: 6500,
    dias_atraso: 9,
  },
];

const contasPagar = [
  {
    id: 'cp-1',
    categoria: 'fornecedor',
    numero_titulo: 'PAG-2026-001',
    descricao: 'Licencas e infraestrutura',
    fornecedor_nome: 'Cloud Brasil Tech',
    fornecedor_cnpj: '22222222000188',
    data_emissao: '2026-05-02',
    data_vencimento: '2026-05-28',
    valor_original: 9800,
    valor_pago: 0,
    juros: 0,
    multa: 0,
    desconto: 0,
    status: 'pendente',
    saldo_aberto: 9800,
    dias_atraso: 0,
  },
  {
    id: 'cp-2',
    categoria: 'imposto',
    numero_titulo: 'TAX-2026-005',
    descricao: 'Tributos federais do periodo',
    fornecedor_nome: 'Receita Federal',
    data_emissao: '2026-05-18',
    data_vencimento: '2026-05-20',
    valor_original: 8600,
    valor_pago: 5400,
    juros: 0,
    multa: 0,
    desconto: 0,
    status: 'parcial',
    saldo_aberto: 3200,
    dias_atraso: 0,
  },
];

const documentoList = [
  {
    id: 'doc-1',
    company_id: DEMO_COMPANY_ID,
    created_by: PUBLIC_ACCESS_USER.id,
    tipo: 'nfe',
    numero: '1052',
    serie: '1',
    descricao: 'NF-e de servicos gerenciados',
    data_emissao: '2026-05-05',
    data_vencimento: '2026-05-25',
    valor_total: 18500,
    valor_impostos: 2150,
    contraparte_tipo: 'cliente',
    contraparte_nome: 'Grupo Horizonte SA',
    status: 'registrado',
    registrado_no_diario: true,
    is_active: true,
    itens: [],
    anexos: [],
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'doc-2',
    company_id: DEMO_COMPANY_ID,
    created_by: PUBLIC_ACCESS_USER.id,
    tipo: 'boleto',
    numero: '2026-44',
    serie: '1',
    descricao: 'Boleto fornecedor de infraestrutura',
    data_emissao: '2026-05-10',
    data_vencimento: '2026-05-28',
    valor_total: 9800,
    valor_impostos: 0,
    contraparte_tipo: 'fornecedor',
    contraparte_nome: 'Cloud Brasil Tech',
    status: 'rascunho',
    registrado_no_diario: false,
    is_active: true,
    itens: [],
    anexos: [],
    created_at: nowIso,
    updated_at: nowIso,
  },
];

const savedAppraisals = [
  {
    id: 'tax-appraisal-1',
    company_id: DEMO_COMPANY_ID,
    tax_type: 'IRPJ',
    period_start: '2026-05-01',
    period_end: '2026-05-31',
    calculated_amount: 4200,
    status: 'APPROVED',
    notes: 'Apuracao demo aprovada pelo controller financeiro',
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 'tax-appraisal-2',
    company_id: DEMO_COMPANY_ID,
    tax_type: 'CSLL',
    period_start: '2026-05-01',
    period_end: '2026-05-31',
    calculated_amount: 2600,
    status: 'PENDING',
    notes: 'Aguardando recolhimento no ambiente demo',
    created_at: nowIso,
    updated_at: nowIso,
  },
];

function ok(config: InternalAxiosRequestConfig, data: unknown, status = 200): Promise<AxiosResponse> {
  return Promise.resolve({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  });
}

function notFound(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  return Promise.resolve({
    data: { message: 'Demo route not mocked' },
    status: 404,
    statusText: 'Not Found',
    headers: {},
    config,
  });
}

function getPath(config: InternalAxiosRequestConfig): string {
  const requestUrl = new URL(config.url ?? '/', 'http://demo.local');
  return requestUrl.pathname.replace(/^\/api\/v1/, '');
}

function getMethod(config: InternalAxiosRequestConfig): string {
  return String(config.method ?? 'get').toLowerCase();
}

function getAccountById(accountId: string) {
  return accountList.find((account) => account.id === accountId) ?? accountList[0];
}

function getLedger(accountId: string) {
  const account = getAccountById(accountId);
  return {
    account_id: account.id,
    account_code: account.code,
    account_name: account.name,
    opening_balance: 120000,
    entries: [
      {
        date: '2026-05-05',
        journal_entry_id: 'journal-1',
        description: 'Movimento demo de abertura',
        reference_number: 'REF-001',
        debit: 18500,
        credit: 0,
        running_balance: 138500,
      },
      {
        date: '2026-05-19',
        journal_entry_id: 'journal-3',
        description: 'Ajuste demo do periodo',
        reference_number: 'REF-002',
        debit: 0,
        credit: 3200,
        running_balance: 135300,
      },
    ],
    closing_balance: 135300,
    total_debit: 18500,
    total_credit: 3200,
  };
}

function getTaxCalculation() {
  return {
    company_id: DEMO_COMPANY_ID,
    tax_regime: 'LUCRO_PRESUMIDO',
    period_start: '2026-05-01',
    period_end: '2026-05-31',
    generated_at: nowIso,
    revenues: 148000,
    expenses: 109400,
    net_income: 38600,
    taxes: [
      { tax_type: 'IRPJ', base: 28000, rate: 15, amount: 4200 },
      { tax_type: 'CSLL', base: 28888, rate: 9, amount: 2600 },
    ],
    total_tax: 6800,
    effective_rate: 4.59,
  };
}

export function createDemoAdapter(): AxiosAdapter {
  return async (config) => {
    const method = getMethod(config);
    const path = getPath(config);

    if (method === 'get' && path === '/companies') {
      return ok(config, {
        success: true,
        data: [demoCompany],
        pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
      });
    }

    if (method === 'get' && /^\/companies\/[^/]+$/.test(path)) {
      return ok(config, { success: true, data: demoCompany });
    }

    if (method === 'get' && /^\/cnpj\//.test(path)) {
      return ok(config, {
        cnpj: demoCompany.cnpj,
        razao_social: demoCompany.name,
        nome_fantasia: 'Pro Contador Demo',
        situacao: 'ATIVA',
        ativa: true,
        endereco: {
          logradouro: 'Avenida Exemplo', numero: '2026', complemento: '12 andar', bairro: 'Centro', municipio: 'Sao Paulo', uf: 'SP', cep: '01001000',
        },
        contato: { telefone: demoCompany.phone, email: demoCompany.email },
        porte: 'Demais',
        natureza_juridica: 'Sociedade Empresaria Limitada',
        cnae_principal: { codigo: 6201500, descricao: 'Desenvolvimento de programas de computador sob encomenda' },
        cnaes_secundarios: [],
        socios: [{ nome: 'Demo Publico', qualificacao: 'Administrador' }],
        capital_social: 250000,
        simples_nacional: false,
        mei: false,
        fonte: 'demo',
        cached: true,
      });
    }

    if (method === 'get' && /^\/companies\/[^/]+\/accounts\/hierarchy$/.test(path)) {
      return ok(config, { data: accountHierarchy });
    }

    if (method === 'get' && /^\/companies\/[^/]+\/accounts$/.test(path)) {
      return ok(config, {
        data: accountList,
        total: accountList.length,
        page: 1,
        limit: 20,
        total_pages: 1,
      });
    }

    if (method === 'get' && /^\/companies\/[^/]+\/accounts\/[^/]+$/.test(path)) {
      const accountId = path.split('/').pop() ?? '';
      return ok(config, getAccountById(accountId));
    }

    if (method === 'get' && /^\/companies\/[^/]+\/journal-entries$/.test(path)) {
      return ok(config, {
        data: journalEntries,
        total: journalEntries.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    }

    if (method === 'get' && /^\/companies\/[^/]+\/journal-entries\/[^/]+$/.test(path)) {
      const entryId = path.split('/').pop();
      return ok(config, journalEntries.find((entry) => entry.id === entryId) ?? journalEntries[0]);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/balance-sheet$/.test(path)) {
      return ok(config, reportBalanceSheet);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/income-statement$/.test(path)) {
      return ok(config, incomeStatement);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/executive-summary$/.test(path)) {
      return ok(config, executiveSummary);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/cash-flow-summary$/.test(path)) {
      return ok(config, cashFlowSummary);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/client-summary\/monthly$/.test(path)) {
      return ok(config, clientMonthlySummary);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/client-summary\/annual$/.test(path)) {
      return ok(config, clientAnnualSummary);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/trial-balance$/.test(path)) {
      return ok(config, trialBalance);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/ledger\//.test(path)) {
      return ok(config, getLedger(path.split('/').pop() ?? 'acc-caixa'));
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/.+\/export$/.test(path)) {
      return ok(config, new Blob(['Relatorio demo publico'], { type: 'text/plain' }));
    }

    if (method === 'get' && path === '/documentos') {
      return ok(config, {
        success: true,
        data: documentoList,
        pagination: { total: documentoList.length, page: 1, limit: 50, totalPages: 1 },
      });
    }

    if (method === 'get' && path === '/documentos/stats/estatisticas') {
      return ok(config, {
        success: true,
        data: {
          total_documentos: documentoList.length,
          total_valor: 28300,
          por_tipo: { nfe: { quantidade: 1, valor_total: 18500 }, boleto: { quantidade: 1, valor_total: 9800 } },
          por_status: { registrado: { quantidade: 1, valor_total: 18500 }, rascunho: { quantidade: 1, valor_total: 9800 } },
        },
      });
    }

    if (method === 'get' && /^\/documentos\/[^/]+$/.test(path)) {
      return ok(config, { success: true, data: documentoList.find((item) => item.id === path.split('/').pop()) ?? documentoList[0] });
    }

    if (method === 'get' && path === '/contas-receber') {
      return ok(config, { success: true, data: contasReceber, pagination: { total: contasReceber.length, page: 1, limit: 50, totalPages: 1 } });
    }

    if (method === 'get' && path === '/contas-receber/stats/estatisticas') {
      return ok(config, {
        success: true,
        data: {
          total_titulos: contasReceber.length,
          total_aberto: 15000,
          total_recebido: 23500,
          total_vencido: 6500,
          proximos_7_dias: 8500,
          proximos_14_dias: 15000,
          proximos_30_dias: 15000,
          por_status: {
            parcial: { quantidade: 1, valor: 8500 },
            vencido: { quantidade: 1, valor: 6500 },
          },
        },
      });
    }

    if (method === 'get' && /^\/contas-receber\/[^/]+$/.test(path)) {
      return ok(config, { success: true, data: contasReceber.find((item) => item.id === path.split('/').pop()) ?? contasReceber[0] });
    }

    if (method === 'get' && path === '/contas-pagar') {
      return ok(config, { success: true, data: contasPagar, pagination: { total: contasPagar.length, page: 1, limit: 50, totalPages: 1 } });
    }

    if (method === 'get' && path === '/contas-pagar/stats/estatisticas') {
      return ok(config, {
        success: true,
        data: {
          total_titulos: contasPagar.length,
          total_aberto: 13000,
          total_pago: 5400,
          total_vencido: 0,
          proximos_7_dias: 13000,
          proximos_14_dias: 13000,
          proximos_30_dias: 13000,
          por_status: {
            pendente: { quantidade: 1, valor: 9800 },
            parcial: { quantidade: 1, valor: 3200 },
          },
        },
      });
    }

    if (method === 'get' && /^\/contas-pagar\/[^/]+$/.test(path)) {
      return ok(config, { success: true, data: contasPagar.find((item) => item.id === path.split('/').pop()) ?? contasPagar[0] });
    }

    if (method === 'get' && path === '/audit/stats') {
      return ok(config, auditStats);
    }

    if (method === 'get' && path === '/audit/logs') {
      return ok(config, auditLogs);
    }

    if (method === 'get' && path === '/audit/access') {
      return ok(config, accessAudit);
    }

    if (method === 'post' && /^\/companies\/[^/]+\/taxes\/calculate$/.test(path)) {
      return ok(config, getTaxCalculation());
    }

    if ((method === 'post' || method === 'get') && /^\/companies\/[^/]+\/taxes\/appraisal$/.test(path)) {
      return ok(config, method === 'post' ? savedAppraisals : savedAppraisals);
    }

    if (method === 'patch' && /^\/companies\/[^/]+\/taxes\/appraisal\/[^/]+\/status$/.test(path)) {
      return ok(config, { ...savedAppraisals[0], status: 'APPROVED' });
    }

    if (method === 'get' && /^\/auth\/forgot-password$/.test(path)) {
      return ok(config, { data: { message: 'Modo demo: recuperacao simulada.', debugToken: 'demo-reset-token' } });
    }

    if (method === 'post' && path === '/auth/forgot-password') {
      return ok(config, { data: { message: 'Modo demo: recuperacao simulada.', debugToken: 'demo-reset-token' } });
    }

    if (method === 'post' && path === '/auth/reset-password') {
      return ok(config, { data: { message: 'Modo demo: senha redefinida.' } });
    }

    if (method === 'post' && path === '/auth/login') {
      return ok(config, {
        data: {
          user: PUBLIC_ACCESS_USER,
          accessToken: 'demo-access-token',
          refreshToken: 'demo-refresh-token',
        },
      });
    }

    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      return ok(config, { success: true, data: { message: 'Operacao simulada no modo demo publico.' } });
    }

    if (method === 'get' && /^\/companies\/[^/]+$/.test(path)) {
      return ok(config, { success: true, data: demoCompany });
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/balance-sheet$/.test(path)) {
      return ok(config, dashboardBalanceSheet);
    }

    if (method === 'get' && /^\/companies\/[^/]+\/reports\/income-statement$/.test(path)) {
      return ok(config, dashboardDre);
    }

    return notFound(config);
  };
}
