-- ============================================================================
-- Migration: 001_create_accounts.sql
-- Description: Create Chart of Accounts (Plano de Contas) schema
-- Database: PostgreSQL 14+
-- Author: Backend Architect
-- Date: 2026-05-17
-- ============================================================================

-- Tabela: accounts (Plano de Contas)
-- ============================================================================
-- Descrição: Armazena a estrutura completa do plano de contas para cada empresa.
--            Suporta relacionamentos hierárquicos (parent_id) e classificações 
--            de impostos para fins de apuração.
-- 
-- Campos:
--   - id: Identificador único (UUID)
--   - company_id: Referência à empresa (multi-tenant)
--   - code: Código da conta (ex: 1.1.1, 1.2.3.1) - único por empresa
--   - name: Nome/descrição da conta contábil
--   - type: Classificação contábil (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
--   - parent_id: Referência à conta superior na hierarquia (permite contas compostas)
--   - tax_code: Código de imposto associado (IRPJ, CSLL, PIS, COFINS, ICMS, ISS)
--   - is_analytical: Flag para contas analíticas (sub-detalhamento)
--   - is_active: Flag para desativar contas sem deletar (soft delete)
--   - created_at: Timestamp de criação
--   - updated_at: Timestamp da última alteração
--
-- Constraints:
--   - UNIQUE(company_id, code): Garante códigos únicos por empresa
--   - valid_type CHECK: Valida apenas tipos permitidos de contas
--   - foreign_key company_id: Referência obrigatória à empresa
--   - foreign_key parent_id: Suporta hierarquia de contas (self-reference)
--
-- Índices:
--   - idx_accounts_company: Otimiza queries por empresa
--   - idx_accounts_parent: Otimiza traçado de hierarquias
--   - idx_accounts_type: Otimiza queries por tipo de conta
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  -- Identificadores e Chaves Estrangeiras
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  parent_id UUID,
  
  -- Dados Contábeis
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  tax_code VARCHAR(50),
  
  -- Flags de Status
  is_analytical BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Auditoria Temporal
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints de Integridade
  UNIQUE(company_id, code),
  
  CONSTRAINT valid_type CHECK (
    type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
  ),
  
  CONSTRAINT valid_code CHECK (
    code ~ '^[0-9.]+$' AND char_length(code) >= 1 AND char_length(code) <= 20
  ),
  
  -- Referências para outras tabelas
  -- company_id REFERENCES companies(id) ON DELETE CASCADE
  -- parent_id REFERENCES accounts(id) ON DELETE SET NULL
  
  -- Nota: As constraint de foreign keys serão adicionadas após a tabela companies
  -- estar criada. Use 002_add_foreign_keys.sql ou execute manually:
  -- ALTER TABLE accounts ADD CONSTRAINT fk_accounts_company 
  --   FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  -- ALTER TABLE accounts ADD CONSTRAINT fk_accounts_parent 
  --   FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL;
);

-- Índices para Performance
-- ============================================================================

-- Índice 1: Otimiza queries por empresa
-- Utilizado em: listagem de contas da empresa, validações de código único
CREATE INDEX IF NOT EXISTS idx_accounts_company 
  ON accounts(company_id);

-- Índice 2: Otimiza traçado hierárquico
-- Utilizado em: construção de árvore de contas, validação de ciclos
CREATE INDEX IF NOT EXISTS idx_accounts_parent 
  ON accounts(parent_id);

-- Índice 3: Otimiza filtros por tipo
-- Utilizado em: balanços por tipo de conta, apuração de impostos
CREATE INDEX IF NOT EXISTS idx_accounts_type 
  ON accounts(type);

-- Índice Composto 4: Otimiza queries comuns (company + type)
-- Utilizado em: demonstrações financeiras por tipo
CREATE INDEX IF NOT EXISTS idx_accounts_company_type 
  ON accounts(company_id, type);

-- Índice Composto 5: Otimiza queries de impostos
-- Utilizado em: cálculo de apuração de impostos
CREATE INDEX IF NOT EXISTS idx_accounts_tax_code 
  ON accounts(company_id, tax_code) WHERE tax_code IS NOT NULL;

-- Índice 6: Otimiza soft-delete e queries ativas
-- Utilizado em: listagem de contas ativas
CREATE INDEX IF NOT EXISTS idx_accounts_active 
  ON accounts(company_id, is_active) WHERE is_active = true;

-- ============================================================================
-- Histórico de Migrações
-- ============================================================================
-- 2026-05-17: Criação inicial da tabela accounts conforme seção 2.5 
--             da arquitetura técnica. Suporta multi-tenant, hierarquia 
--             de contas e classificações de impostos.
-- ============================================================================

-- Próximas Etapas:
-- 1. Criar tabela companies (se não existir)
-- 2. Adicionar foreign keys após companies estar criada
-- 3. Inserir plano de contas padrão (task 1.8)
-- 4. Validar integridade referencial

-- ============================================================================
-- Exemplo de Uso (após foreign keys):
-- ============================================================================
-- 
-- -- Inserir conta raiz (Ativo)
-- INSERT INTO accounts (company_id, code, name, type, is_analytical, is_active)
-- VALUES (
--   'uuid-company-1',
--   '1',
--   'Ativo',
--   'ASSET',
--   false,
--   true
-- );
-- 
-- -- Inserir sub-conta (Ativo Circulante)
-- INSERT INTO accounts (company_id, code, name, type, parent_id, is_analytical, is_active)
-- SELECT 
--   'uuid-company-1',
--   '1.1',
--   'Ativo Circulante',
--   'ASSET',
--   id,
--   false,
--   true
-- FROM accounts
-- WHERE company_id = 'uuid-company-1' AND code = '1';
-- 
-- -- Inserir conta com imposto
-- INSERT INTO accounts (company_id, code, name, type, tax_code, is_active)
-- VALUES (
--   'uuid-company-1',
--   '5.1.1',
--   'IRPJ a Recuperar',
--   'ASSET',
--   'IRPJ',
--   true
-- );
--
-- ============================================================================
