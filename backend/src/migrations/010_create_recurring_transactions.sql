/**
 * Migration: Create Recurring Transactions Tables
 * Criação de tabelas para lançamentos recorrentes automáticos
 * Lei 6.404/76 - Contabilidade com auditoria e histórico completo
 */

-- Tabela de templates de lançamentos recorrentes
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  debit_account_id UUID NOT NULL REFERENCES accounts(id),
  credit_account_id UUID NOT NULL REFERENCES accounts(id),
  frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('DIARIO', 'MENSAL', 'ANUAL')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  next_execution_date DATE,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Validações
  CONSTRAINT valid_date_range CHECK (start_date <= end_date OR end_date IS NULL),
  CONSTRAINT different_accounts CHECK (debit_account_id != credit_account_id)
);

-- Índices para performance
CREATE INDEX idx_recurring_company_active ON recurring_transactions(company_id, is_active);
CREATE INDEX idx_recurring_next_execution ON recurring_transactions(next_execution_date, is_active);
CREATE INDEX idx_recurring_frequency ON recurring_transactions(frequency);

-- Tabela de histórico de execuções
CREATE TABLE IF NOT EXISTS recurring_transaction_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_transaction_id UUID NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
  execution_date DATE NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Auditoria
  CONSTRAINT execution_success_needs_entry CHECK (
    (status = 'success' AND journal_entry_id IS NOT NULL) OR 
    (status != 'success')
  )
);

-- Índices para performance
CREATE INDEX idx_execution_recurring_id ON recurring_transaction_executions(recurring_transaction_id);
CREATE INDEX idx_execution_status ON recurring_transaction_executions(status);
CREATE INDEX idx_execution_date ON recurring_transaction_executions(execution_date);
CREATE INDEX idx_execution_created_at ON recurring_transaction_executions(created_at);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_recurring_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_transactions_updated_at
BEFORE UPDATE ON recurring_transactions
FOR EACH ROW
EXECUTE FUNCTION update_recurring_transactions_timestamp();
