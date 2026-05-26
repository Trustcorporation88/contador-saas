/**
 * EFD DTOs
 * Data Transfer Objects para Escrituração Fiscal Digital
 */

export interface CreateEFDGenerationDTO {
  month: number; // 1-12
  year: number; // 2024+
  includeOperations?: boolean;
  includeInventory?: boolean;
  includeAdjustments?: boolean;
}

export interface EFDGenerationResponse {
  id: string;
  company_id: string;
  month: number;
  year: number;
  status: EFDStatus;
  generated_at: string;
  validated_at?: string;
  file_path?: string;
  validation_errors: string[];
  record_count: number;
  total_debit: number;
  total_credit: number;
  metadata: EFDMetadata;
}

export interface EFDMetadata {
  cnpj: string;
  company_name: string;
  period_start: string;
  period_end: string;
  version: string; // RFB version
  generated_by: string;
  document_type: string; // RFB document type
}

export interface EFDValidationResult {
  is_valid: boolean;
  errors: EFDValidationError[];
  warnings: string[];
  summary: {
    total_records: number;
    total_debit: number;
    total_credit: number;
    debit_credit_diff: number;
    debit_credit_balanced: boolean;
  };
}

export interface EFDValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  record_type?: string;
  details?: Record<string, any>;
}

export interface EFDRecord {
  type: string; // E100, E110, E200, E990, etc
  fields: Record<string, string | number | boolean>;
  sequence: number;
}

export interface EFDLayoutConfig {
  version: string;
  header_required: boolean;
  trailer_required: boolean;
  record_types: {
    [key: string]: {
      required: boolean;
      fields: EFDFieldDef[];
    };
  };
}

export interface EFDFieldDef {
  name: string;
  position: number;
  length: number;
  type: 'numeric' | 'alphanumeric' | 'decimal' | 'date';
  required: boolean;
  format?: string; // for formatting, e.g., "DD/MM/YYYY"
}

export interface EFDJournalEntry {
  id: string;
  company_id: string;
  account_from_id: string;
  account_to_id: string;
  description: string;
  debit_value: number;
  credit_value: number;
  entry_date: string;
  document_number: string;
  reference_document: string;
  sequence: number;
}

export interface EFDAccountBalance {
  account_code: string;
  account_name: string;
  debit_total: number;
  credit_total: number;
  balance: number;
  balance_type: 'debit' | 'credit';
}

export interface EFDDownloadOptions {
  format: 'txt' | 'pdf' | 'zip';
  include_metadata: boolean;
  include_validation_report: boolean;
}

export enum EFDStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  GENERATED = 'generated',
  VALIDATING = 'validating',
  VALIDATED = 'validated',
  VALIDATION_FAILED = 'validation_failed',
  SENT = 'sent',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export interface EFDSchedulerConfig {
  enabled: boolean;
  day_of_month: number; // 5th day of month
  hour: number; // 08:00 BR time
  minute: number;
  timezone: string; // America/Sao_Paulo
  auto_generate: boolean;
  notify_on_completion: boolean;
  notify_on_error: boolean;
}

export interface ListEFDFilters {
  status?: EFDStatus;
  month?: number;
  year?: number;
  from_date?: string;
  to_date?: string;
  has_errors?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedEFDResponse {
  data: EFDGenerationResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface EFDDownloadRequest {
  generation_id: string;
  format: 'txt' | 'pdf';
  include_validation_report: boolean;
}

export interface RFBValidationRequest {
  efd_id: string;
  cnpj: string;
  month: number;
  year: number;
  file_content: string;
}

export interface RFBValidationResponse {
  request_id: string;
  status: 'received' | 'processing' | 'validated' | 'rejected';
  errors: RFBValidationError[];
  protocol?: string;
}

export interface RFBValidationError {
  code: string;
  message: string;
  field?: string;
  value?: string;
}
