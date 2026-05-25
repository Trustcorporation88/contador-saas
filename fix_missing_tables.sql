-- ============================================================================
-- CORREÇÕES DE SCHEMA — O Contador
-- Renomeia journal_items → journal_lines, cria audit_logs, tax_calculations
-- ============================================================================

-- 1. journal_lines (renomeia journal_items e adiciona colunas faltantes)
-- ============================================================================
ALTER TABLE journal_items
  ADD COLUMN IF NOT EXISTS cost_center_id UUID,
  ADD COLUMN IF NOT EXISTS line_number     INT;

-- Preenche line_number sequencial por entry (retroativo)
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY journal_entry_id ORDER BY created_at) AS rn
  FROM journal_items
)
UPDATE journal_items ji
SET line_number = n.rn
FROM numbered n
WHERE ji.id = n.id AND ji.line_number IS NULL;

ALTER TABLE journal_items RENAME TO journal_lines;

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry
  ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account
  ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_entry
  ON journal_lines(account_id, journal_entry_id);

-- 2. audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  status      VARCHAR(20) DEFAULT 'SUCCESS',
  ip_address  VARCHAR(50),
  user_agent  VARCHAR(500),
  timestamp   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user      ON audit_logs(user_id)  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs(entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- 3. security_audit_log (usada pelo securityAuditService)
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  user_id    UUID,
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  details    JSONB,
  severity   VARCHAR(20) DEFAULT 'INFO',
  timestamp  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_audit_event     ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_user      ON security_audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_log(timestamp DESC);

-- 4. tax_calculations (usada pelo taxController)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tax_calculations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  tax_type          VARCHAR(50) NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  calculated_amount NUMERIC(18,2) DEFAULT 0,
  status            VARCHAR(20) DEFAULT 'PENDING',
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, tax_type, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_company ON tax_calculations(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_period  ON tax_calculations(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_status  ON tax_calculations(status);

SELECT 'Schema corrigido com sucesso!' AS resultado;
