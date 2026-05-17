-- ============================================================================
-- Migration: 005_create_documents_attachments.sql
-- Description: Create Documents and Attachments schema for source document tracking
-- Database: PostgreSQL 14+
-- Author: Backend Architect
-- Date: 2026-05-17
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- Tabela: documents (Documentos Origem)
-- ============================================================================
-- Descrição: Armazena metadados de documentos origem (NF, RPA, CHEQUE, etc)
--            que originaram os lançamentos contábeis. Cada documento pode ter
--            múltiplos anexos (PDFs, imagens, etc). Implementa soft delete
--            via is_active e integridade SHA-256 via checksum.
--
-- Campos:
--   - id: Identificador único (UUID)
--   - journal_entry_id: Referência ao lançamento contábil que originou o documento
--                       Comentada para migration 006 - será adicionada FK então
--   - document_type: Tipo de documento (NF, RPA, CHEQUE, BOLETO, INVOICE, MANUAL)
--   - document_number: Número do documento (ex: 123456, 00001234)
--   - issuer: Emissor/Fornecedor do documento (ex: CNPJ/CPF do fornecedor)
--   - issue_date: Data de emissão do documento
--   - amount: Valor total do documento
--   - checksum_sha256: Hash SHA-256 do conteúdo para auditoria/integridade
--   - is_active: Flag para soft delete (true=ativo, false=excluído logicamente)
--   - created_at: Timestamp de criação do documento
--   - updated_at: Timestamp da última alteração
--
-- Constraints:
--   - PRIMARY KEY: Garante unicidade do id
--   - NOT NULL: document_type, document_number, issuer são obrigatórios
--   - valid_document_type: Valida apenas tipos permitidos
--   - valid_amount: Garante que amount >= 0
--   - valid_issue_date: Garante que issue_date não é no futuro
--   - Foreign Keys (comentadas para migration 006):
--       - journal_entry_id -> journal_entries.id ON DELETE CASCADE
--
-- Índices de Performance:
--   - idx_documents_journal_entry: Otimiza busca de docs por lançamento
--   - idx_documents_number: Otimiza busca de docs por número (unicidade)
--   - idx_documents_type: Otimiza queries por tipo de documento
--   - idx_documents_is_active: Otimiza filtros de documentos ativos
--   - idx_documents_created_at: Otimiza range queries por data de criação
--   - idx_documents_issuer: Otimiza busca por fornecedor/emitente
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  -- Identificadores e Chaves Estrangeiras
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,  -- FK: Migration 006
  
  -- Metadados do Documento
  document_type VARCHAR(50) NOT NULL,
  document_number VARCHAR(50) NOT NULL,
  issuer VARCHAR(255) NOT NULL,
  issue_date DATE,
  amount NUMERIC(18,2),
  
  -- Auditoria e Integridade
  checksum_sha256 VARCHAR(64),  -- SHA-256 hash para verificar integridade
  is_active BOOLEAN DEFAULT true,  -- Soft delete
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints de Validação
  CONSTRAINT valid_document_type CHECK (
    document_type IN ('NF', 'RPA', 'CHEQUE', 'BOLETO', 'INVOICE', 'MANUAL')
  ),
  CONSTRAINT valid_amount CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT valid_issue_date CHECK (issue_date IS NULL OR issue_date <= CURRENT_DATE)
);

-- Criar índices para otimização de queries
-- Índice para buscas por lançamento (FK - migration 006 adicionará a FK)
CREATE INDEX IF NOT EXISTS idx_documents_journal_entry 
  ON documents(journal_entry_id) 
  WHERE is_active = true;

-- Índice para buscas por número do documento (alta seletividade)
CREATE INDEX IF NOT EXISTS idx_documents_number 
  ON documents(document_number) 
  WHERE is_active = true;

-- Índice para filtros por tipo de documento
CREATE INDEX IF NOT EXISTS idx_documents_type 
  ON documents(document_type) 
  WHERE is_active = true;

-- Índice para filtros de documentos ativos
CREATE INDEX IF NOT EXISTS idx_documents_is_active 
  ON documents(is_active, created_at DESC);

-- Índice para range queries por data de criação (relatórios)
CREATE INDEX IF NOT EXISTS idx_documents_created_at 
  ON documents(created_at DESC) 
  WHERE is_active = true;

-- Índice para buscas por fornecedor/emitente
CREATE INDEX IF NOT EXISTS idx_documents_issuer 
  ON documents(issuer) 
  WHERE is_active = true;


-- ============================================================================
-- Tabela: attachments (Anexos de Documentos)
-- ============================================================================
-- Descrição: Armazena arquivos anexados a documentos (PDFs, imagens, etc).
--            Cada anexo possui metadados de arquivo, informações de upload
--            e checksum SHA-256 para validação de integridade. Implementa
--            rastreamento de quem enviou e quando.
--
-- Campos:
--   - id: Identificador único (UUID)
--   - document_id: Referência ao documento ao qual o arquivo está anexado
--   - file_path: Caminho/URL do arquivo armazenado (ex: /uploads/2026/05/doc123.pdf)
--   - file_type: Extensão/tipo do arquivo (pdf, jpg, png, xlsx, etc)
--   - file_size: Tamanho do arquivo em bytes (BIGINT para suportar arquivos grandes)
--   - checksum_sha256: Hash SHA-256 do arquivo para validação de integridade
--   - uploaded_by: Usuário que fez upload do arquivo
--                  Comentada para migration 006 - será adicionada FK então
--   - uploaded_at: Timestamp do upload
--
-- Constraints:
--   - PRIMARY KEY: Garante unicidade do id
--   - NOT NULL: document_id, file_path, file_type são obrigatórios
--   - valid_file_type: Valida apenas tipos permitidos
--   - valid_file_size: Garante que file_size >= 0
--   - Foreign Keys:
--       - document_id -> documents.id ON DELETE CASCADE
--       - uploaded_by -> users.id ON DELETE SET NULL (comentada para migration 006)
--
-- Índices de Performance:
--   - idx_attachments_document: Otimiza busca de anexos por documento
--   - idx_attachments_file_type: Otimiza filtros por tipo de arquivo
--   - idx_attachments_uploaded_at: Otimiza range queries por data de upload
--   - idx_attachments_uploaded_by: Otimiza buscas por usuário que upload
--   - idx_attachments_checksum: Otimiza validação de duplicatas
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS attachments (
  -- Identificadores e Chaves Estrangeiras
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- FK: Migration 006
  
  -- Metadados do Arquivo
  file_path VARCHAR(500) NOT NULL,  -- Caminho onde o arquivo está armazenado
  file_type VARCHAR(50) NOT NULL,   -- Tipo/extensão do arquivo
  file_size BIGINT,                 -- Tamanho em bytes (suporta arquivos grandes)
  
  -- Auditoria e Integridade
  checksum_sha256 VARCHAR(64),      -- SHA-256 hash para verificar integridade do arquivo
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints de Validação
  CONSTRAINT valid_file_type CHECK (
    file_type IN ('pdf', 'jpg', 'jpeg', 'png', 'gif', 'xlsx', 'xls', 'csv', 'txt', 'doc', 'docx')
  ),
  CONSTRAINT valid_file_size CHECK (file_size IS NULL OR file_size > 0)
);

-- Criar índices para otimização de queries
-- Índice para buscas de anexos de um documento específico (muito comum)
CREATE INDEX IF NOT EXISTS idx_attachments_document 
  ON attachments(document_id);

-- Índice para filtros por tipo de arquivo (pdf, xlsx, etc)
CREATE INDEX IF NOT EXISTS idx_attachments_file_type 
  ON attachments(file_type);

-- Índice para range queries por data de upload (relatórios)
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_at 
  ON attachments(uploaded_at DESC);

-- Índice para buscas de arquivos enviados por um usuário
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by 
  ON attachments(uploaded_by);

-- Índice para validação de duplicatas de arquivo (mesmo hash)
CREATE INDEX IF NOT EXISTS idx_attachments_checksum 
  ON attachments(checksum_sha256) 
  WHERE checksum_sha256 IS NOT NULL;


-- ============================================================================
-- Comentários para Próximas Migrações (Migration 006)
-- ============================================================================
-- 
-- A migration 006 deverá adicionar as seguintes Foreign Keys:
--
-- 1. documents.journal_entry_id -> journal_entries.id
--    ALTER TABLE documents 
--    ADD CONSTRAINT fk_documents_journal_entries 
--    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE;
--
-- 2. attachments.uploaded_by -> users.id
--    ALTER TABLE attachments 
--    ADD CONSTRAINT fk_attachments_users 
--    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
--
-- Estas FKs foram comentadas nesta migration para evitar dependências circulares
-- e permitir flexibilidade na ordem de execução das migrations.
--
-- ============================================================================

-- ============================================================================
-- Exemplos de Uso e Queries Comuns
-- ============================================================================
--
-- 1. Listar todos os documentos de uma empresa com seus anexos:
--    SELECT d.id, d.document_type, d.document_number, 
--           COUNT(a.id) as num_attachments
--    FROM documents d
--    LEFT JOIN attachments a ON d.id = a.document_id
--    WHERE d.is_active = true
--    GROUP BY d.id;
--
-- 2. Validar integridade de um arquivo (comparar checksum):
--    SELECT id, file_path, checksum_sha256
--    FROM attachments
--    WHERE id = '12345-6789-...'
--    AND checksum_sha256 = 'abc123def456...';  -- Hash do arquivo recalculado
--
-- 3. Listar documentos por fornecedor:
--    SELECT issuer, COUNT(*) as total_docs
--    FROM documents
--    WHERE is_active = true
--    GROUP BY issuer
--    ORDER BY total_docs DESC;
--
-- 4. Encontrar documentos sem anexos:
--    SELECT d.id, d.document_number, d.issuer
--    FROM documents d
--    LEFT JOIN attachments a ON d.id = a.document_id
--    WHERE d.is_active = true AND a.id IS NULL;
--
-- ============================================================================
