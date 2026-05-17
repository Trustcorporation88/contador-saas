# 🏗️ Arquitetura Técnica - Aplicativo de Contador Comercial Brasileiro

**Documento**: ARQUITETURA-TECNICA.md  
**Versão**: 1.0  
**Data**: 2026-05-17  
**Status**: Especificação Técnica Completa

---

## 1. Estrutura de Pastas & Projeto

```
contador-app/
├── backend/                          # Node.js/Express API
│   ├── src/
│   │   ├── server.ts                # Entry point
│   │   ├── app.ts                   # Express app config
│   │   ├── config/                  # Environment configs
│   │   ├── middleware/              # Auth, logging, error handling
│   │   ├── routes/                  # API routes (v1/)
│   │   │   ├── auth.routes.ts
│   │   │   ├── companies.routes.ts
│   │   │   ├── accounts.routes.ts
│   │   │   ├── journal-entries.routes.ts
│   │   │   ├── reports.routes.ts
│   │   │   ├── taxes.routes.ts
│   │   │   └── audit.routes.ts
│   │   ├── controllers/             # Request handlers
│   │   │   ├── AuthController.ts
│   │   │   ├── CompanyController.ts
│   │   │   ├── AccountController.ts
│   │   │   ├── JournalController.ts
│   │   │   ├── ReportController.ts
│   │   │   ├── TaxController.ts
│   │   │   └── AuditController.ts
│   │   ├── services/                # Business logic
│   │   │   ├── AuthService.ts
│   │   │   ├── CompanyService.ts
│   │   │   ├── AccountService.ts
│   │   │   ├── JournalService.ts
│   │   │   ├── ReportService.ts
│   │   │   ├── TaxService.ts
│   │   │   ├── AuditService.ts
│   │   │   ├── ExportService.ts
│   │   │   ├── SefazService.ts
│   │   │   └── BackupService.ts
│   │   ├── repositories/            # Database access
│   │   │   ├── CompanyRepository.ts
│   │   │   ├── AccountRepository.ts
│   │   │   ├── JournalRepository.ts
│   │   │   ├── UserRepository.ts
│   │   │   ├── AuditRepository.ts
│   │   │   └── TaxRepository.ts
│   │   ├── models/                  # TypeScript types & interfaces
│   │   │   ├── Company.ts
│   │   │   ├── Account.ts
│   │   │   ├── JournalEntry.ts
│   │   │   ├── User.ts
│   │   │   ├── TaxCalculation.ts
│   │   │   ├── Audit.ts
│   │   │   └── types.ts             # Global types
│   │   ├── utils/                   # Helper functions
│   │   │   ├── validators.ts        # Input validation rules
│   │   │   ├── formatters.ts        # Data formatting
│   │   │   ├── calculations.ts      # Tax calculations
│   │   │   ├── encryptors.ts        # Crypto operations
│   │   │   └── logger.ts            # Logging utility
│   │   ├── queue/                   # Background jobs
│   │   │   ├── processors/
│   │   │   │   ├── BackupProcessor.ts
│   │   │   │   ├── ExportProcessor.ts
│   │   │   │   └── NotificationProcessor.ts
│   │   │   └── Queue.ts
│   │   ├── database/                # Database configuration
│   │   │   ├── connection.ts
│   │   │   └── migrations/
│   │   │       ├── 001_create_companies.sql
│   │   │       ├── 002_create_accounts.sql
│   │   │       ├── 003_create_journal_entries.sql
│   │   │       ├── 004_create_users.sql
│   │   │       ├── 005_create_audit_logs.sql
│   │   │       ├── 006_create_tax_calculations.sql
│   │   │       └── 007_create_triggers.sql
│   │   └── errors/                  # Custom exceptions
│   │       ├── AppError.ts
│   │       ├── ValidationError.ts
│   │       ├── AuthenticationError.ts
│   │       └── AuthorizationError.ts
│   ├── tests/                       # Jest tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend-web/                    # React + Electron
│   ├── public/
│   ├── src/
│   │   ├── index.tsx                # React entry point
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── common/              # Reusable UI components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Form.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Alert.tsx
│   │   │   ├── layout/              # Layout components
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   └── AuthLayout.tsx
│   │   │   └── features/            # Feature-specific components
│   │   │       ├── auth/
│   │   │       ├── companies/
│   │   │       ├── accounts/
│   │   │       ├── journals/
│   │   │       ├── reports/
│   │   │       ├── taxes/
│   │   │       └── audit/
│   │   ├── pages/                   # Page components
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── CompaniesPage.tsx
│   │   │   ├── AccountsPage.tsx
│   │   │   ├── JournalPage.tsx
│   │   │   ├── BalanceSheetPage.tsx
│   │   │   ├── IncomePage.tsx
│   │   │   ├── TaxPage.tsx
│   │   │   └── AuditPage.tsx
│   │   ├── store/                   # Redux/Zustand state
│   │   │   ├── store.ts
│   │   │   ├── slices/
│   │   │   │   ├── authSlice.ts
│   │   │   │   ├── companySlice.ts
│   │   │   │   ├── journalSlice.ts
│   │   │   │   └── uiSlice.ts
│   │   │   └── hooks.ts
│   │   ├── services/                # API client service
│   │   │   ├── api.ts               # Axios instance
│   │   │   ├── AuthService.ts
│   │   │   ├── CompanyService.ts
│   │   │   ├── JournalService.ts
│   │   │   ├── ReportService.ts
│   │   │   └── TaxService.ts
│   │   ├── hooks/                   # React custom hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useCompany.ts
│   │   │   ├── useForm.ts
│   │   │   └── useFetch.ts
│   │   ├── utils/                   # Frontend utilities
│   │   │   ├── validators.ts
│   │   │   ├── formatters.ts
│   │   │   ├── date-utils.ts
│   │   │   └── constants.ts
│   │   ├── types/                   # TypeScript types
│   │   │   └── index.ts
│   │   └── styles/                  # Global styles
│   │       ├── index.css
│   │       └── tailwind.css
│   ├── electron/                    # Electron main process
│   │   ├── main.ts
│   │   ├── preload.ts               # Preload scripts for security
│   │   └── menu.ts
│   ├── tests/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── frontend-mobile/                 # React Native
│   ├── app.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── navigation/
│   │   │   ├── RootNavigator.tsx
│   │   │   ├── TabNavigator.tsx
│   │   │   └── AuthNavigator.tsx
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   ├── home/
│   │   │   ├── journal/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   └── features/
│   │   ├── store/                   # Redux for mobile
│   │   │   ├── store.ts
│   │   │   └── slices/
│   │   ├── services/
│   │   │   ├── api.ts               # Axios instance
│   │   │   └── StorageService.ts    # SQLite + AsyncStorage
│   │   ├── utils/
│   │   ├── types/
│   │   └── styles/
│   ├── app.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── shared/                          # Shared code
│   ├── types/
│   │   └── api.ts                   # Shared API types
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   └── package.json
│
├── docs/
│   ├── API.md                       # API documentation
│   ├── SETUP.md                     # Installation guide
│   ├── CONTRIBUTING.md
│   └── ARCHITECTURE.md
│
├── docker-compose.yml               # Local development
├── .gitignore
├── .github/
│   └── workflows/                   # GitHub Actions CI/CD
│       ├── backend-tests.yml
│       ├── frontend-tests.yml
│       ├── build.yml
│       └── deploy.yml
├── README.md
└── package.json                     # Monorepo root (Lerna/Yarn Workspaces)
```

---

## 2. Schema PostgreSQL Detalhado

### 2.1 Tabela: `companies`
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(8),
  tax_regime VARCHAR(50) NOT NULL, -- 'SIMPLE_NATIONAL', 'REAL_PROFIT', 'PRESUMED_PROFIT'
  fiscal_year_start_month INT DEFAULT 1, -- 1-12
  fiscal_year_start_day INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT valid_cnpj CHECK (cnpj ~ '^\d{14}$'),
  CONSTRAINT valid_state CHECK (state ~ '^[A-Z]{2}$'),
  CONSTRAINT valid_fiscal_month CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  CONSTRAINT valid_fiscal_day CHECK (fiscal_year_start_day BETWEEN 1 AND 31)
);

CREATE INDEX idx_companies_cnpj ON companies(cnpj);
CREATE INDEX idx_companies_created_at ON companies(created_at);
```

### 2.2 Tabela: `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  mfa_secret VARCHAR(255), -- TOTP secret (base32 encoded)
  mfa_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
```

### 2.3 Tabela: `company_users`
```sql
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'admin', 'accountant', 'viewer'
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'accountant', 'viewer'))
);

CREATE INDEX idx_company_users_company ON company_users(company_id);
CREATE INDEX idx_company_users_user ON company_users(user_id);
```

### 2.4 Tabela: `cost_centers`
```sql
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, code)
);

CREATE INDEX idx_cost_centers_company ON cost_centers(company_id);
```

### 2.5 Tabela: `accounts` (Plano de Contas)
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
  parent_id UUID REFERENCES accounts(id),
  tax_code VARCHAR(50), -- 'IRPJ', 'CSLL', 'PIS', 'COFINS', 'ICMS', 'ISS', etc
  is_analytical BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, code),
  CONSTRAINT valid_type CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'))
);

CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);
CREATE INDEX idx_accounts_type ON accounts(type);
```

### 2.6 Tabela: `journal_entries`
```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  description VARCHAR(500),
  reference_type VARCHAR(50), -- 'NF', 'RPA', 'CHEQUE', 'BOLETO', 'MANUAL'
  reference_number VARCHAR(50),
  reference_issuer VARCHAR(255),
  total_debit NUMERIC(18,2) DEFAULT 0,
  total_credit NUMERIC(18,2) DEFAULT 0,
  is_posted BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_hash VARCHAR(64), -- SHA-256 hash for audit trail
  
  CONSTRAINT valid_debit_credit CHECK (total_debit >= 0 AND total_credit >= 0),
  CONSTRAINT balanced CHECK (ABS(total_debit - total_credit) < 0.01)
);

CREATE INDEX idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_posted ON journal_entries(is_posted);
CREATE INDEX idx_journal_entries_hash ON journal_entries(data_hash);
```

### 2.7 Tabela: `journal_lines`
```sql
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  debit NUMERIC(18,2) DEFAULT 0,
  credit NUMERIC(18,2) DEFAULT 0,
  description VARCHAR(500),
  line_number INT NOT NULL,
  
  CONSTRAINT valid_debit_credit CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT not_both_zero CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_cost_center ON journal_lines(cost_center_id);
```

### 2.8 Tabela: `documents`
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- 'NF', 'RPA', 'CHEQUE', 'BOLETO', 'INVOICE'
  document_number VARCHAR(50),
  issuer VARCHAR(255),
  issue_date DATE,
  amount NUMERIC(18,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_entry ON documents(journal_entry_id);
CREATE INDEX idx_documents_number ON documents(document_number);
```

### 2.9 Tabela: `attachments`
```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50), -- 'pdf', 'jpg', 'png'
  file_size INT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) -- SHA-256 for integrity
);

CREATE INDEX idx_attachments_document ON attachments(document_id);
```

### 2.10 Tabela: `audit_logs`
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT'
  entity_type VARCHAR(50), -- 'JOURNAL_ENTRY', 'ACCOUNT', 'COMPANY', etc
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent VARCHAR(500),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) -- 'SUCCESS', 'FAILURE'
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

### 2.11 Tabela: `tax_calculations`
```sql
CREATE TABLE tax_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_type VARCHAR(50) NOT NULL, -- 'IRPJ', 'CSLL', 'PIS', 'COFINS', 'ICMS', 'ISS'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  calculated_amount NUMERIC(18,2),
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'FILED'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, tax_type, period_start, period_end)
);

CREATE INDEX idx_tax_calculations_company ON tax_calculations(company_id);
CREATE INDEX idx_tax_calculations_period ON tax_calculations(period_start, period_end);
```

### 2.12 Tabela: `tax_adjustments`
```sql
CREATE TABLE tax_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_calculation_id UUID NOT NULL REFERENCES tax_calculations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  adjustment_type VARCHAR(50), -- 'ADDITION', 'EXCLUSION'
  amount NUMERIC(18,2),
  justification TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tax_adjustments_calculation ON tax_adjustments(tax_calculation_id);
```

### 2.13 Tabela: `provisional_balances`
```sql
CREATE TABLE provisional_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  balance_date DATE NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  balance_type VARCHAR(20), -- 'DEBIT', 'CREDIT'
  amount NUMERIC(18,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(balance_date, account_id),
  CONSTRAINT valid_balance_type CHECK (balance_type IN ('DEBIT', 'CREDIT'))
);

CREATE INDEX idx_provisional_balances_company ON provisional_balances(company_id);
CREATE INDEX idx_provisional_balances_date ON provisional_balances(balance_date);
```

### 2.14 Triggers para Integridade

```sql
-- Trigger 1: Auto-update da tabela companies (updated_at)
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION update_companies_updated_at();

-- Trigger 2: Validação de partidas dobradas
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.total_debit - NEW.total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry must be balanced (debit = credit)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_journal
BEFORE INSERT OR UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION validate_journal_balance();

-- Trigger 3: Log automático de alterações (auditoria)
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, new_value)
    VALUES ('CREATE', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_value, new_value)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, old_value)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW
EXECUTE FUNCTION log_changes();

CREATE TRIGGER trigger_audit_journal
AFTER INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION log_changes();
```

### 2.15 ER Diagram (Mermaid)

```mermaid
erDiagram
    COMPANIES ||--o{ USERS : "has many"
    COMPANIES ||--o{ ACCOUNTS : "has many"
    COMPANIES ||--o{ JOURNAL_ENTRIES : "has many"
    COMPANIES ||--o{ COST_CENTERS : "has many"
    COMPANIES ||--o{ TAX_CALCULATIONS : "has many"
    
    USERS ||--o{ COMPANY_USERS : "through"
    USERS ||--o{ JOURNAL_ENTRIES : "created_by"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    
    ACCOUNTS ||--o{ JOURNAL_LINES : "contains"
    ACCOUNTS ||--o{ TAX_ADJUSTMENTS : "references"
    ACCOUNTS ||--o{ ACCOUNTS : "parent_id"
    
    JOURNAL_ENTRIES ||--o{ JOURNAL_LINES : "contains"
    JOURNAL_ENTRIES ||--o{ DOCUMENTS : "has"
    
    DOCUMENTS ||--o{ ATTACHMENTS : "has"
    
    COST_CENTERS ||--o{ JOURNAL_LINES : "references"
    
    TAX_CALCULATIONS ||--o{ TAX_ADJUSTMENTS : "has"
    
    PROVISIONAL_BALANCES ||--o| ACCOUNTS : "tracks"
```

---

## 3. API REST Endpoints Detalhados

### 3.1 Autenticação
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/enable-mfa
POST   /api/v1/auth/verify-mfa
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

**Exemplo Request/Response**:
```bash
# POST /api/v1/auth/login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contador@empresa.com.br",
    "password": "senha123"
  }'

# Response (200 OK)
{
  "status": "success",
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "contador@empresa.com.br",
      "name": "João Contador",
      "mfa_enabled": true
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 3600
    }
  }
}
```

### 3.2 Empresas
```
POST   /api/v1/companies
GET    /api/v1/companies
GET    /api/v1/companies/:id
PUT    /api/v1/companies/:id
DELETE /api/v1/companies/:id
GET    /api/v1/companies/:id/users
POST   /api/v1/companies/:id/users
```

### 3.3 Plano de Contas
```
POST   /api/v1/companies/:id/accounts
GET    /api/v1/companies/:id/accounts
GET    /api/v1/companies/:id/accounts/:accountId
PUT    /api/v1/companies/:id/accounts/:accountId
DELETE /api/v1/companies/:id/accounts/:accountId
POST   /api/v1/companies/:id/accounts/import
GET    /api/v1/companies/:id/accounts/hierarchy
```

### 3.4 Lançamentos Contábeis
```
POST   /api/v1/companies/:id/journal-entries
GET    /api/v1/companies/:id/journal-entries
GET    /api/v1/companies/:id/journal-entries/:entryId
PUT    /api/v1/companies/:id/journal-entries/:entryId
DELETE /api/v1/companies/:id/journal-entries/:entryId
POST   /api/v1/companies/:id/journal-entries/:entryId/documents
GET    /api/v1/companies/:id/journal-entries/:entryId/audit
```

**Exemplo Request/Response**:
```bash
# POST /api/v1/companies/123/journal-entries
curl -X POST http://localhost:3000/api/v1/companies/123/journal-entries \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entry_date": "2026-05-15",
    "description": "Compra de material de escritório",
    "reference_type": "NF",
    "reference_number": "000123456",
    "lines": [
      {
        "account_id": "acc-001",
        "debit": 500.00,
        "credit": 0,
        "cost_center_id": "cc-adm"
      },
      {
        "account_id": "acc-bank",
        "debit": 0,
        "credit": 500.00
      }
    ]
  }'

# Response (201 Created)
{
  "status": "success",
  "data": {
    "id": "entry-001",
    "entry_date": "2026-05-15",
    "total_debit": 500.00,
    "total_credit": 500.00,
    "is_balanced": true,
    "created_by": "user-123",
    "created_at": "2026-05-17T10:30:00Z"
  }
}
```

### 3.5 Relatórios
```
GET    /api/v1/companies/:id/balance-sheet
GET    /api/v1/companies/:id/income-statement
GET    /api/v1/companies/:id/ledger
GET    /api/v1/companies/:id/trial-balance
GET    /api/v1/companies/:id/journal
GET    /api/v1/companies/:id/reports/export
```

### 3.6 Cálculo de Impostos
```
POST   /api/v1/companies/:id/tax-calculations
GET    /api/v1/companies/:id/tax-calculations
GET    /api/v1/companies/:id/tax-calculations/:id
PUT    /api/v1/companies/:id/tax-calculations/:id
POST   /api/v1/companies/:id/tax-calculations/:id/adjustments
```

### 3.7 Auditoria
```
GET    /api/v1/companies/:id/audit-logs
GET    /api/v1/companies/:id/audit-logs/:logId
```

---

## 4. Arquitetura Frontend (React)

### 4.1 Redux Store Structure

```typescript
// store.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import companyReducer from './slices/companySlice';
import journalReducer from './slices/journalSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    company: companyReducer,
    journal: journalReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 4.2 Slice Examples

```typescript
// slices/authSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mfaRequired: false,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }) => {
    const response = await AuthService.login(credentials);
    return response.data;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        localStorage.setItem('token', action.payload.tokens.access_token);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
```

### 4.3 Component Examples

```typescript
// components/common/Input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  helper, 
  ...props 
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
    )}
    <input
      {...props}
      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-500' : 'border-gray-300'
      }`}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    {helper && <p className="text-gray-500 text-xs mt-1">{helper}</p>}
  </div>
);
```

---

## 5. Arquitetura Mobile (React Native)

### 5.1 Navigation Structure

```typescript
// navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function HomeTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarLabel: Hide,
        tabBarActiveTintColor: '#2563eb',
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator({ user }: { user: User | null }) {
  return (
    <NavigationContainer>
      {user ? <HomeTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
```

### 5.2 Sync Engine (Offline-First)

```typescript
// services/SyncService.ts
import SQLite from 'react-native-sqlite-storage';

class SyncEngine {
  private db: SQLite.SQLiteDatabase;
  private syncQueue: SyncOperation[] = [];
  private isOnline: boolean = true;

  async enqueueOperation(operation: SyncOperation) {
    // Store in SQLite
    await this.db.executeSql(
      'INSERT INTO sync_queue (operation, payload, status) VALUES (?, ?, ?)',
      [operation.type, JSON.stringify(operation.payload), 'PENDING']
    );
    
    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  async processSyncQueue() {
    const operations = await this.db.executeSql(
      'SELECT * FROM sync_queue WHERE status = ?',
      ['PENDING']
    );

    for (const op of operations.rows.raw()) {
      try {
        await this.syncOperation(op);
        await this.markAsSynced(op.id);
      } catch (error) {
        console.error('Sync failed', error);
      }
    }
  }
}

export const syncService = new SyncEngine();
```

---

## 6. Design System & Components

### 6.1 Tailwind Config

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#2563eb',
          900: '#1e3a8a',
        },
        status: {
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#0ea5e9',
        },
      },
      spacing: {
        'safe': 'max(env(safe-area-inset-bottom), 1rem)',
      },
    },
  },
  plugins: [],
};
```

### 6.2 Componentes Principais

| Componente | Props | Uso |
|-----------|-------|-----|
| `Button` | `variant`, `size`, `disabled`, `loading` | Ações gerais |
| `Input` | `label`, `error`, `helper`, `type` | Formulários |
| `Select` | `options`, `multiple`, `searchable` | Seleções |
| `Table` | `columns`, `data`, `pagination`, `sort` | Listagens |
| `Modal` | `isOpen`, `onClose`, `title` | Diálogos |
| `Card` | `title`, `subtitle`, `footer` | Containers |
| `Alert` | `variant`, `title`, `message` | Notificações |
| `Sidebar` | `items`, `active` | Navegação |
| `Form` | `onSubmit`, `validation` | Formulários |

---

## 7. Fluxo de Segurança

### 7.1 Autenticação (JWT + Refresh)

```
┌─────────────────────────────────────────┐
│ 1. POST /auth/login                     │
│    { email, password }                  │
└────────────────┬────────────────────────┘
                 │
         Verifica credenciais
                 │
         ┌───────▼────────┐
         │ MFA Enabled?   │
         └───┬────────┬───┘
             │        │
           Não      Sim
             │        │
             │    Retorna token MFA
             │    Usuário completa MFA
             │        │
         ┌───▼────────▼──┐
         │ Retorna token │
         │ + refresh     │
         └────┬──────────┘
              │
    ┌─────────▼──────────┐
    │ Client armazena    │
    │ em localStorage    │
    │ (access_token)     │
    │ + localStorage     │
    │ (refresh_token)    │
    └────────────────────┘
```

### 7.2 Role-Based Access Control (RBAC)

```typescript
// models/permissions.ts
type Role = 'admin' | 'accountant' | 'viewer';

const PERMISSIONS: Record<Role, string[]> = {
  admin: [
    'company:create',
    'company:update',
    'company:delete',
    'users:manage',
    'reports:generate',
    'system:configure',
  ],
  accountant: [
    'journals:create',
    'journals:update',
    'journals:view',
    'reports:generate',
    'taxes:calculate',
  ],
  viewer: [
    'journals:view',
    'reports:view',
    'accounts:view',
  ],
};

// middleware/authorization.ts
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const company = await Company.findById(req.params.companyId);
    const companyUser = await CompanyUser.findOne({
      company_id: company.id,
      user_id: user.id,
    });

    if (!PERMISSIONS[companyUser.role].includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};
```

---

## 8. Padrões de Código & Conventions

### 8.1 Nomenclatura
- **Classes**: PascalCase (`JournalEntry`, `CompanyService`)
- **Funções**: camelCase (`createJournal`, `calculateTax`)
- **Variáveis**: camelCase (`journalEntry`, `totalDebit`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_DECIMAL_PLACES`, `DEFAULT_TIMEOUT`)
- **Arquivos**: kebab-case (`journal-service.ts`, `balance-sheet.tsx`)

### 8.2 Logging

```typescript
// utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Usage
logger.info('Journal entry created', {
  entryId: entry.id,
  userId: user.id,
  amount: entry.total_debit,
});

logger.error('Failed to calculate tax', {
  error: err.message,
  companyId,
  period,
});
```

### 8.3 Error Handling

```typescript
// errors/AppError.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Usage
throw new AppError(400, 'Invalid CNPJ format', 'INVALID_CNPJ');

// Middleware
app.use((error: AppError, req, res, next) => {
  res.status(error.statusCode || 500).json({
    status: 'error',
    code: error.code,
    message: error.message,
  });
});
```

---

## 9. Implementação: Primeiros Passos

### 9.1 Setup Local (Docker Compose)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: contador
      POSTGRES_PASSWORD: dev123
      POSTGRES_DB: contador_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://contador:dev123@postgres:5432/contador_db
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

### 9.2 Comandos de Setup

```bash
# Clone e setup
git clone <repo-url>
cd contador-app

# Backend
cd backend
npm install
npm run migrate
npm run seed  # Popular dados iniciais
npm run dev

# Frontend Web
cd frontend-web
npm install
npm run dev

# Frontend Mobile
cd frontend-mobile
npm install
npm run start
```

---

**Próximas Fases**:
1. Dev-QA Loop por task (tarefas 2.1-6.7)
2. Testes de conformidade SPED
3. Deployment staging → produção

