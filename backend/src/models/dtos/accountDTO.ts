/**
 * Account Data Transfer Objects (DTOs)
 * Validação e tipagem de dados para operações de plano de contas
 * Lei 6.404/76 - Lei das Sociedades por Ações
 */

/**
 * Account type enum - Tipos de contas contábeis conforme Lei 6.404/76
 */
export enum AccountTypeEnum {
  ASSET = 'ASSET',           // Ativo
  LIABILITY = 'LIABILITY',   // Passivo
  EQUITY = 'EQUITY',         // Patrimônio Líquido (PL)
  REVENUE = 'REVENUE',       // Receitas
  EXPENSE = 'EXPENSE',       // Despesas
}

/**
 * Tax code enum - Classificações de impostos relacionados
 */
export enum TaxCodeEnum {
  IRPJ = 'IRPJ',       // Imposto de Renda Pessoa Jurídica
  CSLL = 'CSLL',       // Contribuição Social sobre o Lucro Líquido
  PIS = 'PIS',         // Programa de Integração Social
  COFINS = 'COFINS',   // Contribuição para Financiamento da Seguridade Social
  ICMS = 'ICMS',       // Imposto sobre Circulação de Mercadorias e Serviços
  ISS = 'ISS',         // Imposto sobre Serviços de Qualquer Natureza
}

/**
 * DTO para criar uma nova conta contábil
 * POST /companies/:id/accounts
 * Requer role: ACCOUNTANT ou ADMIN
 */
export interface CreateAccountDTO {
  code: string;                    // Código hierárquico (ex: 1.1.1.01)
  name: string;                    // Nome descritivo (1-255 caracteres)
  type: AccountTypeEnum | string;  // Tipo de conta
  parent_code?: string;            // Código da conta pai (para hierarquia)
  tax_code?: TaxCodeEnum | string; // Classificação de imposto (opcional)
  is_analytical?: boolean;         // É uma conta analítica? (default: false)
}

/**
 * DTO para atualizar uma conta contábil
 * PUT /companies/:id/accounts/:accountId
 * Requer role: ACCOUNTANT ou ADMIN
 * IMUTÁVEL: code (código não pode ser alterado)
 */
export interface UpdateAccountDTO {
  name?: string;                    // Nome (1-255 caracteres)
  type?: AccountTypeEnum | string;  // Tipo de conta
  parent_code?: string;             // Conta pai (validar ciclos)
  tax_code?: TaxCodeEnum | string;  // Classificação de imposto
  is_analytical?: boolean;          // Status analítico
}

/**
 * DTO para filtros na listagem de contas
 * Query parameters de GET /companies/:id/accounts
 */
export interface AccountFilters {
  page?: number;            // Página (default: 1)
  limit?: number;           // Itens por página (default: 50, max: 500)
  search?: string;          // Busca em name ou code
  type?: AccountTypeEnum | string;  // Filtrar por tipo
  hierarchy?: boolean;      // true: retorna tree | false: flat list (default: false)
  parent_code?: string;     // Filtrar sub-contas de um parent
  tax_code?: TaxCodeEnum | string;  // Filtrar por imposto
}

/**
 * Resposta de conta contábil (para API)
 * Inclui saldo calculado dinamicamente
 */
export interface AccountResponse {
  id: string;                  // UUID da conta
  code: string;                // Código hierárquico
  name: string;                // Nome
  type: AccountTypeEnum;       // Tipo
  parent_code?: string;        // Código da conta pai
  parent_id?: string;          // ID da conta pai
  tax_code?: TaxCodeEnum;      // Imposto associado
  is_analytical: boolean;      // É analítica?
  balance: number;             // Saldo (débito - crédito)
  debit_total?: number;        // Total de débitos
  credit_total?: number;       // Total de créditos
  is_active: boolean;          // Soft delete flag
  created_at: string;          // ISO timestamp
  updated_at: string;          // ISO timestamp
}

/**
 * Resposta paginada de contas
 */
export interface PaginatedAccountResponse {
  data: AccountResponse[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * Estrutura hierárquica de contas
 * Retornada quando hierarchy=true
 */
export interface AccountHierarchy {
  code: string;
  name: string;
  type: AccountTypeEnum;
  balance?: number;
  is_analytical: boolean;
  children?: AccountHierarchy[];
}

/**
 * Resposta de saldo de conta
 * GET /companies/:id/accounts/:accountId/balance
 */
export interface AccountBalanceResponse {
  account_id: string;
  code: string;
  name: string;
  balance: number;
  debit_total: number;
  credit_total: number;
}

/**
 * Resposta de importação de plano de contas
 * POST /companies/:id/accounts/import-plano
 */
export interface ImportPlanoResponse {
  imported: number;    // Contas importadas com sucesso
  skipped: number;     // Contas puladas (já existem)
  total: number;       // Total no arquivo
  errors?: string[];   // Mensagens de erro (opcional)
}

/**
 * Validador de DTOs de Conta
 * Validações de negócio para contas contábeis
 */
export class AccountDTOValidator {
  /**
   * Validar CreateAccountDTO
   * @param data - DTO a validar
   * @returns {isValid, errors}
   */
  static validateCreateDTO(data: CreateAccountDTO): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    // Validar code
    if (!data.code) {
      errors.code = 'Code is required';
    } else if (!/^[0-9.]+$/.test(data.code)) {
      errors.code = 'Code must contain only numbers and dots (e.g., 1.1.1.01)';
    } else if (data.code.length > 20) {
      errors.code = 'Code cannot exceed 20 characters';
    }

    // Validar name
    if (!data.name) {
      errors.name = 'Name is required';
    } else if (data.name.length < 1 || data.name.length > 255) {
      errors.name = 'Name must be between 1 and 255 characters';
    }

    // Validar type
    if (!data.type) {
      errors.type = 'Type is required';
    } else if (!Object.values(AccountTypeEnum).includes(data.type as AccountTypeEnum)) {
      errors.type = `Type must be one of: ${Object.values(AccountTypeEnum).join(', ')}`;
    }

    // Validar tax_code (se presente)
    if (data.tax_code && !Object.values(TaxCodeEnum).includes(data.tax_code as TaxCodeEnum)) {
      errors.tax_code = `Tax code must be one of: ${Object.values(TaxCodeEnum).join(', ')}`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validar UpdateAccountDTO
   * @param data - DTO a validar
   * @returns {isValid, errors}
   */
  static validateUpdateDTO(data: UpdateAccountDTO): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    // Validar name (se presente)
    if (data.name !== undefined) {
      if (data.name.length < 1 || data.name.length > 255) {
        errors.name = 'Name must be between 1 and 255 characters';
      }
    }

    // Validar type (se presente)
    if (data.type && !Object.values(AccountTypeEnum).includes(data.type as AccountTypeEnum)) {
      errors.type = `Type must be one of: ${Object.values(AccountTypeEnum).join(', ')}`;
    }

    // Validar tax_code (se presente)
    if (data.tax_code && !Object.values(TaxCodeEnum).includes(data.tax_code as TaxCodeEnum)) {
      errors.tax_code = `Tax code must be one of: ${Object.values(TaxCodeEnum).join(', ')}`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validar filtros de listagem
   * @param filters - Filtros a validar
   * @returns {isValid, errors}
   */
  static validateFilters(filters: AccountFilters): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    if (filters.page !== undefined && (filters.page < 1 || !Number.isInteger(filters.page))) {
      errors.page = 'Page must be a positive integer';
    }

    if (filters.limit !== undefined) {
      if (filters.limit < 1 || filters.limit > 500 || !Number.isInteger(filters.limit)) {
        errors.limit = 'Limit must be between 1 and 500';
      }
    }

    if (filters.type && !Object.values(AccountTypeEnum).includes(filters.type as AccountTypeEnum)) {
      errors.type = `Type must be one of: ${Object.values(AccountTypeEnum).join(', ')}`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
