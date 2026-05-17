-- ============================================================================
-- Migration: 004 - Create Companies, Users, Company_Users, and Cost_Centers
-- ============================================================================
-- Version: 1.0
-- Date: 2026-05-17
-- Author: Backend Architect
-- Description: Multi-tenant structure with user management and RBAC
--
-- This migration creates the core tables for:
-- 1. Companies (tenants)
-- 2. Users (authentication & profiles)
-- 3. Company_Users (multi-tenant mapping with role-based access)
-- 4. Cost_Centers (organizational structure)
--
-- All tables are created with:
-- - Comprehensive validation constraints
-- - Performance indexes
-- - Audit fields (created_at, updated_at)
-- - Foreign key references (commented for later addition in migration 005)
--
-- Status: Idempotent (safe to run multiple times)
-- ============================================================================


-- ============================================================================
-- TABLE: companies
-- ============================================================================
-- Represents companies/tenants in the system
-- Each company is uniquely identified by CNPJ (Brazilian Tax ID)
-- 
-- Fields:
--   - id: UUID primary key (auto-generated)
--   - cnpj: UNIQUE Brazilian Tax ID (14 digits, format: XX.XXX.XXX/XXXX-XX)
--   - name: Company trading name (legal name for tax purposes)
--   - legal_name: Full legal name as registered with IRS
--   - address: Street address
--   - city: City name
--   - state: Brazilian state code (e.g., SP, RJ, MG) - 2 chars, uppercase
--   - zip_code: Postal code (8 digits, format: XXXXX-XXX)
--   - tax_regime: Tax system classification
--     * 'SIMPLE_NATIONAL' - Simples Nacional
--     * 'REAL_PROFIT' - Lucro Real
--     * 'PRESUMED_PROFIT' - Lucro Presumido
--   - fiscal_year_start_month: Month (1-12) when fiscal year begins
--   - fiscal_year_start_day: Day (1-31) when fiscal year begins
--   - is_active: Soft delete flag
--   - created_at: Timestamp of company registration
--   - updated_at: Timestamp of last modification
--   - created_by: FK to users (commented - will be added in migration 005)
--
-- Constraints:
--   - CNPJ format validation (14 digits)
--   - State code validation (2 uppercase letters)
--   - Fiscal year month validation (1-12)
--   - Fiscal year day validation (1-31)
--   - UNIQUE constraint on CNPJ (no duplicate companies)
--
-- Performance Indexes:
--   - idx_companies_cnpj: For quick lookup by CNPJ
--   - idx_companies_state: For filtering by state
--   - idx_companies_created_at: For chronological queries
--   - idx_companies_active: For active company filtering
--
-- Security Considerations:
--   - CNPJ is unique and immutable (business identifier)
--   - created_by will be audited (future: trigger on update)
--   - All company data is scoped to multi-tenant isolation
--
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(8),
  tax_regime VARCHAR(50) NOT NULL,
  fiscal_year_start_month INT DEFAULT 1,
  fiscal_year_start_day INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  -- FOREIGN KEY (created_by) REFERENCES users(id) -- TODO: Add in migration 005

  CONSTRAINT valid_cnpj CHECK (cnpj ~ '^\d{14}$'),
  CONSTRAINT valid_state CHECK (state IS NULL OR state ~ '^[A-Z]{2}$'),
  CONSTRAINT valid_fiscal_month CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  CONSTRAINT valid_fiscal_day CHECK (fiscal_year_start_day BETWEEN 1 AND 31),
  CONSTRAINT valid_tax_regime CHECK (tax_regime IN ('SIMPLE_NATIONAL', 'REAL_PROFIT', 'PRESUMED_PROFIT'))
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_state ON companies(state);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active) WHERE is_active = true;


-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Represents system users (accountants, auditors, administrators)
-- Users can belong to multiple companies via company_users table
--
-- Fields:
--   - id: UUID primary key (auto-generated)
--   - email: UNIQUE email address (used for authentication)
--   - password_hash: Salted & hashed password (bcrypt recommended)
--                    Format: $2b$12$... (bcrypt with 12 rounds)
--                    DO NOT store plain passwords
--   - name: User's full name (display name)
--   - mfa_secret: TOTP secret key (base32 encoded) for MFA
--                 NULL if MFA not enabled
--   - mfa_enabled: Flag to indicate MFA is active
--   - is_active: Soft delete / account deactivation
--   - last_login: Timestamp of last successful authentication
--   - created_at: Account creation timestamp
--   - updated_at: Last profile modification timestamp
--
-- Constraints:
--   - Email format validation (RFC 5322 simplified pattern)
--   - Email is UNIQUE (no duplicate accounts)
--   - password_hash is NOT NULL (mandatory password)
--
-- Performance Indexes:
--   - idx_users_email: For login queries
--   - idx_users_created_at: For user audit trails
--   - idx_users_active: For active user listing
--   - idx_users_last_login: For security monitoring
--
-- Security Considerations:
--   - Password hash is mandatory and must be bcrypt (v2b with 12 rounds)
--   - MFA secret is stored in base32 (RFC 4648) and must be kept secret
--   - last_login can be used to detect account compromise
--   - Email validation prevents common typos
--   - Consider adding password_last_changed timestamp (future)
--
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  mfa_secret VARCHAR(255),
  mfa_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_email CHECK (
    email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
  )
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC) WHERE last_login IS NOT NULL;


-- ============================================================================
-- TABLE: company_users
-- ============================================================================
-- Maps users to companies with role-based access control (RBAC)
-- Implements the multi-tenant user relationship
--
-- Fields:
--   - id: UUID primary key (auto-generated)
--   - company_id: FK to companies (cascade delete)
--   - user_id: FK to users (cascade delete)
--   - role: Role assignment within the company
--     * 'admin': Full access to company data and settings
--     * 'accountant': Read/write to journal entries, accounts, reports
--     * 'viewer': Read-only access to reports and balance sheets
--   - permissions: JSONB store for fine-grained permissions
--     Example:
--     {
--       "journal_entries": {"create": true, "update": true, "delete": false},
--       "accounts": {"create": false, "update": false, "delete": false},
--       "reports": {"view": true, "export": true},
--       "audit": {"view": false}
--     }
--   - created_at: When user was assigned to company
--
-- Constraints:
--   - UNIQUE(company_id, user_id): Each user can have one role per company
--   - UNIQUE(company_id, user_id): Prevents duplicate assignments
--   - Role must be one of: admin, accountant, viewer
--   - ON DELETE CASCADE: Deleting user/company removes mapping
--
-- Performance Indexes:
--   - idx_company_users_company: For "get all users in company"
--   - idx_company_users_user: For "get all companies for user"
--   - idx_company_users_role: For filtering by role
--   - idx_company_users_created_at: For audit trails
--
-- Security Considerations:
--   - Role is mandatory (no default role - explicit assignment required)
--   - JSONB permissions allow future fine-grained access control
--   - Multiple roles not allowed per company (1 user = 1 role per company)
--   - Permissions are evaluated at application level (this table is schema only)
--   - Audit trail via created_at (no update timestamp - immutable until deletion)
--
CREATE TABLE IF NOT EXISTS company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE, -- TODO: 005
  -- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- TODO: 005

  UNIQUE(company_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'accountant', 'viewer'))
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_role ON company_users(company_id, role);
CREATE INDEX IF NOT EXISTS idx_company_users_created_at ON company_users(created_at DESC);


-- ============================================================================
-- TABLE: cost_centers
-- ============================================================================
-- Represents cost centers (departamentos, projetos) within a company
-- Used for allocating journal entries to cost centers for profitability analysis
--
-- Fields:
--   - id: UUID primary key (auto-generated)
--   - company_id: FK to companies (cascade delete)
--   - code: UNIQUE code for cost center (e.g., "CC-001", "DEPT-001")
--   - name: Display name of cost center (e.g., "Marketing", "R&D")
--   - description: Optional detailed description
--   - is_active: Soft delete flag
--   - created_at: When cost center was created
--
-- Constraints:
--   - UNIQUE(company_id, code): Code is unique per company (not global)
--   - code is NOT NULL and UNIQUE
--   - name is NOT NULL
--
-- Performance Indexes:
--   - idx_cost_centers_company: For listing company's cost centers
--   - idx_cost_centers_code: For lookup by code
--   - idx_cost_centers_active: For active cost center filtering
--
-- Security Considerations:
--   - Cost centers are company-scoped (multi-tenant isolated)
--   - Code change is not audited (immutable until deletion)
--   - is_active allows archiving without data loss
--   - No update_at field (treated as immutable, archived via is_active)
--
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE, -- TODO: 005

  UNIQUE(company_id, code)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON cost_centers(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_code ON cost_centers(code);
CREATE INDEX IF NOT EXISTS idx_cost_centers_active ON cost_centers(company_id, is_active) 
  WHERE is_active = true;


-- ============================================================================
-- SUMMARY OF INDEXES
-- ============================================================================
-- Total Indexes Created: 15
--
-- companies (4 indexes):
--   1. idx_companies_cnpj - UNIQUE lookup by CNPJ
--   2. idx_companies_state - Filter by state
--   3. idx_companies_created_at - Chronological queries
--   4. idx_companies_active - Active company listing
--
-- users (4 indexes):
--   5. idx_users_email - UNIQUE login lookup
--   6. idx_users_created_at - User audit trail
--   7. idx_users_active - Active user listing
--   8. idx_users_last_login - Security monitoring
--
-- company_users (4 indexes):
--   9. idx_company_users_company - List users per company
--   10. idx_company_users_user - List companies per user
--   11. idx_company_users_role - Filter by role
--   12. idx_company_users_created_at - Audit trail
--
-- cost_centers (3 indexes):
--   13. idx_cost_centers_company - List cost centers
--   14. idx_cost_centers_code - Code lookup
--   15. idx_cost_centers_active - Active cost centers
--
-- ============================================================================


-- ============================================================================
-- VALIDATION CONSTRAINTS SUMMARY
-- ============================================================================
-- companies:
--   - valid_cnpj: Ensures CNPJ is exactly 14 digits (format: XX.XXX.XXX/XXXX-XX without dots/slashes)
--   - valid_state: Ensures state is 2 uppercase letters (SP, RJ, MG, etc.)
--   - valid_fiscal_month: Ensures month between 1-12
--   - valid_fiscal_day: Ensures day between 1-31
--   - valid_tax_regime: Ensures tax_regime is one of allowed values
--   - UNIQUE(cnpj): No duplicate companies
--
-- users:
--   - valid_email: Ensures email format is valid (basic RFC 5322 check)
--   - UNIQUE(email): No duplicate email addresses
--   - password_hash: NOT NULL (mandatory password)
--
-- company_users:
--   - UNIQUE(company_id, user_id): One role per user per company
--   - valid_role: Role must be admin, accountant, or viewer
--
-- cost_centers:
--   - UNIQUE(code): Global unique code
--   - UNIQUE(company_id, code): Per-company unique code
--
-- ============================================================================


-- ============================================================================
-- NOTES FOR FUTURE MIGRATIONS
-- ============================================================================
-- 1. Foreign Key Addition (Migration 005):
--    - Add FK constraint: company_users.company_id -> companies.id
--    - Add FK constraint: company_users.user_id -> users.id
--    - Add FK constraint: cost_centers.company_id -> companies.id
--    - Add FK constraint: companies.created_by -> users.id
--
-- 2. Triggers (to be added in migration 003_create_audit_triggers.sql):
--    - Auto-update companies.updated_at on every UPDATE
--    - Auto-update users.updated_at on every UPDATE
--    - Audit logging trigger for INSERT/UPDATE/DELETE
--
-- 3. Additional Fields (future enhancements):
--    - users.password_changed_at: For password expiration policies
--    - users.phone: For 2FA via SMS (future)
--    - companies.legal_representative: For legal contract purposes
--    - cost_centers.cost_code_format: For validation rules
--    - cost_centers.manager_id: FK to users (cost center owner)
--
-- 4. Partitioning (for large deployments):
--    - audit_logs partitioned by timestamp (monthly)
--    - journal_entries partitioned by company_id and date range
--
-- ============================================================================
