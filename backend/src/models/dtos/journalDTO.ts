/**
 * Journal Entry Data Transfer Objects (DTOs)
 * Validação e tipagem de dados para lançamentos contábeis
 * Implementa partidas dobradas (Lei 6.404/76)
 */

/**
 * Tipo de documento de referência
 */
export enum ReferenceTypeEnum {
  NF = 'NF',         // Nota Fiscal
  RPA = 'RPA',       // Recibo de Pagamento Autônomo
  CHEQUE = 'CHEQUE', // Cheque
  BOLETO = 'BOLETO', // Boleto Bancário
  MANUAL = 'MANUAL', // Lançamento Manual
}

/**
 * Status do lançamento
 */
export enum JournalStatusEnum {
  DRAFT = 'DRAFT',     // Rascunho - pode ser editado/deletado
  POSTED = 'POSTED',   // Postado - imutável (is_posted=true)
}

/**
 * Linha de lançamento (partida)
 */
export interface JournalLineDTO {
  account_id: string;         // UUID da conta contábil
  debit: number;              // Valor débito (>= 0)
  credit: number;             // Valor crédito (>= 0)
  description?: string;       // Descrição da linha (máx 500)
  cost_center_id?: string;    // UUID do centro de custo (opcional)
}

/**
 * DTO para criar lançamento contábil
 * POST /companies/:id/journal-entries
 * Requer: ACCOUNTANT ou ADMIN
 */
export interface CreateJournalEntryDTO {
  entry_date: string;                   // Data (YYYY-MM-DD)
  description?: string;                 // Descrição geral (máx 500)
  reference_type?: ReferenceTypeEnum | string; // Tipo doc origem
  reference_number?: string;            // Número doc origem (máx 50)
  reference_issuer?: string;            // Emissor doc (máx 255)
  lines: JournalLineDTO[];              // Linhas (mín 2 = 1 débito + 1 crédito)
}

/**
 * DTO para atualizar lançamento (apenas DRAFT)
 * PUT /companies/:id/journal-entries/:entryId
 * Requer: ACCOUNTANT ou ADMIN
 * RESTRIÇÃO: apenas lançamentos não-postados
 */
export interface UpdateJournalEntryDTO {
  entry_date?: string;
  description?: string;
  reference_type?: ReferenceTypeEnum | string;
  reference_number?: string;
  reference_issuer?: string;
  lines?: JournalLineDTO[];
}

/**
 * Linha de lançamento na resposta
 */
export interface JournalLineResponse {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  cost_center_id?: string;
  debit: number;
  credit: number;
  description?: string;
  line_number: number;
}

/**
 * Resposta de lançamento contábil
 */
export interface JournalEntryResponse {
  id: string;
  company_id: string;
  created_by: string;
  entry_date: string;
  description?: string;
  reference_type?: string;
  reference_number?: string;
  reference_issuer?: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  data_hash?: string;
  lines?: JournalLineResponse[];
  created_at: string;
  updated_at: string;
}

/**
 * Resposta paginada
 */
export interface PaginatedJournalResponse {
  data: JournalEntryResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Filtros para listagem
 */
export interface JournalFilters {
  page?: number;
  limit?: number;
  date_from?: string;    // YYYY-MM-DD
  date_to?: string;      // YYYY-MM-DD
  is_posted?: boolean;
  reference_type?: string;
  search?: string;       // busca em description/reference_number
  account_id?: string;   // filtrar por conta afetada
}

/**
 * Validador de DTOs
 */
export class JournalDTOValidator {
  static validateCreateDTO(data: CreateJournalEntryDTO): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    // entry_date obrigatório
    if (!data.entry_date) {
      errors.entry_date = 'Data do lançamento é obrigatória';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.entry_date)) {
      errors.entry_date = 'Data deve estar no formato YYYY-MM-DD';
    } else {
      const date = new Date(data.entry_date);
      if (isNaN(date.getTime())) {
        errors.entry_date = 'Data inválida';
      }
    }

    // description (opcional, máx 500)
    if (data.description && data.description.length > 500) {
      errors.description = 'Descrição deve ter no máximo 500 caracteres';
    }

    // reference_type (enum)
    if (data.reference_type) {
      const validTypes = Object.values(ReferenceTypeEnum);
      if (!validTypes.includes(data.reference_type as ReferenceTypeEnum)) {
        errors.reference_type = `Tipo de referência inválido. Valores aceitos: ${validTypes.join(', ')}`;
      }
    }

    // reference_number (máx 50)
    if (data.reference_number && data.reference_number.length > 50) {
      errors.reference_number = 'Número de referência deve ter no máximo 50 caracteres';
    }

    // reference_issuer (máx 255)
    if (data.reference_issuer && data.reference_issuer.length > 255) {
      errors.reference_issuer = 'Emissor deve ter no máximo 255 caracteres';
    }

    // lines obrigatório, mínimo 2
    if (!data.lines || !Array.isArray(data.lines)) {
      errors.lines = 'Linhas de lançamento são obrigatórias';
    } else if (data.lines.length < 2) {
      errors.lines = 'Um lançamento deve ter pelo menos 2 linhas (partidas dobradas)';
    } else {
      // Validar cada linha
      let totalDebit = 0;
      let totalCredit = 0;

      data.lines.forEach((line, index) => {
        const prefix = `lines[${index}]`;

        if (!line.account_id) {
          errors[`${prefix}.account_id`] = 'Conta contábil é obrigatória';
        } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.account_id)) {
          errors[`${prefix}.account_id`] = 'ID da conta deve ser um UUID válido';
        }

        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;

        if (debit < 0) {
          errors[`${prefix}.debit`] = 'Débito não pode ser negativo';
        }
        if (credit < 0) {
          errors[`${prefix}.credit`] = 'Crédito não pode ser negativo';
        }
        if (debit === 0 && credit === 0) {
          errors[`${prefix}.value`] = 'Linha deve ter débito OU crédito maior que zero';
        }
        if (debit > 0 && credit > 0) {
          errors[`${prefix}.value`] = 'Linha não pode ter débito E crédito simultaneamente';
        }

        if (line.description && line.description.length > 500) {
          errors[`${prefix}.description`] = 'Descrição da linha deve ter no máximo 500 caracteres';
        }

        totalDebit += debit;
        totalCredit += credit;
      });

      // Validar equilíbrio (partidas dobradas)
      if (Object.keys(errors).filter(k => k.startsWith('lines')).length === 0) {
        if (Math.abs(totalDebit - totalCredit) >= 0.01) {
          errors.balance = `Lançamento desbalanceado: débitos (${totalDebit.toFixed(2)}) ≠ créditos (${totalCredit.toFixed(2)})`;
        }
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  static validateUpdateDTO(data: UpdateJournalEntryDTO): { isValid: boolean; errors: Record<string, string> } {
    // Reusar criação com dados parciais
    const partial: CreateJournalEntryDTO = {
      entry_date: data.entry_date || '2000-01-01', // dummy se não presente
      lines: data.lines || [
        { account_id: '00000000-0000-0000-0000-000000000000', debit: 1, credit: 0 },
        { account_id: '00000000-0000-0000-0000-000000000001', debit: 0, credit: 1 },
      ],
      description: data.description,
      reference_type: data.reference_type,
      reference_number: data.reference_number,
      reference_issuer: data.reference_issuer,
    };

    const result = this.validateCreateDTO(partial);

    // Remover erros de campos não fornecidos
    if (!data.entry_date) delete result.errors.entry_date;
    if (!data.lines) {
      Object.keys(result.errors).filter(k => k.startsWith('lines') || k === 'balance').forEach(k => delete result.errors[k]);
    }

    return { isValid: Object.keys(result.errors).length === 0, errors: result.errors };
  }
}
