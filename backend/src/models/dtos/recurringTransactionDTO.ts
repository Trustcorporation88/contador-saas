/**
 * Recurring Transaction DTOs
 * Data Transfer Objects para validação e tipagem de lançamentos recorrentes
 */

export enum RecurringTransactionFrequency {
  DIARIO = 'DIARIO',
  MENSAL = 'MENSAL',
  ANUAL = 'ANUAL',
}

export enum ExecutionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * DTO para criar novo template de lançamento recorrente
 */
export interface CreateRecurringTransactionDTO {
  description: string;
  amount: number;
  debitAccount: string; // UUID
  creditAccount: string; // UUID
  frequency: RecurringTransactionFrequency;
  startDate: string; // ISO 8601: YYYY-MM-DD
  endDate?: string; // ISO 8601: YYYY-MM-DD
  labels?: string[];
}

/**
 * DTO para atualizar template de lançamento recorrente
 */
export interface UpdateRecurringTransactionDTO {
  isActive?: boolean;
  description?: string;
  amount?: number;
  endDate?: string;
}

/**
 * DTO para resposta de template recorrente
 */
export interface RecurringTransactionResponse {
  id: string;
  companyId: string;
  description: string;
  amount: number;
  debitAccount: {
    id: string;
    code: string;
    name: string;
  };
  creditAccount: {
    id: string;
    code: string;
    name: string;
  };
  frequency: RecurringTransactionFrequency;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  nextExecutionDate: string | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO para resposta de execução
 */
export interface RecurringTransactionExecutionResponse {
  id: string;
  recurringTransactionId: string;
  executionDate: string;
  journalEntryId: string | null;
  status: ExecutionStatus;
  errorMessage: string | null;
  retryCount: number;
  executedAt: string | null;
  createdAt: string;
}

/**
 * DTO para listar templates com paginação
 */
export interface ListRecurringTransactionsDTO {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive';
  frequency?: RecurringTransactionFrequency;
}

/**
 * DTO para resposta paginada
 */
export interface PaginatedRecurringTransactionsResponse {
  data: RecurringTransactionResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * DTO para resposta de execuções com paginação
 */
export interface PaginatedExecutionsResponse {
  data: RecurringTransactionExecutionResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Validador de DTOs
 */
export class RecurringTransactionDTOValidator {
  /**
   * Validar DTO de criação
   */
  static validateCreateDTO(data: CreateRecurringTransactionDTO): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    if (!data.description || data.description.trim().length === 0) {
      errors.description = 'Descrição é obrigatória';
    }

    if (data.description && data.description.length > 255) {
      errors.description = 'Descrição não pode exceder 255 caracteres';
    }

    if (!data.amount || data.amount <= 0) {
      errors.amount = 'Valor deve ser maior que zero';
    }

    if (!data.debitAccount) {
      errors.debitAccount = 'Conta de débito é obrigatória';
    }

    if (!data.creditAccount) {
      errors.creditAccount = 'Conta de crédito é obrigatória';
    }

    if (data.debitAccount === data.creditAccount) {
      errors.accounts = 'Contas de débito e crédito devem ser diferentes';
    }

    if (!data.frequency || !Object.values(RecurringTransactionFrequency).includes(data.frequency)) {
      errors.frequency = 'Frequência inválida';
    }

    if (!data.startDate) {
      errors.startDate = 'Data de início é obrigatória';
    } else if (!this.isValidDate(data.startDate)) {
      errors.startDate = 'Data de início inválida (use YYYY-MM-DD)';
    }

    if (data.endDate) {
      if (!this.isValidDate(data.endDate)) {
        errors.endDate = 'Data de fim inválida (use YYYY-MM-DD)';
      } else if (data.startDate && new Date(data.startDate) > new Date(data.endDate)) {
        errors.dateRange = 'Data de fim deve ser maior ou igual à data de início';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validar DTO de atualização
   */
  static validateUpdateDTO(data: UpdateRecurringTransactionDTO): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    if (data.description !== undefined) {
      if (data.description.length === 0 || data.description.length > 255) {
        errors.description = 'Descrição deve ter entre 1 e 255 caracteres';
      }
    }

    if (data.amount !== undefined) {
      if (data.amount <= 0) {
        errors.amount = 'Valor deve ser maior que zero';
      }
    }

    if (data.endDate !== undefined) {
      if (!this.isValidDate(data.endDate)) {
        errors.endDate = 'Data de fim inválida (use YYYY-MM-DD)';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Verificar se data é válida (YYYY-MM-DD)
   */
  private static isValidDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }
}
