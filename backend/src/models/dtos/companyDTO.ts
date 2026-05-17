/**
 * Company Data Transfer Objects (DTOs)
 * Validação e tipagem de dados para operações de empresas
 */

/**
 * Tax regime enum - Regimes tributários suportados
 */
export enum TaxRegimeEnum {
  LUCRO_REAL = 'LUCRO_REAL',
  LUCRO_PRESUMIDO = 'LUCRO_PRESUMIDO',
  SIMPLES_NACIONAL = 'SIMPLES_NACIONAL',
}

/**
 * DTO para criar uma nova empresa
 * POST /companies
 */
export interface CreateCompanyDTO {
  cnpj: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_regime: TaxRegimeEnum | string;
  fiscal_year_start?: {
    month: number;
    day: number;
  };
}

/**
 * DTO para atualizar uma empresa
 * PUT /companies/:id
 * Todos os campos são opcionais, CNPJ não pode ser alterado
 */
export interface UpdateCompanyDTO {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_regime?: TaxRegimeEnum | string;
  fiscal_year_start?: {
    month: number;
    day: number;
  };
}

/**
 * Resposta de empresa (para API)
 * Inclui timestamps e campos administrativos
 */
export interface CompanyResponse {
  id: string;
  cnpj: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_regime: string;
  fiscal_year_start?: {
    month: number;
    day: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Resposta paginada para listagem de empresas
 */
export interface PaginatedCompanyResponse {
  data: CompanyResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Filtros para listagem de empresas
 */
export interface CompanyFilters {
  search?: string;
  tax_regime?: string;
  created_from?: string;
  created_to?: string;
  page?: number;
  limit?: number;
}

/**
 * Validação de CNPJ
 * Formato: 14 dígitos
 * Com algoritmo de dígito verificador (opcional para validação simples)
 */
export class CompanyDTOValidator {
  /**
   * Valida formato de CNPJ
   * @param cnpj - String com 14 dígitos
   * @returns boolean - true se formato é válido
   */
  static validateCNPJFormat(cnpj: string): boolean {
    // Remove caracteres especiais
    const cleaned = cnpj.replace(/[^\d]/g, '');

    // Deve ter exatamente 14 dígitos
    if (cleaned.length !== 14) {
      return false;
    }

    // Valida algoritmo de dígito verificador
    return this.validateCNPJCheckDigits(cleaned);
  }

  /**
   * Valida dígitos verificadores do CNPJ
   * Algoritmo oficial da Receita Federal
   */
  private static validateCNPJCheckDigits(cnpj: string): boolean {
    // Rejeita sequências de dígitos iguais
    if (/^(\d)\1{13}$/.test(cnpj)) {
      return false;
    }

    // Calcula primeiro dígito verificador
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    let digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += numbers.charAt(size - i) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) {
      return false;
    }

    // Calcula segundo dígito verificador
    size = cnpj.length - 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += numbers.charAt(size - i) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) {
      return false;
    }

    return true;
  }

  /**
   * Valida email (RFC 5322 simplificado)
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida name (3-255 caracteres)
   */
  static validateName(name: string): boolean {
    return name && name.length >= 3 && name.length <= 255;
  }

  /**
   * Valida tax_regime (enum)
   */
  static validateTaxRegime(regime: string): boolean {
    return Object.values(TaxRegimeEnum).includes(regime as TaxRegimeEnum);
  }

  /**
   * Valida fiscal year start
   * month: 1-12
   * day: 1-31
   */
  static validateFiscalYearStart(fiscalYearStart: {
    month: number;
    day: number;
  }): boolean {
    if (!fiscalYearStart) {
      return true; // Opcional
    }

    const { month, day } = fiscalYearStart;

    if (month < 1 || month > 12) {
      return false;
    }

    if (day < 1 || day > 31) {
      return false;
    }

    return true;
  }

  /**
   * Valida phone (opcional, formato simples)
   * Aceita números, parênteses, hífens e espaços
   */
  static validatePhone(phone: string): boolean {
    if (!phone) {
      return true; // Opcional
    }

    const phoneRegex = /^[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.length >= 10;
  }

  /**
   * Valida DTO completo para criação
   */
  static validateCreateDTO(dto: CreateCompanyDTO): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    // CNPJ
    if (!dto.cnpj) {
      errors.cnpj = 'CNPJ is required';
    } else if (!this.validateCNPJFormat(dto.cnpj)) {
      errors.cnpj = 'Invalid CNPJ format or check digits';
    }

    // Name
    if (!dto.name) {
      errors.name = 'Company name is required';
    } else if (!this.validateName(dto.name)) {
      errors.name = 'Company name must be between 3 and 255 characters';
    }

    // Email (optional but if provided must be valid)
    if (dto.email && !this.validateEmail(dto.email)) {
      errors.email = 'Invalid email format';
    }

    // Phone (optional but if provided must be valid)
    if (dto.phone && !this.validatePhone(dto.phone)) {
      errors.phone = 'Invalid phone format';
    }

    // Tax regime
    if (!dto.tax_regime) {
      errors.tax_regime = 'Tax regime is required';
    } else if (!this.validateTaxRegime(dto.tax_regime)) {
      errors.tax_regime = `Invalid tax regime. Must be one of: ${Object.values(TaxRegimeEnum).join(', ')}`;
    }

    // Fiscal year start (optional)
    if (dto.fiscal_year_start && !this.validateFiscalYearStart(dto.fiscal_year_start)) {
      errors.fiscal_year_start = 'Invalid fiscal year start (month: 1-12, day: 1-31)';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Valida DTO para atualização (todos os campos opcionais)
   */
  static validateUpdateDTO(dto: UpdateCompanyDTO): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    // Name (optional but if provided must be valid)
    if (dto.name && !this.validateName(dto.name)) {
      errors.name = 'Company name must be between 3 and 255 characters';
    }

    // Email (optional but if provided must be valid)
    if (dto.email && !this.validateEmail(dto.email)) {
      errors.email = 'Invalid email format';
    }

    // Phone (optional but if provided must be valid)
    if (dto.phone && !this.validatePhone(dto.phone)) {
      errors.phone = 'Invalid phone format';
    }

    // Tax regime (optional but if provided must be valid)
    if (dto.tax_regime && !this.validateTaxRegime(dto.tax_regime)) {
      errors.tax_regime = `Invalid tax regime. Must be one of: ${Object.values(TaxRegimeEnum).join(', ')}`;
    }

    // Fiscal year start (optional)
    if (dto.fiscal_year_start && !this.validateFiscalYearStart(dto.fiscal_year_start)) {
      errors.fiscal_year_start = 'Invalid fiscal year start (month: 1-12, day: 1-31)';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
