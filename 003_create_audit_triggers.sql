-- ============================================================================
-- Migration: 003_create_audit_triggers.sql
-- Description: Create Audit Logs table and automatic audit triggers
-- Database: PostgreSQL 14+
-- Author: Backend Architect
-- Date: 2026-05-17
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- Tabela: audit_logs (Log de Auditoria)
-- ============================================================================
-- Descrição: Armazena um registro de auditoria completo de todas as operações
--            (CREATE, UPDATE, DELETE) em entidades críticas do sistema.
--            Fornece rastreabilidade completa para conformidade regulatória
--            (lei 6.404/76, obrigações fiscais, etc).
--
-- Campos:
--   - id: Identificador único do log (UUID)
--   - user_id: Usuário que executou a ação (pode ser NULL para ações do sistema)
--   - action: Tipo de ação (CREATE, UPDATE, DELETE, LOGIN, EXPORT, etc)
--   - entity_type: Tipo de entidade afetada (JOURNAL_ENTRY, ACCOUNT, COMPANY, etc)
--   - entity_id: ID da entidade afetada
--   - old_value: JSON com valores anteriores (antes da alteração)
--   - new_value: JSON com valores novos (depois da alteração)
--   - ip_address: Endereço IP do cliente (INET type para validação)
--   - user_agent: Identificação do navegador/cliente
--   - timestamp: Data/hora exata da operação (CURRENT_TIMESTAMP)
--   - status: Sucesso ou falha da operação (SUCCESS, FAILURE)
--
-- Constraints:
--   - action NOT NULL: Sempre deve ter um tipo de ação
--   - Foreign Key: user_id -> users.id (pode ser NULL)
--
-- Índices:
--   - idx_audit_logs_user: Otimiza queries por usuário
--   - idx_audit_logs_timestamp: Otimiza queries por data/período
--   - idx_audit_logs_action: Otimiza filtros por tipo de ação
--   - idx_audit_logs_entity: Otimiza buscas por entidade (tipo + id)
--
-- Propósito:
--   - Conformidade legal: Lei 6.404/76 (escrituração obrigatória)
--   - Auditoria interna: Rastreamento de quem fez o quê e quando
--   - Análise forense: Investigação de discrepâncias contábeis
--   - Compliance: LGPD, requisitos de retenção de dados
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  -- Identificadores e Chaves Estrangeiras
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Pode ser NULL para ações do sistema
  
  -- Tipo de Ação
  action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT'
  
  -- Entidade Afetada
  entity_type VARCHAR(50), -- 'JOURNAL_ENTRY', 'ACCOUNT', 'COMPANY', 'USER', etc
  entity_id UUID,
  
  -- Valores Anteriores e Novos
  old_value JSONB,
  new_value JSONB,
  
  -- Contexto de Execução
  ip_address INET,
  user_agent VARCHAR(500),
  
  -- Status da Operação
  status VARCHAR(20) DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILURE'
  
  -- Timestamp da Operação
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints de Validação
  CONSTRAINT valid_action CHECK (
    action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 
               'IMPORT', 'RECONCILE', 'APPROVE', 'REJECT')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('SUCCESS', 'FAILURE')
  )
  
  -- Referências para outras tabelas
  -- user_id REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para Performance
-- ============================================================================

-- Índice 1: Otimiza queries por usuário
-- Utilizado em: auditoria de um usuário específico, investigação forense
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON audit_logs(user_id) WHERE user_id IS NOT NULL;

-- Índice 2: Otimiza queries por timestamp
-- Utilizado em: busca de operações em período específico, relatórios de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
  ON audit_logs(timestamp DESC);

-- Índice 3: Otimiza queries por tipo de ação
-- Utilizado em: busca de CREATE, UPDATE, DELETE específicas
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);

-- Índice 4: Otimiza queries por entidade
-- Utilizado em: histórico de mudanças de uma entidade específica
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- Índice Composto 5: Otimiza queries de auditoria por usuário e data
-- Utilizado em: relatório de atividade de usuário por período
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp
  ON audit_logs(user_id, timestamp DESC) WHERE user_id IS NOT NULL;

-- Índice Composto 6: Otimiza queries por status
-- Utilizado em: busca de operações falhadas para investigação
CREATE INDEX IF NOT EXISTS idx_audit_logs_status_timestamp
  ON audit_logs(status, timestamp DESC);


-- ============================================================================
-- FUNÇÕES DE TRIGGER PARA AUDITORIA
-- ============================================================================

-- ============================================================================
-- Função 1: log_changes() - Log genérico de INSERT/UPDATE/DELETE
-- ============================================================================
-- Descrição: Função genérica que captura qualquer inserção, alteração ou
--            deleção em uma tabela e cria automaticamente um registro em
--            audit_logs. Usa informações do PostgreSQL (TG_OPERATION, 
--            TG_TABLE_NAME) para identificar a entidade e tipo de ação.
--
-- Comportamento:
--   - INSERT: Registra action='CREATE' com new_value apenas
--   - UPDATE: Registra action='UPDATE' com old_value e new_value
--   - DELETE: Registra action='DELETE' com old_value apenas
--
-- Retorno: NEW para INSERT/UPDATE, OLD para DELETE (conforme PostgreSQL TRIGGER)
--
-- Nota: Esta função será usado por múltiplos triggers diferentes.
--
-- ============================================================================

CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, new_value, status)
    VALUES ('CREATE', TG_TABLE_NAME::VARCHAR(50), NEW.id, row_to_json(NEW), 'SUCCESS');
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_value, new_value, status)
    VALUES ('UPDATE', TG_TABLE_NAME::VARCHAR(50), NEW.id, row_to_json(OLD), row_to_json(NEW), 'SUCCESS');
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_value, status)
    VALUES ('DELETE', TG_TABLE_NAME::VARCHAR(50), OLD.id, row_to_json(OLD), 'SUCCESS');
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Função 2: log_journal_changes() - Log específico para journal_entries
-- ============================================================================
-- Descrição: Função especializada para lançamentos contábeis que além de
--            registrar a mudança, também validação de partidas dobradas
--            e integridade do hash de assinatura digital.
--
-- Comportamento:
--   - INSERT: Valida que debito = credito antes de criar log
--   - UPDATE: Valida novos valores e registra mudança de hash
--   - DELETE: Registra deleção (soft delete via is_deleted é melhor)
--
-- ============================================================================

CREATE OR REPLACE FUNCTION log_journal_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Validação de partidas dobradas
    IF ABS(NEW.total_debit - NEW.total_credit) >= 0.01 THEN
      INSERT INTO audit_logs (action, entity_type, entity_id, new_value, status)
      VALUES ('CREATE', 'JOURNAL_ENTRY', NEW.id, row_to_json(NEW), 'FAILURE');
      RAISE EXCEPTION 'Journal entry must be balanced (debit = credit)';
    END IF;
    
    INSERT INTO audit_logs (action, entity_type, entity_id, new_value, status)
    VALUES ('CREATE', 'JOURNAL_ENTRY', NEW.id, row_to_json(NEW), 'SUCCESS');
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Validação de partidas dobradas
    IF ABS(NEW.total_debit - NEW.total_credit) >= 0.01 THEN
      INSERT INTO audit_logs (action, entity_type, entity_id, old_value, new_value, status)
      VALUES ('UPDATE', 'JOURNAL_ENTRY', NEW.id, row_to_json(OLD), row_to_json(NEW), 'FAILURE');
      RAISE EXCEPTION 'Journal entry must be balanced (debit = credit)';
    END IF;
    
    INSERT INTO audit_logs (action, entity_type, entity_id, old_value, new_value, status)
    VALUES ('UPDATE', 'JOURNAL_ENTRY', NEW.id, row_to_json(OLD), row_to_json(NEW), 'SUCCESS');
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_value, status)
    VALUES ('DELETE', 'JOURNAL_ENTRY', OLD.id, row_to_json(OLD), 'SUCCESS');
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Função 3: validate_journal_balance() - Validação de partidas dobradas
-- ============================================================================
-- Descrição: Função BEFORE trigger que valida a regra fundamental da
--            contabilidade: débito = crédito. É executada ANTES de inserir
--            ou atualizar um lançamento.
--
-- Comportamento:
--   - Calcula ABS(total_debit - total_credit)
--   - Se diferença > 0.01 (1 centavo), lança exceção
--   - Se OK, permite operação prosseguir
--
-- Nota: Esta é um BEFORE trigger, portanto bloqueia a operação antes
--       que ela afete o banco. O log_journal_changes() registra a falha.
--
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Validação rigorosa: ABS(debito - credito) deve ser < 0.01
  IF ABS(NEW.total_debit - NEW.total_credit) >= 0.01 THEN
    RAISE EXCEPTION 'Journal entry unbalanced: debit(%) <> credit(%)',
      NEW.total_debit, NEW.total_credit;
  END IF;
  
  -- Retorna NEW para prosseguir com INSERT/UPDATE
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Função 4: update_timestamp() - Atualiza updated_at automaticamente
-- ============================================================================
-- Descrição: Função para atualizar o campo updated_at com o timestamp
--            atual sempre que um registro é modificado. Economiza código
--            e garante consistência.
--
-- Nota: Pode ser usada em qualquer tabela que tenha campo updated_at
--
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ============================================================================

-- ============================================================================
-- Trigger 1: audit_accounts - Log de mudanças em accounts
-- ============================================================================
-- Tabela: accounts
-- Evento: AFTER INSERT OR UPDATE OR DELETE
-- Função: log_changes()
-- Escopo: Todos os registros
--
-- Efeito: Toda mudança em contas contábeis é registrada em audit_logs
--
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW
EXECUTE FUNCTION log_changes();


-- ============================================================================
-- Trigger 2: audit_journal_entries - Log de mudanças em journal_entries
-- ============================================================================
-- Tabela: journal_entries
-- Evento: AFTER INSERT OR UPDATE OR DELETE
-- Função: log_journal_changes()
-- Escopo: Todos os registros
--
-- Efeito: Toda mudança em lançamentos é registrada em audit_logs com
--         validação adicional de partidas dobradas
--
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_audit_journal_entries
AFTER INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION log_journal_changes();


-- ============================================================================
-- Trigger 3: validate_journal_entries - Validação de partidas dobradas
-- ============================================================================
-- Tabela: journal_entries
-- Evento: BEFORE INSERT OR UPDATE
-- Função: validate_journal_balance()
-- Escopo: Todos os registros
--
-- Efeito: Bloqueia inserção/atualização de lançamentos não-balanceados
--         antes que afetem o banco de dados
--
-- Ordem: Este trigger é executado ANTES de trigger_audit_journal_entries
--
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_validate_journal_entries
BEFORE INSERT OR UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION validate_journal_balance();


-- ============================================================================
-- Trigger 4: audit_journal_lines - Log de mudanças em journal_lines
-- ============================================================================
-- Tabela: journal_lines
-- Evento: AFTER INSERT OR UPDATE OR DELETE
-- Função: log_changes()
-- Escopo: Todos os registros
--
-- Efeito: Toda mudança em linhas de lançamento é registrada
--
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_audit_journal_lines
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION log_changes();


-- ============================================================================
-- Trigger 5: audit_documents - Log de mudanças em documents
-- ============================================================================
-- Tabela: documents
-- Evento: AFTER INSERT OR UPDATE OR DELETE
-- Função: log_changes()
-- Escopo: Todos os registros
--
-- Efeito: Toda mudança em documentos é registrada
--
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_audit_documents
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW
EXECUTE FUNCTION log_changes();


-- ============================================================================
-- Trigger 6: update_journal_entries_timestamp - Atualiza updated_at
-- ============================================================================
-- Tabela: journal_entries
-- Evento: BEFORE UPDATE
-- Função: update_timestamp()
-- Escopo: Todos os registros
--
-- Efeito: Campo updated_at é automaticamente atualizado ao modificar registro
--
-- Ordem: Executado junto com validate_journal_entries
--
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_update_journal_entries_timestamp
BEFORE UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();


-- ============================================================================
-- Trigger 7: update_accounts_timestamp - Atualiza updated_at em accounts
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_update_accounts_timestamp
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();


-- ============================================================================
-- Histórico de Migrações
-- ============================================================================
-- 2026-05-17: Criação inicial de audit_logs e triggers conforme seção 2.10
--             e 2.14 da arquitetura técnica:
--             - Tabela audit_logs com campos completos
--             - 4 funções de trigger (log_changes, log_journal_changes, 
--               validate_journal_balance, update_timestamp)
--             - 7 triggers para auditoria automática
--             - Validação de partidas dobradas integrada
-- ============================================================================


-- ============================================================================
-- Próximas Etapas:
-- ============================================================================
-- 1. Executar 001_create_accounts.sql
-- 2. Executar 002_create_journal_tables.sql
-- 3. Este arquivo (003_create_audit_triggers.sql)
-- 4. Adicionar foreign keys após todas as tabelas estarem criadas
-- 5. Testar triggers com inserts de teste
--
-- Comando para adicionar foreign key (execute após tabela users):
-- ============================================================================
-- 
-- ALTER TABLE audit_logs 
--   ADD CONSTRAINT fk_audit_logs_user 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
--
-- ============================================================================

-- ============================================================================
-- Testes Recomendados
-- ============================================================================
--
-- -- Teste 1: Inserir lançamento balanceado (deve SUCCESS)
-- BEGIN;
-- INSERT INTO journal_entries 
-- (company_id, entry_date, description, created_by, total_debit, total_credit)
-- VALUES ('uuid-company', '2026-05-15', 'Test', 'uuid-user', 100.00, 100.00);
-- ROLLBACK;
--
-- -- Teste 2: Tentar inserir lançamento desbalanceado (deve FAIL)
-- BEGIN;
-- INSERT INTO journal_entries 
-- (company_id, entry_date, description, created_by, total_debit, total_credit)
-- VALUES ('uuid-company', '2026-05-15', 'Test', 'uuid-user', 100.00, 50.00);
-- -- Esperado: Error "Journal entry unbalanced: debit(100) <> credit(50)"
-- ROLLBACK;
--
-- -- Teste 3: Verificar audit log foi criado
-- SELECT * FROM audit_logs WHERE entity_type = 'JOURNAL_ENTRY' LIMIT 1;
--
-- -- Teste 4: Verificar tipo de ação registrada
-- SELECT DISTINCT action FROM audit_logs;
--
-- ============================================================================

-- ============================================================================
-- Consultas Úteis para Auditoria
-- ============================================================================
--
-- -- Buscar todos os lançamentos criados por um usuário
-- SELECT je.id, je.entry_date, je.description, al.timestamp
-- FROM journal_entries je
-- JOIN audit_logs al ON al.entity_id = je.id AND al.action = 'CREATE'
-- WHERE al.user_id = 'uuid-user'
-- ORDER BY al.timestamp DESC;
--
-- -- Buscar histórico completo de alterações de um lançamento
-- SELECT 
--   al.action, 
--   al.old_value->>'total_debit' as old_debit,
--   al.new_value->>'total_debit' as new_debit,
--   al.timestamp,
--   al.status
-- FROM audit_logs al
-- WHERE al.entity_type = 'JOURNAL_ENTRY' AND al.entity_id = 'uuid-entry'
-- ORDER BY al.timestamp;
--
-- -- Buscar operações falhadas (unbalanced entries)
-- SELECT * FROM audit_logs 
-- WHERE entity_type = 'JOURNAL_ENTRY' AND status = 'FAILURE'
-- ORDER BY timestamp DESC
-- LIMIT 10;
--
-- -- Relatório de atividade por usuário (últimos 7 dias)
-- SELECT 
--   user_id,
--   action,
--   COUNT(*) as count,
--   MAX(timestamp) as last_action
-- FROM audit_logs
-- WHERE timestamp > NOW() - INTERVAL '7 days'
-- GROUP BY user_id, action
-- ORDER BY MAX(timestamp) DESC;
--
-- ============================================================================
