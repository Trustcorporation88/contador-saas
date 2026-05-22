-- ============================================================================
-- Database Index Optimization - EXPLAIN ANALYZE Test Scripts
-- ============================================================================
-- File: 009_test_index_performance.sql
-- Description: Queries para testar performance antes/depois dos índices
-- Usage: psql -U postgres -d contador_saas -f 009_test_index_performance.sql
-- ============================================================================

\echo '============================================================================'
\echo 'DATABASE INDEX OPTIMIZATION - PERFORMANCE TEST SUITE'
\echo '============================================================================'
\echo ''

-- Enable timing
\timing on

-- Set output format
\x off

\echo '============================================================================'
\echo 'TEST 1: Journal Entries - List by Company + Date + Status'
\echo '============================================================================'
\echo ''
\echo 'Query: Lista lançamentos postados de uma empresa no ano'
\echo 'Expected: Index Scan on idx_journal_company_status_date'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM journal_entries 
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND entry_date >= '2024-01-01' 
  AND entry_date <= '2024-12-31'
  AND is_posted = true
ORDER BY entry_date DESC
LIMIT 20;

\echo ''
\echo '============================================================================'
\echo 'TEST 2: Account Balances - Heavy JOIN with Aggregation'
\echo '============================================================================'
\echo ''
\echo 'Query: Cálculo de saldos de contas (usado em Balance Sheet, DRE)'
\echo 'Expected: Index Scan on idx_journal_lines_account_entry'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT a.id, a.code, a.name, a.type,
       COALESCE(SUM(jl.debit), 0) as debit_total,
       COALESCE(SUM(jl.credit), 0) as credit_total,
       CASE 
         WHEN a.type IN ('ASSET', 'EXPENSE') THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
         ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
       END as balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
WHERE a.company_id = (SELECT id FROM companies LIMIT 1)
  AND je.is_posted = true
  AND je.entry_date >= '2024-01-01'
  AND je.entry_date <= '2024-12-31'
GROUP BY a.id, a.code, a.name, a.type
ORDER BY a.code;

\echo ''
\echo '============================================================================'
\echo 'TEST 3: Accounts - Search by Company + Code'
\echo '============================================================================'
\echo ''
\echo 'Query: Busca conta por código (usado em validações, imports)'
\echo 'Expected: Index Scan on idx_accounts_company_code'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM accounts 
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND code = '1.1.1';

\echo ''
\echo '============================================================================'
\echo 'TEST 4: Documents - List by Company + Type + Date'
\echo '============================================================================'
\echo ''
\echo 'Query: Lista documentos fiscais ativos por tipo'
\echo 'Expected: Index Scan on idx_documents_company_type_date'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM documents 
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND document_type = 'NF'
  AND issue_date >= '2024-01-01'
  AND issue_date <= '2024-12-31'
  AND is_active = true
ORDER BY issue_date DESC
LIMIT 20;

\echo ''
\echo '============================================================================'
\echo 'TEST 5: Tax Calculations - Search by Company + Period'
\echo '============================================================================'
\echo ''
\echo 'Query: Busca apurações de impostos por período'
\echo 'Expected: Index Scan on idx_taxes_company_period'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM tax_calculations 
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND calculation_period >= '2024-01'
  AND calculation_period <= '2024-12';

\echo ''
\echo '============================================================================'
\echo 'TEST 6: Contas Receber - Summary (Open Receivables)'
\echo '============================================================================'
\echo ''
\echo 'Query: Resumo de contas a receber em aberto'
\echo 'Expected: Index Scan on idx_contas_receber_aberto'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  SUM(valor_original - COALESCE(valor_recebido, 0)) as total_aberto,
  COUNT(*) as count_aberto,
  SUM(CASE WHEN data_vencimento < CURRENT_DATE THEN valor_original - COALESCE(valor_recebido, 0) ELSE 0 END) as total_vencido
FROM contas_receber 
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND is_active = true
  AND status NOT IN ('recebido', 'cancelado');

\echo ''
\echo '============================================================================'
\echo 'TEST 7: Contas Pagar - Summary (Open Payables)'
\echo '============================================================================'
\echo ''
\echo 'Query: Resumo de contas a pagar em aberto'
\echo 'Expected: Index Scan on idx_contas_pagar_aberto'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  SUM(valor_original - COALESCE(valor_pago, 0)) as total_aberto,
  COUNT(*) as count_aberto,
  SUM(CASE WHEN data_vencimento < CURRENT_DATE THEN valor_original - COALESCE(valor_pago, 0) ELSE 0 END) as total_vencido
FROM contas_pagar 
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND is_active = true
  AND status NOT IN ('pago', 'cancelado');

\echo ''
\echo '============================================================================'
\echo 'TEST 8: Journal Lines - Index Only Scan (INCLUDE test)'
\echo '============================================================================'
\echo ''
\echo 'Query: Saldo de uma conta específica (usando INCLUDE clause)'
\echo 'Expected: Index Only Scan using idx_journal_lines_account_amounts'
\echo ''

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  journal_entry_id,
  debit,
  credit
FROM journal_lines
WHERE account_id = (SELECT id FROM accounts WHERE company_id = (SELECT id FROM companies LIMIT 1) LIMIT 1);

\echo ''
\echo '============================================================================'
\echo 'PERFORMANCE SUMMARY'
\echo '============================================================================'
\echo ''

-- Index usage statistics
\echo 'Index Usage Statistics:'
\echo '----------------------'
SELECT 
  schemaname, tablename, indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 20;

\echo ''
\echo 'Buffer Cache Hit Ratio:'
\echo '----------------------'
SELECT 
  'Table Cache Hit Ratio' as metric,
  round(sum(heap_blks_hit)::numeric / nullif(sum(heap_blks_hit + heap_blks_read), 0) * 100, 2) as percentage
FROM pg_statio_user_tables
WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Index Cache Hit Ratio' as metric,
  round(sum(idx_blks_hit)::numeric / nullif(sum(idx_blks_hit + idx_blks_read), 0) * 100, 2) as percentage
FROM pg_statio_user_indexes
WHERE schemaname = 'public';

\echo ''
\echo 'Database Size:'
\echo '-------------'
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))) as tables_total_size,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename)) - sum(pg_relation_size(schemaname||'.'||tablename))) as indexes_total_size
FROM pg_tables
WHERE schemaname = 'public';

\echo ''
\echo 'Top 10 Largest Tables (with indexes):'
\echo '--------------------------------------'
SELECT 
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
  round(100 * (pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename))::numeric / nullif(pg_total_relation_size(schemaname||'.'||tablename), 0), 2) as index_ratio_pct
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

\echo ''
\echo '============================================================================'
\echo 'TEST SUITE COMPLETED'
\echo '============================================================================'
\echo ''
\echo 'Recommendations:'
\echo '  1. Compare "Execution time" before/after migration'
\echo '  2. Verify "Index Scan" instead of "Seq Scan" in query plans'
\echo '  3. Check "Buffer Cache Hit Ratio" > 95%'
\echo '  4. Monitor "Index Usage Statistics" (scans should increase)'
\echo '  5. Validate database size increase < 10%'
\echo ''
\echo 'Next Steps:'
\echo '  - Save output: psql ... -f this_file.sql > output.txt'
\echo '  - Run baseline BEFORE migration'
\echo '  - Run migration: npm run migrate:up'
\echo '  - Run test again AFTER migration'
\echo '  - Compare results'
\echo ''

-- Disable timing
\timing off
