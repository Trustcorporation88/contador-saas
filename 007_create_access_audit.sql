-- ============================================================================
-- Migration: 007 - Create Access Audit Table and Add Missing Fields
-- ============================================================================
-- Version: 1.0
-- Date: 2026-05-17
-- Author: Backend Architect
-- Description: Create access_audit table for multi-tenancy logging
--              Add is_active and updated_at fields to company_users
--
-- This migration creates:
-- 1. access_audit table - For logging tenant access and security monitoring
-- 2. Adds missing fields to company_users
--
-- Status: Idempotent (safe to run multiple times)
-- ============================================================================


-- ============================================================================
-- TABLE: access_audit
-- ============================================================================
-- Log de acesso a empresas (multi-tenancy security audit)
-- Registra todos os acessos, negações de acesso, trocas de contexto, etc.
--
-- Campos:
--   - id: Identificador único (UUID)
--   - user_id: Usuário que acessou
--   - company_id: Empresa acessada
--   - action: Tipo de ação (CREATE, UPDATE, DELETE, READ, SWITCH, DENY, etc.)
--   - description: Descrição detalhada da ação
--   - success: Se a ação foi bem-sucedida
--   - ip_address: IP do cliente (para segurança)
--   - user_agent: User agent do navegador
--   - created_at: Timestamp da ação
--
-- Índices:
--   - idx_access_audit_user: Para auditar um usuário específico
--   - idx_access_audit_company: Para auditar uma empresa específica
--   - idx_access_audit_created: Para queries por período de tempo
--   - idx_access_audit_success: Para filtrar apenas sucesso/falha
--
-- Propósito:
--   - Auditoria de segurança (quem acessou o quê)
--   - Detecção de anomalias (muitas denials em pouco tempo)
--   - Compliance (conformidade regulatória)
--   - Investigação forense
--
CREATE TABLE IF NOT EXISTS access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  success BOOLEAN DEFAULT true,
  ip_address INET,
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_action CHECK (
    action IN ('CREATE', 'UPDATE', 'DELETE', 'READ', 'LIST', 'SWITCH', 'DENY', 'EXPORT', 'IMPORT')
  )
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_access_audit_user ON access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_company ON access_audit(company_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_created ON access_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_success ON access_audit(success) WHERE success = false;
CREATE INDEX IF NOT EXISTS idx_access_audit_user_company ON access_audit(user_id, company_id);


-- ============================================================================
-- ADD MISSING FIELDS TO company_users
-- ============================================================================
-- Adiciona is_active e updated_at para suportar soft delete e auditoria

ALTER TABLE IF EXISTS company_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS company_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Index para filtrar usuários ativos na empresa
CREATE INDEX IF NOT EXISTS idx_company_users_active ON company_users(company_id, is_active) 
  WHERE is_active = true;


-- ============================================================================
-- ADD MISSING FIELDS TO companies
-- ============================================================================
-- Adiciona campos opcionais mencionados no DTO

ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS fiscal_year_start JSONB;

-- Index para busca por email (se necessário)
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email) WHERE email IS NOT NULL;


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables Created: 1
--   - access_audit (6 indexes)
--
-- Fields Added: 5
--   - company_users.is_active
--   - company_users.updated_at
--   - companies.phone
--   - companies.email
--   - companies.fiscal_year_start
--
-- Total Indexes: 11 (5 existing + 6 new)
-- ============================================================================
