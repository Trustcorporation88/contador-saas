-- ============================================================================
-- SEED DE DEMONSTRAÇÃO — O Contador
-- Empresa fictícia: Tech Soluções Ltda
-- ============================================================================

-- 1. Tabelas ausentes: accounts e journal_entries
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL,
  parent_id   UUID,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  tax_code    VARCHAR(50),
  is_analytical BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent  ON accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type    ON accounts(type);

CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL,
  entry_date       DATE NOT NULL,
  description      VARCHAR(500) NOT NULL,
  reference_type   VARCHAR(50),
  reference_number VARCHAR(100),
  total_debit      NUMERIC(15,2) DEFAULT 0,
  total_credit     NUMERIC(15,2) DEFAULT 0,
  is_posted        BOOLEAN DEFAULT false,
  data_hash        VARCHAR(64),
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL,
  description      VARCHAR(500),
  debit            NUMERIC(15,2) DEFAULT 0,
  credit           NUMERIC(15,2) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date    ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_items_entry     ON journal_items(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_items_account   ON journal_items(account_id);

-- ============================================================================
-- 2. Empresa fictícia: Tech Soluções Ltda
-- ============================================================================

INSERT INTO companies (cnpj, legal_name, trade_name, email, phone, address, city, state, postal_code, status, is_active)
VALUES (
  '12345678000195',
  'Tech Soluções Tecnologia Ltda',
  'TechSol',
  'financeiro@techsol.com.br',
  '(11) 3000-4000',
  'Av. Paulista, 1000, Sala 501',
  'São Paulo',
  'SP',
  '01310100',
  'active',
  true
)
ON CONFLICT (cnpj) DO NOTHING;

-- Captura o ID da empresa para uso nas demais inserções
DO $$
DECLARE
  v_company_id UUID;
  v_admin_id   UUID;

  -- IDs de contas (Ativo)
  v_ativo          UUID := gen_random_uuid();
  v_ativo_circ     UUID := gen_random_uuid();
  v_caixa          UUID := gen_random_uuid();
  v_banco          UUID := gen_random_uuid();
  v_clientes       UUID := gen_random_uuid();
  v_ativo_ncirc    UUID := gen_random_uuid();
  v_imobilizado    UUID := gen_random_uuid();
  v_equipamentos   UUID := gen_random_uuid();

  -- IDs de contas (Passivo)
  v_passivo        UUID := gen_random_uuid();
  v_pass_circ      UUID := gen_random_uuid();
  v_fornecedores   UUID := gen_random_uuid();
  v_impostos_pagar UUID := gen_random_uuid();
  v_salarios_pagar UUID := gen_random_uuid();

  -- IDs de contas (PL)
  v_pl             UUID := gen_random_uuid();
  v_capital        UUID := gen_random_uuid();
  v_lucros         UUID := gen_random_uuid();

  -- IDs de contas (Receitas)
  v_receitas       UUID := gen_random_uuid();
  v_rec_servicos   UUID := gen_random_uuid();
  v_rec_software   UUID := gen_random_uuid();

  -- IDs de contas (Despesas)
  v_despesas       UUID := gen_random_uuid();
  v_desp_pessoal   UUID := gen_random_uuid();
  v_desp_salarios  UUID := gen_random_uuid();
  v_desp_encargos  UUID := gen_random_uuid();
  v_desp_infra     UUID := gen_random_uuid();
  v_desp_aluguel   UUID := gen_random_uuid();
  v_desp_ti        UUID := gen_random_uuid();
  v_desp_impostos  UUID := gen_random_uuid();
  v_desp_iss       UUID := gen_random_uuid();

  -- IDs dos lançamentos
  v_je1 UUID := gen_random_uuid();
  v_je2 UUID := gen_random_uuid();
  v_je3 UUID := gen_random_uuid();
  v_je4 UUID := gen_random_uuid();
  v_je5 UUID := gen_random_uuid();
  v_je6 UUID := gen_random_uuid();

BEGIN
  SELECT id INTO v_company_id FROM companies WHERE cnpj = '12345678000195';
  SELECT id INTO v_admin_id    FROM users    WHERE email = 'admin@contador.dev';

  -- ============================================================
  -- 3. Plano de Contas — estrutura simplificada (Lei 6.404/76)
  -- ============================================================

  -- ATIVO
  INSERT INTO accounts (id, company_id, code, name, type, is_analytical) VALUES
    (v_ativo,       v_company_id, '1',     'ATIVO',                        'ASSET', false),
    (v_ativo_circ,  v_company_id, '1.1',   'Ativo Circulante',             'ASSET', false),
    (v_caixa,       v_company_id, '1.1.1', 'Caixa e Equivalentes',         'ASSET', true),
    (v_banco,       v_company_id, '1.1.2', 'Bancos Conta Movimento',       'ASSET', true),
    (v_clientes,    v_company_id, '1.1.3', 'Clientes a Receber',           'ASSET', true),
    (v_ativo_ncirc, v_company_id, '1.2',   'Ativo Não Circulante',         'ASSET', false),
    (v_imobilizado, v_company_id, '1.2.1', 'Imobilizado',                  'ASSET', false),
    (v_equipamentos,v_company_id, '1.2.1.1','Equipamentos de Informática', 'ASSET', true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- PASSIVO
  INSERT INTO accounts (id, company_id, parent_id, code, name, type, is_analytical) VALUES
    (v_passivo,        v_company_id, NULL,          '2',     'PASSIVO',                   'LIABILITY', false),
    (v_pass_circ,      v_company_id, v_passivo,     '2.1',   'Passivo Circulante',        'LIABILITY', false),
    (v_fornecedores,   v_company_id, v_pass_circ,   '2.1.1', 'Fornecedores',              'LIABILITY', true),
    (v_impostos_pagar, v_company_id, v_pass_circ,   '2.1.2', 'Impostos a Recolher',       'LIABILITY', true),
    (v_salarios_pagar, v_company_id, v_pass_circ,   '2.1.3', 'Salários a Pagar',          'LIABILITY', true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- PATRIMÔNIO LÍQUIDO
  INSERT INTO accounts (id, company_id, parent_id, code, name, type, is_analytical) VALUES
    (v_pl,      v_company_id, NULL,    '3',     'PATRIMÔNIO LÍQUIDO',        'EQUITY', false),
    (v_capital, v_company_id, v_pl,   '3.1',   'Capital Social Integralizado','EQUITY', true),
    (v_lucros,  v_company_id, v_pl,   '3.2',   'Lucros ou Prejuízos Acumulados','EQUITY', true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- RECEITAS
  INSERT INTO accounts (id, company_id, parent_id, code, name, type, is_analytical) VALUES
    (v_receitas,     v_company_id, NULL,        '4',     'RECEITAS',                    'REVENUE', false),
    (v_rec_servicos, v_company_id, v_receitas,  '4.1',   'Receitas de Serviços',        'REVENUE', false),
    (v_rec_software, v_company_id, v_rec_servicos,'4.1.1','Receita de Software / SaaS', 'REVENUE', true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- DESPESAS
  INSERT INTO accounts (id, company_id, parent_id, code, name, type, is_analytical) VALUES
    (v_despesas,      v_company_id, NULL,          '5',     'DESPESAS',                'EXPENSE', false),
    (v_desp_pessoal,  v_company_id, v_despesas,    '5.1',   'Despesas com Pessoal',    'EXPENSE', false),
    (v_desp_salarios, v_company_id, v_desp_pessoal,'5.1.1', 'Salários e Ordenados',    'EXPENSE', true),
    (v_desp_encargos, v_company_id, v_desp_pessoal,'5.1.2', 'Encargos Sociais (FGTS/INSS)','EXPENSE', true),
    (v_desp_infra,    v_company_id, v_despesas,    '5.2',   'Despesas de Infraestrutura','EXPENSE', false),
    (v_desp_aluguel,  v_company_id, v_desp_infra,  '5.2.1', 'Aluguel de Escritório',   'EXPENSE', true),
    (v_desp_ti,       v_company_id, v_desp_infra,  '5.2.2', 'Serviços de TI / Cloud',  'EXPENSE', true),
    (v_desp_impostos, v_company_id, v_despesas,    '5.3',   'Impostos e Contribuições','EXPENSE', false),
    (v_desp_iss,      v_company_id, v_desp_impostos,'5.3.1','ISS sobre Serviços',       'EXPENSE', true)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- ============================================================
  -- 4. Lançamentos Contábeis — Maio/2026
  -- ============================================================

  -- Lançamento 1: Integralização do Capital Social (01/05)
  INSERT INTO journal_entries (id, company_id, entry_date, description, reference_type, total_debit, total_credit, is_posted, created_by)
  VALUES (v_je1, v_company_id, '2026-05-01', 'Integralização do Capital Social', 'MANUAL', 150000.00, 150000.00, true, v_admin_id);

  INSERT INTO journal_items (journal_entry_id, account_id, description, debit, credit) VALUES
    (v_je1, v_banco,   'Depósito capital social na conta corrente', 150000.00, 0),
    (v_je1, v_capital, 'Capital social integralizado pelos sócios',  0, 150000.00);

  -- Lançamento 2: Receita de serviços — cliente Empresa Alfa (05/05)
  INSERT INTO journal_entries (id, company_id, entry_date, description, reference_type, reference_number, total_debit, total_credit, is_posted, created_by)
  VALUES (v_je2, v_company_id, '2026-05-05', 'NF 001 — Empresa Alfa — Licença SaaS mensal', 'NF', '001', 28000.00, 28000.00, true, v_admin_id);

  INSERT INTO journal_items (journal_entry_id, account_id, description, debit, credit) VALUES
    (v_je2, v_clientes,    'A receber — Empresa Alfa',        28000.00, 0),
    (v_je2, v_rec_software,'Receita de Software/SaaS — NF 001', 0, 28000.00);

  -- Lançamento 3: Recebimento do cliente Alfa (10/05)
  INSERT INTO journal_entries (id, company_id, entry_date, description, reference_type, total_debit, total_credit, is_posted, created_by)
  VALUES (v_je3, v_company_id, '2026-05-10', 'Recebimento — Empresa Alfa — NF 001', 'MANUAL', 28000.00, 28000.00, true, v_admin_id);

  INSERT INTO journal_items (journal_entry_id, account_id, description, debit, credit) VALUES
    (v_je3, v_banco,    'Depósito em conta corrente',    28000.00, 0),
    (v_je3, v_clientes, 'Baixa do título — Empresa Alfa',  0, 28000.00);

  -- Lançamento 4: Folha de pagamento — Maio (15/05)
  INSERT INTO journal_entries (id, company_id, entry_date, description, reference_type, total_debit, total_credit, is_posted, created_by)
  VALUES (v_je4, v_company_id, '2026-05-15', 'Folha de Pagamento — Maio/2026', 'MANUAL', 18000.00, 18000.00, true, v_admin_id);

  INSERT INTO journal_items (journal_entry_id, account_id, description, debit, credit) VALUES
    (v_je4, v_desp_salarios, 'Salários brutos — 6 colaboradores', 15000.00, 0),
    (v_je4, v_desp_encargos, 'FGTS (8%) + INSS patronal (20%)',     3000.00, 0),
    (v_je4, v_salarios_pagar,'Salários a pagar — Maio/2026',            0, 18000.00);

  -- Lançamento 5: Pagamento do aluguel (20/05)
  INSERT INTO journal_entries (id, company_id, entry_date, description, reference_type, reference_number, total_debit, total_credit, is_posted, created_by)
  VALUES (v_je5, v_company_id, '2026-05-20', 'Aluguel do escritório — Maio/2026', 'BOLETO', '05/2026', 4500.00, 4500.00, true, v_admin_id);

  INSERT INTO journal_items (journal_entry_id, account_id, description, debit, credit) VALUES
    (v_je5, v_desp_aluguel, 'Aluguel — Ed. Paulista Tower sala 501', 4500.00, 0),
    (v_je5, v_banco,        'Pagamento via boleto bancário',             0, 4500.00);

  -- Lançamento 6: ISS sobre serviços de Maio (25/05)
  INSERT INTO journal_entries (id, company_id, entry_date, description, reference_type, total_debit, total_credit, is_posted, created_by)
  VALUES (v_je6, v_company_id, '2026-05-25', 'ISS — Competência Maio/2026 (5%)', 'MANUAL', 1400.00, 1400.00, true, v_admin_id);

  INSERT INTO journal_items (journal_entry_id, account_id, description, debit, credit) VALUES
    (v_je6, v_desp_iss,       'ISS 5% sobre R$ 28.000 de serviços', 1400.00, 0),
    (v_je6, v_impostos_pagar, 'ISS a recolher — Maio/2026',             0, 1400.00);

  RAISE NOTICE 'Seed concluído! Empresa: % | Contas: criadas | Lançamentos: 6', v_company_id;
END $$;
