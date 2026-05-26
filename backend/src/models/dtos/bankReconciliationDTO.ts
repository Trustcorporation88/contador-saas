/**
 * Bank Reconciliation DTOs and Types
 * Type-safe data transfer objects para upload, processing e matching
 */

import * as Joi from 'joi';

// =====================================================
// Bank Reconciliation Upload Types
// =====================================================

export interface BankTransactionDTO {
  transaction_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  bank_balance?: number;
  document_number?: string;
  bank_branch_code?: string;
  bank_account_number?: string;
}

export interface BankReconciliationUploadDTO {
  file_name: string;
  bank_name: string;
  transaction_count: number;
  transactions: BankTransactionDTO[];
}

export interface BankReconciliationUploadResponse {
  id: string;
  company_id: string;
  file_name: string;
  bank_name: string;
  transaction_count: number;
  status: 'uploaded' | 'processed' | 'reconciled' | 'failed';
  uploaded_at: string;
  processed_at?: string | null;
}

// =====================================================
// Matching and Suggestion Types
// =====================================================

export interface ReconciliationMatchDTO {
  bank_transaction_id: string;
  journal_entry_id: string;
}

export interface ReconciliationSuggestion {
  bank_transaction_id: string;
  bank_description: string;
  bank_amount: number;
  bank_date: string;
  bank_type: 'debit' | 'credit';
  
  journal_entry_id: string;
  journal_description: string;
  journal_amount: number;
  journal_date: string;
  
  confidence: number; // 0-1
  confidence_percentage: string; // "85%"
  
  description_score: number;
  amount_score: number;
  date_score: number;
  
  match_type: 'automatic' | 'manual' | 'unmatched';
}

export interface GetSuggestionsResponse {
  upload_id: string;
  total_transactions: number;
  matched_count: number;
  unmatched_count: number;
  confidence_threshold: number;
  suggestions: ReconciliationSuggestion[];
}

// =====================================================
// Execute Reconciliation Types
// =====================================================

export interface AcceptedSuggestionInput {
  bank_transaction_id: string;
  journal_entry_id: string;
}

export interface ExecuteReconciliationDTO {
  accepted_suggestions: AcceptedSuggestionInput[];
}

export interface ExecuteReconciliationResponse {
  upload_id: string;
  total_processed: number;
  reconciled_count: number;
  unmatched_count: number;
  status: 'reconciled';
}

// =====================================================
// File Upload / CSV Parsing Types
// =====================================================

export interface CSVParseResult {
  bank_name: string;
  transactions: BankTransactionDTO[];
  errors: string[];
}

export interface BankIdentificationResult {
  bank_name: string;
  confidence: number;
  headers: string[];
}

// =====================================================
// Joi Validation Schemas
// =====================================================

export class BankReconciliationValidator {
  /**
   * Schema para validar arquivo de upload
   * Headers esperados: data, descrição, débito, crédito, saldo
   */
  static uploadFileSchema = Joi.object({
    file: Joi.object({
      originalname: Joi.string().required(),
      mimetype: Joi.string()
        .valid('text/csv', 'text/plain', 'application/vnd.ms-excel')
        .required(),
      buffer: Joi.binary().required(),
    }).required(),
  });

  /**
   * Schema para transação bancária
   */
  static bankTransactionSchema = Joi.object({
    transaction_date: Joi.date().iso().required(),
    description: Joi.string().max(500).required(),
    amount: Joi.number().positive().required(),
    type: Joi.string().valid('debit', 'credit').required(),
    bank_balance: Joi.number().optional(),
    document_number: Joi.string().optional(),
    bank_branch_code: Joi.string().optional(),
    bank_account_number: Joi.string().optional(),
  });

  /**
   * Schema para sugestões aceitas
   */
  static executeReconciliationSchema = Joi.object({
    accepted_suggestions: Joi.array()
      .items(
        Joi.object({
          bank_transaction_id: Joi.string().guid({ version: 'uuidv4' }).required(),
          journal_entry_id: Joi.string().guid({ version: 'uuidv4' }).required(),
        }),
      )
      .min(0)
      .required(),
  });

  /**
   * Validar DTO de upload
   */
  static validateUploadDTO(data: any): { isValid: boolean; errors: Record<string, string> } {
    const { error, value } = this.uploadFileSchema.validate(data, {
      abortEarly: false,
    });

    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach(detail => {
        errors[detail.path.join('.')] = detail.message;
      });
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }

  /**
   * Validar dados de execução
   */
  static validateExecuteDTO(data: any): { isValid: boolean; errors: Record<string, string> } {
    const { error, value } = this.executeReconciliationSchema.validate(data, {
      abortEarly: false,
    });

    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach(detail => {
        errors[detail.path.join('.')] = detail.message;
      });
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }
}

// =====================================================
// CSV Parsing Configuration
// =====================================================

export interface CSVColumnMapping {
  dateColumn: number;
  descriptionColumn: number;
  debitColumn: number;
  creditColumn: number;
  balanceColumn?: number;
}

export interface BankProfile {
  name: string;
  identifier: string[]; // Strings que identificam o banco no cabeçalho
  columnMapping: CSVColumnMapping;
  dateFormat: string; // 'DD/MM/YYYY', 'YYYY-MM-DD', etc
  separator: string; // ',' ou ';'
}

/**
 * Perfis de bancos conhecidos
 */
export const BANK_PROFILES: Record<string, BankProfile> = {
  'banco-do-brasil': {
    name: 'Banco do Brasil',
    identifier: ['Banco do Brasil', 'BB', 'banco do brasil'],
    columnMapping: {
      dateColumn: 0,
      descriptionColumn: 2,
      debitColumn: 4,
      creditColumn: 5,
      balanceColumn: 6,
    },
    dateFormat: 'DD/MM/YYYY',
    separator: ';',
  },
  caixa: {
    name: 'Caixa Econômica Federal',
    identifier: ['Caixa', 'CEF', 'caixa econômica'],
    columnMapping: {
      dateColumn: 0,
      descriptionColumn: 2,
      debitColumn: 3,
      creditColumn: 4,
      balanceColumn: 5,
    },
    dateFormat: 'DD/MM/YYYY',
    separator: ';',
  },
  itau: {
    name: 'Itaú Unibanco',
    identifier: ['Itaú', 'itau', 'Itaucard'],
    columnMapping: {
      dateColumn: 0,
      descriptionColumn: 1,
      debitColumn: 3,
      creditColumn: 2,
      balanceColumn: 4,
    },
    dateFormat: 'DD/MM/YYYY',
    separator: ';',
  },
  bradesco: {
    name: 'Bradesco',
    identifier: ['Bradesco', 'bradesco'],
    columnMapping: {
      dateColumn: 0,
      descriptionColumn: 1,
      debitColumn: 3,
      creditColumn: 2,
      balanceColumn: 4,
    },
    dateFormat: 'DD/MM/YYYY',
    separator: ';',
  },
  santander: {
    name: 'Santander',
    identifier: ['Santander', 'santander'],
    columnMapping: {
      dateColumn: 0,
      descriptionColumn: 1,
      debitColumn: 3,
      creditColumn: 2,
      balanceColumn: 4,
    },
    dateFormat: 'DD/MM/YYYY',
    separator: ';',
  },
  generic: {
    name: 'Generic CSV',
    identifier: [],
    columnMapping: {
      dateColumn: 0,
      descriptionColumn: 1,
      debitColumn: 2,
      creditColumn: 3,
      balanceColumn: 4,
    },
    dateFormat: 'DD/MM/YYYY',
    separator: ';',
  },
};
