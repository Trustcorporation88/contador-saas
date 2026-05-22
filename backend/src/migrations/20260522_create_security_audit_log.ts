/**
 * Migration: Create security_audit_log table
 * 
 * Rastreia eventos críticos de segurança para compliance e análise.
 * Complementa audit_logs existente com foco em segurança.
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS security_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(50) NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      ip_address INET,
      user_agent TEXT,
      metadata JSONB,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Índices para queries comuns
    CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_log(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_audit_company ON security_audit_log(company_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_audit_event ON security_audit_log(event_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_log(severity, created_at DESC) WHERE severity IN ('warning', 'critical');
    CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_log(ip_address, created_at DESC);
    
    -- Índice GIN para busca em metadata JSON
    CREATE INDEX IF NOT EXISTS idx_security_audit_metadata ON security_audit_log USING gin(metadata);

    -- Comentários
    COMMENT ON TABLE security_audit_log IS 'Log de eventos críticos de segurança para auditoria e compliance';
    COMMENT ON COLUMN security_audit_log.event_type IS 'Tipo de evento: FAILED_LOGIN, SUCCESSFUL_LOGIN, PASSWORD_CHANGED, etc';
    COMMENT ON COLUMN security_audit_log.severity IS 'Severidade: info, warning, critical';
    COMMENT ON COLUMN security_audit_log.metadata IS 'Dados adicionais do evento em formato JSON';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS security_audit_log CASCADE;
  `);
}
