-- =====================================================
-- MIGRATION 010: Tabelas de Reconciliação Bancária
-- =====================================================
-- Cria tabelas para upload de extratos, transações bancárias e matching

-- =====================================================
-- TABLE: bank_reconciliation_uploads
-- =====================================================
-- Armazena informações sobre upload de extratos bancários
CREATE TABLE IF NOT EXISTS bank_reconciliation_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(100), -- Banco do Brasil, Caixa, Itaú, etc
  transaction_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'uploaded', -- uploaded, processed, reconciled, failed
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  created_by UUID,
  notes TEXT,
  
  -- Constraints
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  
  -- Índices
  CONSTRAINT chk_upload_status CHECK (status IN ('uploaded', 'processed', 'reconciled', 'failed'))
);

CREATE INDEX idx_uploads_company_id ON bank_reconciliation_uploads(company_id);
CREATE INDEX idx_uploads_status ON bank_reconciliation_uploads(status);
CREATE INDEX idx_uploads_created_by ON bank_reconciliation_uploads(created_by);
CREATE INDEX idx_uploads_uploaded_at ON bank_reconciliation_uploads(uploaded_at);

-- =====================================================
-- TABLE: bank_transactions
-- =====================================================
-- Transações extraídas do arquivo de extrato bancário
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL,
  transaction_date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL, -- Valor absoluto
  type VARCHAR(20) NOT NULL, -- 'debit' (saída) ou 'credit' (entrada)
  bank_balance DECIMAL(15, 2), -- Saldo em conta após a transação
  document_number VARCHAR(50), -- Número de cheque, NSU, etc
  bank_branch_code VARCHAR(10),
  bank_account_number VARCHAR(20),
  raw_data TEXT, -- Dados brutos da linha do CSV para auditoria
  
  -- Constraints
  FOREIGN KEY (upload_id) REFERENCES bank_reconciliation_uploads(id) ON DELETE CASCADE,
  CONSTRAINT chk_transaction_type CHECK (type IN ('debit', 'credit')),
  CONSTRAINT chk_amount CHECK (amount >= 0)
);

CREATE INDEX idx_bank_transactions_upload_id ON bank_transactions(upload_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_description ON bank_transactions(description);

-- =====================================================
-- TABLE: reconciliation_matches
-- =====================================================
-- Sugestões de matching entre transações bancárias e lançamentos contábeis
CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL,
  bank_transaction_id UUID NOT NULL,
  journal_entry_id UUID, -- NULL se sem matching
  
  confidence DECIMAL(5, 4) NOT NULL DEFAULT 0, -- 0-1, percentual de confiança
  match_type VARCHAR(50) NOT NULL, -- 'automatic', 'manual', 'unmatched'
  
  -- Scores individuais para auditoria
  description_score DECIMAL(5, 4),
  amount_score DECIMAL(5, 4),
  date_score DECIMAL(5, 4),
  
  -- Metadata
  matched_at TIMESTAMP,
  matched_by UUID,
  notes TEXT,
  is_reconciled BOOLEAN DEFAULT false, -- Depois de executar reconciliação
  
  -- Constraints
  FOREIGN KEY (upload_id) REFERENCES bank_reconciliation_uploads(id) ON DELETE CASCADE,
  FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL,
  FOREIGN KEY (matched_by) REFERENCES users(id) ON DELETE SET NULL,
  
  CONSTRAINT chk_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT chk_match_type CHECK (match_type IN ('automatic', 'manual', 'unmatched'))
);

CREATE INDEX idx_matches_upload_id ON reconciliation_matches(upload_id);
CREATE INDEX idx_matches_bank_transaction_id ON reconciliation_matches(bank_transaction_id);
CREATE INDEX idx_matches_journal_entry_id ON reconciliation_matches(journal_entry_id);
CREATE INDEX idx_matches_confidence ON reconciliation_matches(confidence DESC);
CREATE INDEX idx_matches_is_reconciled ON reconciliation_matches(is_reconciled);

-- =====================================================
-- TABLE: reconciliation_history
-- =====================================================
-- Histórico de reconciliações executadas para auditoria
CREATE TABLE IF NOT EXISTS reconciliation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'accepted', 'rejected', 'auto_reconciled'
  bank_transaction_id UUID NOT NULL,
  journal_entry_id UUID,
  
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_by UUID,
  notes TEXT,
  
  -- Constraints
  FOREIGN KEY (upload_id) REFERENCES bank_reconciliation_uploads(id) ON DELETE CASCADE,
  FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL,
  FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_history_upload_id ON reconciliation_history(upload_id);
CREATE INDEX idx_history_executed_by ON reconciliation_history(executed_by);
CREATE INDEX idx_history_executed_at ON reconciliation_history(executed_at);

-- =====================================================
-- Comentários de documentação (PostgreSQL)
-- =====================================================
COMMENT ON TABLE bank_reconciliation_uploads IS 'Armazena uploads de extratos bancários com status de processamento';
COMMENT ON COLUMN bank_reconciliation_uploads.status IS 'uploaded: arquivo carregado, processed: transações extraídas, reconciled: matching concluído';
COMMENT ON COLUMN bank_reconciliation_uploads.bank_name IS 'Identifica automaticamente o banco (BB, Caixa, Itaú, Bradesco, etc)';

COMMENT ON TABLE bank_transactions IS 'Transações extraídas do arquivo de extrato, normalizadas e estruturadas';
COMMENT ON COLUMN bank_transactions.type IS 'debit: saída de dinheiro, credit: entrada de dinheiro';
COMMENT ON COLUMN bank_transactions.raw_data IS 'Linha original do CSV para rastreabilidade e debugging';

COMMENT ON TABLE reconciliation_matches IS 'Sugestões de matching entre transações bancárias e lançamentos contábeis, com scores de confiança';
COMMENT ON COLUMN reconciliation_matches.confidence IS 'Score 0-1: 0.7-0.85 baixa confiança, 0.85-0.95 média, >0.95 alta (automático)';
COMMENT ON COLUMN reconciliation_matches.match_type IS 'automatic: score >95%, manual: usuário selecionou, unmatched: sem match encontrado';

COMMENT ON TABLE reconciliation_history IS 'Auditoria de todas as ações de reconciliação para rastreabilidade completa';

-- =====================================================
-- Trigger para atualizar processed_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_bank_upload_processed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'processed' AND OLD.status != 'processed' THEN
    NEW.processed_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bank_upload_processed_at
BEFORE UPDATE ON bank_reconciliation_uploads
FOR EACH ROW
EXECUTE FUNCTION update_bank_upload_processed_at();
