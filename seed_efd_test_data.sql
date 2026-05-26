/**
 * EFD Test Data Seed Script
 * Populates test data for EFD testing
 * Usage: psql -U user -d database_name -f seed_efd_test_data.sql
 */

-- Create test company if not exists
INSERT INTO companies (id, cnpj, company_name, is_active, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '12345678000100',
  'Empresa Teste LTDA',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create test accounts
INSERT INTO accounts (id, company_id, account_code, account_name, account_nature, account_type, is_active, created_at)
VALUES
  -- Assets
  ('1a0a1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '1.0.1.1', 'Banco', 'asset', 'current_asset', true, NOW()),
  ('1b0b1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '1.0.2.1', 'Caixa', 'asset', 'current_asset', true, NOW()),
  ('1c0c1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '1.0.3.1', 'Clientes', 'asset', 'current_asset', true, NOW()),
  
  -- Liabilities
  ('2a0a1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '2.0.1.1', 'Fornecedores', 'liability', 'current_liability', true, NOW()),
  ('2b0b1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '2.0.2.1', 'Tributos', 'liability', 'current_liability', true, NOW()),
  
  -- Equity
  ('3a0a1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '3.0.1.1', 'Capital', 'equity', 'equity', true, NOW()),
  ('3b0b1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '3.0.2.1', 'Lucros Acumulados', 'equity', 'equity', true, NOW()),
  
  -- Revenue
  ('4a0a1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '4.0.1.1', 'Vendas', 'revenue', 'revenue', true, NOW()),
  ('4b0b1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '4.0.2.1', 'Serviços', 'revenue', 'revenue', true, NOW()),
  
  -- Expenses
  ('5a0a1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '5.0.1.1', 'Salários', 'expense', 'expense', true, NOW()),
  ('5b0b1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '5.0.2.1', 'Aluguel', 'expense', 'expense', true, NOW()),
  ('5c0c1234-5678-90ab-cdef-1234567890ab', '550e8400-e29b-41d4-a716-446655440000', '5.0.3.1', 'Utilidades', 'expense', 'expense', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test journal entries for March 2024
-- Entry 1: Initial capital injection
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e1111111-1111-1111-1111-111111111111',
  '550e8400-e29b-41d4-a716-446655440000',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  '3a0a1234-5678-90ab-cdef-1234567890ab',
  'Aporte de capital inicial',
  100000.00,
  0,
  '2024-03-01'::date,
  'CAPITAL001',
  'Contrato Social',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 2: Credit to equity
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e2222222-2222-2222-2222-222222222222',
  '550e8400-e29b-41d4-a716-446655440000',
  '3a0a1234-5678-90ab-cdef-1234567890ab',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  'Aporte de capital inicial',
  0,
  100000.00,
  '2024-03-01'::date,
  'CAPITAL001',
  'Contrato Social',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 3: Sales revenue
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e3333333-3333-3333-3333-333333333333',
  '550e8400-e29b-41d4-a716-446655440000',
  '1c0c1234-5678-90ab-cdef-1234567890ab',
  '4a0a1234-5678-90ab-cdef-1234567890ab',
  'Venda de produtos - NF 001',
  25000.00,
  0,
  '2024-03-05'::date,
  'NF001',
  'NFe 001',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 4: Sales revenue credit
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e4444444-4444-4444-4444-444444444444',
  '550e8400-e29b-41d4-a716-446655440000',
  '4a0a1234-5678-90ab-cdef-1234567890ab',
  '1c0c1234-5678-90ab-cdef-1234567890ab',
  'Venda de produtos - NF 001',
  0,
  25000.00,
  '2024-03-05'::date,
  'NF001',
  'NFe 001',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 5: Service revenue
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e5555555-5555-5555-5555-555555555555',
  '550e8400-e29b-41d4-a716-446655440000',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  '4b0b1234-5678-90ab-cdef-1234567890ab',
  'Receita de serviços - Mar/2024',
  15000.00,
  0,
  '2024-03-10'::date,
  'REC001',
  'Recibo 001',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 6: Service revenue credit
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e6666666-6666-6666-6666-666666666666',
  '550e8400-e29b-41d4-a716-446655440000',
  '4b0b1234-5678-90ab-cdef-1234567890ab',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  'Receita de serviços - Mar/2024',
  0,
  15000.00,
  '2024-03-10'::date,
  'REC001',
  'Recibo 001',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 7: Salary expense
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e7777777-7777-7777-7777-777777777777',
  '550e8400-e29b-41d4-a716-446655440000',
  '5a0a1234-5678-90ab-cdef-1234567890ab',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  'Pagamento de salários - Mar/2024',
  8000.00,
  0,
  '2024-03-15'::date,
  'PAG001',
  'Folha de pagamento',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 8: Salary expense credit
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e8888888-8888-8888-8888-888888888888',
  '550e8400-e29b-41d4-a716-446655440000',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  '5a0a1234-5678-90ab-cdef-1234567890ab',
  'Pagamento de salários - Mar/2024',
  0,
  8000.00,
  '2024-03-15'::date,
  'PAG001',
  'Folha de pagamento',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 9: Rent expense
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'e9999999-9999-9999-9999-999999999999',
  '550e8400-e29b-41d4-a716-446655440000',
  '5b0b1234-5678-90ab-cdef-1234567890ab',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  'Aluguel do escritório - Mar/2024',
  5000.00,
  0,
  '2024-03-20'::date,
  'ALG001',
  'Recibo de aluguel',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Entry 10: Rent expense credit
INSERT INTO journal_entries (
  id, company_id, account_from_id, account_to_id, description, debit_value, credit_value,
  entry_date, document_number, reference_document, is_reconciled, created_at, updated_at
)
VALUES (
  'eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '550e8400-e29b-41d4-a716-446655440000',
  '1a0a1234-5678-90ab-cdef-1234567890ab',
  '5b0b1234-5678-90ab-cdef-1234567890ab',
  'Aluguel do escritório - Mar/2024',
  0,
  5000.00,
  '2024-03-20'::date,
  'ALG001',
  'Recibo de aluguel',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create EFD Scheduler Configuration
INSERT INTO efd_scheduler_config (
  id, company_id, enabled, day_of_month, hour, minute, timezone,
  auto_generate, notify_on_completion, notify_on_error,
  notification_email, include_operations, include_inventory, include_adjustments,
  retention_days, created_at, updated_at
)
VALUES (
  'sch11111-1111-1111-1111-111111111111',
  '550e8400-e29b-41d4-a716-446655440000',
  true,
  5,
  8,
  0,
  'America/Sao_Paulo',
  true,
  true,
  true,
  'contador@empresa.com.br',
  true,
  false,
  true,
  90,
  NOW(),
  NOW()
)
ON CONFLICT (company_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  day_of_month = EXCLUDED.day_of_month,
  hour = EXCLUDED.hour,
  minute = EXCLUDED.minute,
  updated_at = NOW();

-- Verify test data
SELECT 'Test data seed completed' as status;

SELECT 
  COUNT(*) as journal_entries_count,
  SUM(debit_value) as total_debit,
  SUM(credit_value) as total_credit
FROM journal_entries
WHERE company_id = '550e8400-e29b-41d4-a716-446655440000'
  AND entry_date >= '2024-03-01'::date
  AND entry_date <= '2024-03-31'::date;

SELECT 'Test Company' as company_name, 
       '12345678000100' as cnpj,
       COUNT(*) as accounts_count
FROM accounts
WHERE company_id = '550e8400-e29b-41d4-a716-446655440000';

SELECT day_of_month, hour, minute, timezone, enabled
FROM efd_scheduler_config
WHERE company_id = '550e8400-e29b-41d4-a716-446655440000';
