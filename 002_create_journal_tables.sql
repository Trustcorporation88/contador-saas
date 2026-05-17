-- ============================================================================
-- Migration: 002_create_journal_tables.sql
-- Description: Create Journal Entries, Lines, and Documents schema
-- Database: PostgreSQL 14+
-- Author: Backend Architect
-- Date: 2026-05-17
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- Tabela: journal_entries (Lançamentos Contábeis)
-- ============================================================================
-- Descrição: Armazena os lançamentos contábeis (diários) de cada empresa.
--            Cada lançamento é composto por um ou mais lines (linhas) que
--            detalham as contas afetadas. Implementa validação de partidas
--            dobradas (debitos = créditos) e assinatura digital para auditoria.
--
-- Campos:
--   - id: Identificador único (UUID)
--   - company_id: Referência à empresa (multi-tenant)
--   - entry_date: Data do lançamento contábil
--   - description: Descrição/motivo do lançamento
--   - reference_type: Tipo de documento origem (NF, RPA, CHEQUE, BOLETO, MANUAL)
--   - reference_number: Número do documento origem
--   - reference_issuer: Emissor do documento (fornecedor, emitente, etc)
--   - total_debit: Soma de todos os débitos (informativo, calculado)
--   - total_credit: Soma de todos os créditos (informativo, calculado)
--   - is_posted: Flag indicando se lançamento foi finalizado/postado
--   - data_hash: SHA-256 hash do conteúdo para auditoria (assinatura)
--   - created_by: Usuário que criou o lançamento
--   - created_at: Timestamp de criação
--   - updated_at: Timestamp da última alteração
--
-- Constraints:
--   - valid_debit_credit: Garante que débito e crédito sejam >= 0
--   - balanced: Garante que ABS(débito - crédito) < 0.01 (tolerância de 1 centavo)
--   - NOT NULL: company_id, entry_date, created_by são obrigatórios
--   - Foreign Keys: company_id -> companies.id, created_by -> users.id
--
-- Índices:
--   - idx_journal_entries_company: Otimiza queries por empresa
--   - idx_journal_entries_date: Otimiza filtros por data (range queries)
--   - idx_journal_entries_posted: Otimiza queries por status de postagem
--   - idx_journal_entries_hash: Otimiza busca por assinatura (auditoria)
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  -- Identificadores e Chaves Estrangeiras
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  
  -- Dados do Lançamento
  entry_date DATE NOT NULL,
  description VARCHAR(500),
  reference_type VARCHAR(50), -- 'NF', 'RPA', 'CHEQUE', 'BOLETO', 'MANUAL'
  reference_number VARCHAR(50),
  reference_issuer VARCHAR(255),
  
  -- Totalizadores (informativo, calculados pelas lines)
  total_debit NUMERIC(18,2) DEFAULT 0,
  total_credit NUMERIC(18,2) DEFAULT 0,
  
  -- Status e Auditoria
  is_posted BOOLEAN DEFAULT false,
  data_hash VARCHAR(64), -- SHA-256 hash para audit trail
  
  -- Auditoria Temporal
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints de Validação
  CONSTRAINT valid_debit_credit CHECK (
    total_debit >= 0 AND total_credit >= 0
  ),
  CONSTRAINT balanced CHECK (
    ABS(total_debit - total_credit) < 0.01 -- Tolerância de 1 centavo
  ),
  CONSTRAINT valid_reference_type CHECK (
    reference_type IS NULL OR 
    reference_type IN ('NF', 'RPA', 'CHEQUE', 'BOLETO', 'MANUAL')
  )
  
  -- Referências para outras tabelas
  -- company_id REFERENCES companies(id) ON DELETE CASCADE,
  -- created_by REFERENCES users(id) ON DELETE RESTRICT
  
  -- Nota: As constraint de foreign keys serão adicionadas após as tabelas
  -- companies e users estarem criadas. Use ALTER TABLE para adicionar.
);

-- Índices para Performance
-- ============================================================================

-- Índice 1: Otimiza queries por empresa
-- Utilizado em: listagem de lançamentos da empresa, auditoria por empresa
CREATE INDEX IF NOT EXISTS idx_journal_entries_company
  ON journal_entries(company_id);

-- Índice 2: Otimiza filtros por data (range queries)
-- Utilizado em: balancete por período, DRE, demonstrações financeiras
CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries(entry_date);

-- Índice 3: Otimiza queries por status de postagem
-- Utilizado em: lançamentos não-postados, buscas por status
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted
  ON journal_entries(is_posted) WHERE is_posted = true;

-- Índice 4: Otimiza busca por assinatura digital
-- Utilizado em: validação de integridade, auditoria de segurança
CREATE INDEX IF NOT EXISTS idx_journal_entries_hash
  ON journal_entries(data_hash) WHERE data_hash IS NOT NULL;

-- Índice Composto 5: Otimiza queries comuns (company + date)
-- Utilizado em: balancete por período de uma empresa
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date
  ON journal_entries(company_id, entry_date);

-- Índice Composto 6: Otimiza queries de posted entries (company + date + posted)
-- Utilizado em: demonstrações financeiras (apenas lançamentos postados)
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_posted_date
  ON journal_entries(company_id, is_posted, entry_date);


-- ============================================================================
-- Tabela: journal_lines (Linhas de Lançamento)
-- ============================================================================
-- Descrição: Armazena as linhas individuais de cada lançamento contábil.
--            Implementa validação de que cada linha tem OU débito OU crédito
--            (nunca zero ou ambos). Garante a dupla entrada contábil.
--
-- Campos:
--   - id: Identificador único (UUID)
--   - journal_entry_id: Referência ao lançamento pai
--   - account_id: Conta contábil afetada
--   - cost_center_id: Centro de custo (opcional, para análise)
--   - debit: Valor do débito (sempre >= 0)
--   - credit: Valor do crédito (sempre >= 0)
--   - description: Descrição da linha (motivo, detalhes)
--   - line_number: Sequência da linha no lançamento (1, 2, 3, ...)
--
-- Constraints:
--   - valid_debit_credit: Garante que débito e crédito sejam >= 0
--   - not_both_zero: Garante que OU débito OU crédito > 0, nunca ambos zero
--   - NOT NULL: journal_entry_id, account_id, line_number obrigatórios
--   - Foreign Keys: journal_entry_id -> journal_entries.id, 
--                   account_id -> accounts.id,
--                   cost_center_id -> cost_centers.id
--
-- Índices:
--   - idx_journal_lines_entry: Otimiza busca de linhas de um lançamento
--   - idx_journal_lines_account: Otimiza queries de saldo da conta
--   - idx_journal_lines_cost_center: Otimiza análise por centro de custo
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_lines (
  -- Identificadores e Chaves Estrangeiras
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL,
  account_id UUID NOT NULL,
  cost_center_id UUID,
  
  -- Valores (débito OU crédito, nunca ambos ou zero)
  debit NUMERIC(18,2) DEFAULT 0,
  credit NUMERIC(18,2) DEFAULT 0,
  description VARCHAR(500),
  
  -- Sequência
  line_number INT NOT NULL,
  
  -- Constraints de Validação
  CONSTRAINT valid_debit_credit CHECK (
    debit >= 0 AND credit >= 0
  ),
  CONSTRAINT not_both_zero CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  ),
  CONSTRAINT valid_line_number CHECK (
    line_number > 0
  )
  
  -- Referências para outras tabelas
  -- journal_entry_id REFERENCES journal_entries(id) ON DELETE CASCADE,
  -- account_id REFERENCES accounts(id) ON DELETE RESTRICT,
  -- cost_center_id REFERENCES cost_centers(id) ON DELETE SET NULL
);

-- Índices para Performance
-- ============================================================================

-- Índice 1: Otimiza busca de linhas de um lançamento
-- Utilizado em: listagem de linhas do lançamento, cálculo de totais
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry
  ON journal_lines(journal_entry_id);

-- Índice 2: Otimiza queries de saldo da conta
-- Utilizado em: cálculo de saldo contábil, ledger (livro razão)
CREATE INDEX IF NOT EXISTS idx_journal_lines_account
  ON journal_lines(account_id);

-- Índice 3: Otimiza análise por centro de custo
-- Utilizado em: análise de lucro por centro de custo
CREATE INDEX IF NOT EXISTS idx_journal_lines_cost_center
  ON journal_lines(cost_center_id) WHERE cost_center_id IS NOT NULL;

-- Índice Composto 4: Otimiza queries de saldo (account + entry date)
-- Utilizado em: cálculo de saldo em data específica
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_entry
  ON journal_lines(account_id, journal_entry_id);


-- ============================================================================
-- Tabela: documents (Documentos Origem)
-- ============================================================================
-- Descrição: Armazena referências aos documentos que originam os lançamentos
--            (Nota Fiscal, Recibos, Boletos, etc). Permite rastreamento
--            de auditoria e ligação entre documento e lançamento.
--
-- Campos:
--   - id: Identificador único (UUID)
--   - journal_entry_id: Referência ao lançamento (pode ser NULL para documentos orphaned)
--   - document_type: Tipo de documento (NF, RPA, CHEQUE, BOLETO, INVOICE, OTHERS)
--   - document_number: Número do documento (série e número)
--   - issuer: Quem emitiu o documento (CNPJ/nome do fornecedor)
--   - issue_date: Data de emissão do documento
--   - amount: Valor total do documento (referência)
--   - created_at: Data de criação do registro
--
-- Constraints:
--   - valid_document_type: Validação de tipos permitidos
--   - Foreign Key: journal_entry_id -> journal_entries.id (optional, ON DELETE SET NULL)
--
-- Índices:
--   - idx_documents_entry: Otimiza busca de documentos de um lançamento
--   - idx_documents_number: Otimiza busca por número de documento (validação de duplicatas)
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  -- Identificadores e Chaves Estrangeiras
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID,
  
  -- Dados do Documento
  document_type VARCHAR(50) NOT NULL, -- 'NF', 'RPA', 'CHEQUE', 'BOLETO', 'INVOICE', 'OTHER'
  document_number VARCHAR(50),
  issuer VARCHAR(255),
  issue_date DATE,
  amount NUMERIC(18,2),
  
  -- Auditoria Temporal
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints de Validação
  CONSTRAINT valid_document_type CHECK (
    document_type IN ('NF', 'RPA', 'CHEQUE', 'BOLETO', 'INVOICE', 'OTHER')
  )
  
  -- Referências para outras tabelas
  -- journal_entry_id REFERENCES journal_entries(id) ON DELETE SET NULL
);

-- Índices para Performance
-- ============================================================================

-- Índice 1: Otimiza busca de documentos de um lançamento
-- Utilizado em: listar documentos de um lançamento
CREATE INDEX IF NOT EXISTS idx_documents_entry
  ON documents(journal_entry_id) WHERE journal_entry_id IS NOT NULL;

-- Índice 2: Otimiza busca por número de documento
-- Utilizado em: validação de documentos duplicados, auditoria
CREATE INDEX IF NOT EXISTS idx_documents_number
  ON documents(document_number) WHERE document_number IS NOT NULL;

-- Índice Composto 3: Otimiza queries comuns (type + number)
-- Utilizado em: validação de documentos únicos por tipo
CREATE INDEX IF NOT EXISTS idx_documents_type_number
  ON documents(document_type, document_number);


-- ============================================================================
-- Attachments: NOTA - Criada apenas como referência, não implementada aqui
-- ============================================================================
-- A tabela attachments será criada em um migration posterior (1.4 ou 1.5)
-- pois depende da tabela documents estar completamente validada.
-- Ver seção 2.9 de ARQUITETURA-TECNICA.md para especificação completa.


-- ============================================================================
-- Histórico de Migrações
-- ============================================================================
-- 2026-05-17: Criação inicial das tabelas journal_entries, journal_lines e documents
--             conforme seções 2.6, 2.7, 2.8 da arquitetura técnica.
--             - Suporta multi-tenant
--             - Validação de partidas dobradas
--             - Suporte a documentos origem
--             - Assinatura digital para auditoria
-- ============================================================================

-- ============================================================================
-- Próximas Etapas:
-- ============================================================================
-- 1. Executar 001_create_accounts.sql (se não feito)
-- 2. Adicionar foreign keys após tabelas companies e users estarem criadas
-- 3. Executar 003_create_audit_triggers.sql para criar triggers de auditoria
-- 4. Executar 004_create_balance_triggers.sql para triggers de cálculo de saldos
-- 5. Inserir dados de teste (journal entries de exemplo)
-- 
-- Comando para adicionar foreign keys (execute após companies e users):
-- ============================================================================
-- 
-- ALTER TABLE journal_entries 
--   ADD CONSTRAINT fk_journal_entries_company 
--   FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
--
-- ALTER TABLE journal_entries 
--   ADD CONSTRAINT fk_journal_entries_created_by 
--   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
--
-- ALTER TABLE journal_lines 
--   ADD CONSTRAINT fk_journal_lines_entry 
--   FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE;
--
-- ALTER TABLE journal_lines 
--   ADD CONSTRAINT fk_journal_lines_account 
--   FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
--
-- ALTER TABLE journal_lines 
--   ADD CONSTRAINT fk_journal_lines_cost_center 
--   FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL;
--
-- ALTER TABLE documents 
--   ADD CONSTRAINT fk_documents_entry 
--   FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL;
--
-- ============================================================================

-- ============================================================================
-- Exemplo de Uso (após foreign keys serem adicionadas)
-- ============================================================================
--
-- -- 1. Inserir um lançamento contábil (débito = crédito)
-- INSERT INTO journal_entries 
-- (company_id, entry_date, description, reference_type, reference_number, 
--  reference_issuer, created_by, total_debit, total_credit)
-- VALUES 
-- ('uuid-company-1', '2026-05-15', 'Compra de material de escritório', 
--  'NF', '000123456', 'Fornecedor XYZ Ltda', 'uuid-user-1', 500.00, 500.00);
--
-- -- 2. Inserir as linhas do lançamento
-- INSERT INTO journal_lines (journal_entry_id, account_id, cost_center_id, 
--                            debit, credit, description, line_number)
-- VALUES 
-- ('uuid-entry-1', 'uuid-acc-material', 'uuid-cc-admin', 500.00, 0, 
--  'Material de escritório', 1),
-- ('uuid-entry-1', 'uuid-acc-bank', NULL, 0, 500.00, 
--  'Pagamento em banco', 2);
--
-- -- 3. Inserir referência ao documento
-- INSERT INTO documents (journal_entry_id, document_type, document_number, 
--                        issuer, issue_date, amount)
-- VALUES ('uuid-entry-1', 'NF', '000123456', 'Fornecedor XYZ Ltda', 
--         '2026-05-15', 500.00);
--
-- -- 4. Consultar lançamentos da empresa
-- SELECT je.id, je.entry_date, je.description, je.total_debit, je.total_credit
-- FROM journal_entries je
-- WHERE je.company_id = 'uuid-company-1'
-- ORDER BY je.entry_date DESC;
--
-- -- 5. Consultar saldo de uma conta em uma data
-- SELECT 
--   SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) as debit_sum,
--   SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END) as credit_sum
-- FROM journal_lines jl
-- JOIN journal_entries je ON jl.journal_entry_id = je.id
-- WHERE jl.account_id = 'uuid-account-1' 
--   AND je.entry_date <= '2026-05-31'
--   AND je.company_id = 'uuid-company-1';
--
-- ============================================================================
