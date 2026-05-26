/**
 * Bank Reconciliation Service
 * Lógica de negócio para:
 * - Upload e parsing de extratos bancários
 * - Identificação automática do banco
 * - Matching inteligente (fuzzy matching com Levenshtein distance)
 * - Sugestões de reconciliação com scores de confiança
 * - Execução de reconciliação
 */

import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  BankTransactionDTO,
  BankReconciliationUploadDTO,
  BankReconciliationUploadResponse,
  ReconciliationSuggestion,
  GetSuggestionsResponse,
  ExecuteReconciliationResponse,
  AcceptedSuggestionInput,
  CSVParseResult,
  BankIdentificationResult,
  BANK_PROFILES,
  BankProfile,
} from '../models/dtos/bankReconciliationDTO';

/**
 * BankReconciliationService
 * Gerencia todo o fluxo de reconciliação bancária
 */
export class BankReconciliationService {
  /**
   * =====================================================
   * STEP 1: CSV PARSING
   * =====================================================
   */

  /**
   * Parse arquivo CSV e extrai transações
   * Suporta vários formatos de banco
   */
  static async parseCSVFile(fileBuffer: Buffer, fileName: string): Promise<CSVParseResult> {
    try {
      const fileContent = fileBuffer.toString('utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return {
          bank_name: 'generic',
          transactions: [],
          errors: ['Arquivo CSV vazio ou com poucas linhas'],
        };
      }

      // Identificar banco pelas headers
      const headerLine = lines[0];
      const bankId = this.identifyBank(headerLine);
      const bankProfile = BANK_PROFILES[bankId];

      // Extrair coluna de separador
      const separator = this.detectSeparator(headerLine);
      const dataLines = lines.slice(1); // Skip header

      const transactions: BankTransactionDTO[] = [];
      const errors: string[] = [];

      for (let i = 0; i < dataLines.length; i++) {
        try {
          const fields = dataLines[i].split(separator).map(f => f.trim());

          // Skip linhas vazias
          if (fields.every(f => !f)) continue;

          const tx = this.parseTransactionLine(fields, bankProfile, bankProfile.dateFormat);
          if (tx) {
            transactions.push(tx);
          }
        } catch (err) {
          errors.push(`Linha ${i + 2}: ${(err as Error).message}`);
          logger.warn('Error parsing transaction line', {
            line: i + 2,
            error: (err as Error).message,
          });
        }
      }

      return {
        bank_name: bankProfile.name,
        transactions,
        errors,
      };
    } catch (err) {
      logger.error('Error parsing CSV file', { error: (err as Error).message });
      throw Object.assign(
        new Error(`Erro ao fazer parse do CSV: ${(err as Error).message}`),
        { status: 400 },
      );
    }
  }

  /**
   * =====================================================
   * STEP 2: BANK IDENTIFICATION
   * =====================================================
   */

  /**
   * Identifica banco pela análise de headers e conteúdo
   * Retorna ID do perfil de banco
   */
  static identifyBank(headerLine: string): string {
    const lowerHeader = headerLine.toLowerCase();

    for (const [bankId, profile] of Object.entries(BANK_PROFILES)) {
      if (bankId === 'generic') continue; // Skip generic, é fallback

      for (const identifier of profile.identifier) {
        if (lowerHeader.includes(identifier.toLowerCase())) {
          logger.info('Bank identified', { bank: profile.name });
          return bankId;
        }
      }
    }

    // Fallback: generic
    logger.info('Using generic bank profile (no specific bank identified)');
    return 'generic';
  }

  /**
   * Detecta o separador do CSV (';' ou ',')
   */
  static detectSeparator(headerLine: string): string {
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;

    return semicolonCount >= commaCount ? ';' : ',';
  }

  /**
   * =====================================================
   * STEP 3: TRANSACTION PARSING
   * =====================================================
   */

  /**
   * Parse uma linha do CSV e converte em BankTransactionDTO
   */
  static parseTransactionLine(
    fields: string[],
    bankProfile: BankProfile,
    dateFormat: string,
  ): BankTransactionDTO | null {
    const { columnMapping } = bankProfile;

    // Validar campos obrigatórios
    if (
      fields.length <= columnMapping.dateColumn ||
      fields.length <= columnMapping.descriptionColumn
    ) {
      return null;
    }

    const dateStr = fields[columnMapping.dateColumn];
    const description = fields[columnMapping.descriptionColumn];
    const debitStr = fields[columnMapping.debitColumn] || '';
    const creditStr = fields[columnMapping.creditColumn] || '';

    // Parse data
    const transactionDate = this.parseDate(dateStr, dateFormat);
    if (!transactionDate) {
      throw new Error(`Data inválida: "${dateStr}"`);
    }

    // Parse valores
    const debit = this.parseAmount(debitStr);
    const credit = this.parseAmount(creditStr);

    // Validar que há pelo menos débito ou crédito
    if (debit === 0 && credit === 0) {
      return null; // Skip linhas sem valor
    }

    // Determinar tipo e amount
    const amount = debit > 0 ? debit : credit;
    const type: 'debit' | 'credit' = debit > 0 ? 'debit' : 'credit';

    // Parse saldo (opcional)
    const bankBalance = columnMapping.balanceColumn
      ? this.parseAmount(fields[columnMapping.balanceColumn] || '')
      : undefined;

    return {
      transaction_date: transactionDate,
      description: description.trim(),
      amount,
      type,
      bank_balance: bankBalance || undefined,
    };
  }

  /**
   * Parse data com vários formatos
   * Retorna YYYY-MM-DD ou null
   */
  static parseDate(dateStr: string, format: string): string | null {
    if (!dateStr || !dateStr.trim()) return null;

    try {
      let date: Date;

      if (format === 'DD/MM/YYYY') {
        const [day, month, year] = dateStr.split('/');
        date = new Date(`${year}-${month}-${day}`);
      } else if (format === 'YYYY-MM-DD') {
        date = new Date(dateStr);
      } else {
        // Tentar parse genérico
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) {
        return null;
      }

      // Retornar em formato ISO
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  /**
   * Parse valor monetário
   * Suporta: "1000,50", "1,000.50", "1000.50"
   */
  static parseAmount(valueStr: string): number {
    if (!valueStr || !valueStr.trim()) return 0;

    // Remove espaços
    const cleaned = valueStr.trim();

    // Detectar formato
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    let amount: number;

    if (hasComma && hasDot) {
      // Formato com ambos: determinar qual é decimal
      const lastCommaIndex = cleaned.lastIndexOf(',');
      const lastDotIndex = cleaned.lastIndexOf('.');

      if (lastDotIndex > lastCommaIndex) {
        // Formato US: 1,000.50
        amount = parseFloat(cleaned.replace(/,/g, ''));
      } else {
        // Formato BR: 1.000,50
        amount = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      }
    } else if (hasComma) {
      // Apenas vírgula: formato BR 1000,50
      amount = parseFloat(cleaned.replace(',', '.'));
    } else if (hasDot) {
      // Apenas ponto: formato US 1000.50
      amount = parseFloat(cleaned);
    } else {
      // Sem separadores
      amount = parseFloat(cleaned);
    }

    return isNaN(amount) ? 0 : Math.round(amount * 100) / 100;
  }

  /**
   * =====================================================
   * STEP 4: FUZZY MATCHING (IA CORE)
   * =====================================================
   */

  /**
   * Calcula Levenshtein distance entre duas strings
   * Usado para matching de descrições
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    const len1 = s1.length;
    const len2 = s2.length;

    // Matriz de DP
    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      dp[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost, // substitution
        );
      }
    }

    return dp[len1][len2];
  }

  /**
   * Calcula score de similaridade de string (0-1)
   * Baseado em Levenshtein distance
   */
  static calculateDescriptionScore(bankDesc: string, journalDesc: string): number {
    // Normalizar: remover caracteres especiais, múltiplos espaços
    const normBank = bankDesc
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const normJournal = journalDesc
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Quick win: strings idênticas
    if (normBank === normJournal) {
      return 1.0;
    }

    // Quick loss: strings muito diferentes
    if (
      !normBank.includes(normJournal.split(' ')[0]) &&
      !normJournal.includes(normBank.split(' ')[0])
    ) {
      return 0.0;
    }

    // Levenshtein distance
    const distance = this.levenshteinDistance(normBank, normJournal);
    const maxLen = Math.max(normBank.length, normJournal.length);

    // Converter distance para score (0-1)
    // Score = 1 - (distance / maxLen)
    const score = 1 - distance / maxLen;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calcula score de matching de valor
   * Exato: 1.0, Dentro de 5%: 0.8, Diferente: 0.0
   */
  static calculateAmountScore(bankAmount: number, journalAmount: number): number {
    if (bankAmount === journalAmount) {
      return 1.0;
    }

    const difference = Math.abs(bankAmount - journalAmount);
    const percentage = (difference / Math.max(bankAmount, journalAmount)) * 100;

    if (percentage === 0) return 1.0;
    if (percentage <= 0.01) return 0.99; // Diferença menor que 0.01%
    if (percentage <= 0.1) return 0.95; // Diferença menor que 0.1%
    if (percentage <= 1) return 0.9; // Diferença menor que 1%
    if (percentage <= 5) return 0.8; // Diferença menor que 5%
    if (percentage <= 10) return 0.5; // Diferença menor que 10%

    return 0.0; // Muito diferente
  }

  /**
   * Calcula score de matching de data
   * Mesma data: 1.0, ±1 dia: 0.9, ±2 dias: 0.7, ±3 dias: 0.5, >3 dias: 0.0
   */
  static calculateDateScore(bankDate: string, journalDate: string): number {
    const bDate = new Date(bankDate);
    const jDate = new Date(journalDate);

    const timeDiff = Math.abs(bDate.getTime() - jDate.getTime());
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) return 1.0;
    if (daysDiff <= 1) return 0.9;
    if (daysDiff <= 2) return 0.7;
    if (daysDiff <= 3) return 0.5;

    return 0.0;
  }

  /**
   * Gera sugestões de matching para uma transação bancária
   * Retorna todos os matches possíveis com scores
   *
   * PESOS:
   * - Descrição: 40%
   * - Valor: 40%
   * - Data: 20%
   */
  static async suggestMatchesForTransaction(
    bankTransaction: BankTransactionDTO,
    journalEntries: any[], // JournalEntry[]
  ): Promise<ReconciliationSuggestion[]> {
    const suggestions: ReconciliationSuggestion[] = [];

    for (const je of journalEntries) {
      // Pré-filtro: tipo de transação deve corresponder (débito/crédito)
      // Note: isso é heurístico, o usuário pode querer fazer outros matches

      // Calcular scores individuais
      const descriptionScore = this.calculateDescriptionScore(
        bankTransaction.description,
        je.description || '',
      );
      const amountScore = this.calculateAmountScore(bankTransaction.amount, je.total_debit || 0);
      const dateScore = this.calculateDateScore(bankTransaction.transaction_date, je.entry_date);

      // Score final: média ponderada
      const confidence = descriptionScore * 0.4 + amountScore * 0.4 + dateScore * 0.2;

      // Só incluir sugestões com confiança mínima
      if (confidence > 0.5) {
        suggestions.push({
          bank_transaction_id: '', // Será preenchido pelo controller
          bank_description: bankTransaction.description,
          bank_amount: bankTransaction.amount,
          bank_date: bankTransaction.transaction_date,
          bank_type: bankTransaction.type,

          journal_entry_id: je.id,
          journal_description: je.description || '',
          journal_amount: je.total_debit || 0,
          journal_date: je.entry_date,

          confidence: Math.round(confidence * 10000) / 10000,
          confidence_percentage: `${Math.round(confidence * 100)}%`,

          description_score: Math.round(descriptionScore * 10000) / 10000,
          amount_score: Math.round(amountScore * 10000) / 10000,
          date_score: Math.round(dateScore * 10000) / 10000,

          match_type:
            confidence > 0.95
              ? 'automatic'
              : confidence > 0.7
                ? 'manual'
                : 'unmatched',
        });
      }
    }

    // Ordenar por confiança decrescente
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * =====================================================
   * STEP 5: DATABASE OPERATIONS
   * =====================================================
   */

  /**
   * Criar upload record no banco
   */
  static async createUpload(
    companyId: string,
    userId: string,
    uploadDTO: BankReconciliationUploadDTO,
  ): Promise<BankReconciliationUploadResponse> {
    const db = await getDatabase();

    const [uploadId] = await db('bank_reconciliation_uploads').insert({
      company_id: companyId,
      file_name: uploadDTO.file_name,
      bank_name: uploadDTO.bank_name,
      transaction_count: uploadDTO.transaction_count,
      status: 'uploaded',
      created_by: userId,
    });

    // Inserir transações
    if (uploadDTO.transactions.length > 0) {
      const transactionsData = uploadDTO.transactions.map(tx => ({
        upload_id: uploadId,
        transaction_date: tx.transaction_date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        bank_balance: tx.bank_balance || null,
        document_number: tx.document_number || null,
        bank_branch_code: tx.bank_branch_code || null,
        bank_account_number: tx.bank_account_number || null,
      }));

      await db('bank_transactions').insert(transactionsData);
    }

    // Marcar como processed
    await db('bank_reconciliation_uploads')
      .where('id', uploadId)
      .update({ status: 'processed' });

    logger.info('Bank reconciliation upload created', {
      uploadId,
      companyId,
      transactionCount: uploadDTO.transaction_count,
    });

    return {
      id: String(uploadId),
      company_id: companyId,
      file_name: uploadDTO.file_name,
      bank_name: uploadDTO.bank_name,
      transaction_count: uploadDTO.transaction_count,
      status: 'processed',
      uploaded_at: new Date().toISOString(),
    };
  }

  /**
   * Buscar upload por ID com transações
   */
  static async getUpload(uploadId: string, companyId: string) {
    const db = await getDatabase();

    const upload = await db('bank_reconciliation_uploads')
      .where('id', uploadId)
      .where('company_id', companyId)
      .first();

    if (!upload) {
      throw Object.assign(new Error('Upload não encontrado'), { status: 404 });
    }

    const transactions = await db('bank_transactions').where('upload_id', uploadId);

    return { upload, transactions };
  }

  /**
   * Gerar e salvar sugestões
   */
  static async generateAndSaveSuggestions(
    uploadId: string,
    companyId: string,
  ): Promise<GetSuggestionsResponse> {
    const db = await getDatabase();

    // Buscar transações bancárias
    const bankTransactions = await db('bank_transactions').where('upload_id', uploadId);

    if (bankTransactions.length === 0) {
      return {
        upload_id: uploadId,
        total_transactions: 0,
        matched_count: 0,
        unmatched_count: 0,
        confidence_threshold: 0.7,
        suggestions: [],
      };
    }

    // Buscar lançamentos contábeis da empresa
    const journalEntries = await db('journal_entries')
      .where('company_id', companyId)
      .where('is_posted', true) // Apenas lançamentos postados
      .select('id', 'entry_date', 'description', 'total_debit', 'total_credit');

    // Gerar sugestões para cada transação
    const allSuggestions: ReconciliationSuggestion[] = [];

    for (const bankTx of bankTransactions) {
      const suggestions = await this.suggestMatchesForTransaction(bankTx, journalEntries);

      for (const suggestion of suggestions) {
        suggestion.bank_transaction_id = bankTx.id;

        // Salvar no banco
        await db('reconciliation_matches').insert({
          upload_id: uploadId,
          bank_transaction_id: bankTx.id,
          journal_entry_id: suggestion.journal_entry_id || null,
          confidence: suggestion.confidence,
          match_type: suggestion.match_type,
          description_score: suggestion.description_score,
          amount_score: suggestion.amount_score,
          date_score: suggestion.date_score,
        });

        allSuggestions.push(suggestion);
      }

      // Se não há sugestões, criar registro "unmatched"
      if (suggestions.length === 0) {
        await db('reconciliation_matches').insert({
          upload_id: uploadId,
          bank_transaction_id: bankTx.id,
          journal_entry_id: null,
          confidence: 0,
          match_type: 'unmatched',
        });
      }
    }

    // Filtrar apenas sugestões com confiança > threshold
    const threshold = 0.7;
    const filteredSuggestions = allSuggestions.filter(s => s.confidence >= threshold);

    const matchedCount = allSuggestions.filter(s => s.confidence > 0.5).length;
    const unmatchedCount = bankTransactions.length - matchedCount;

    return {
      upload_id: uploadId,
      total_transactions: bankTransactions.length,
      matched_count: matchedCount,
      unmatched_count: unmatchedCount,
      confidence_threshold: threshold,
      suggestions: filteredSuggestions.sort((a, b) => b.confidence - a.confidence),
    };
  }

  /**
   * Executar reconciliação (aceitar sugestões)
   */
  static async executeReconciliation(
    uploadId: string,
    companyId: string,
    userId: string,
    acceptedSuggestions: AcceptedSuggestionInput[],
  ): Promise<ExecuteReconciliationResponse> {
    const db = await getDatabase();
    const trx = await db.transaction();

    try {
      // Validar upload pertence à empresa
      const upload = await trx('bank_reconciliation_uploads')
        .where('id', uploadId)
        .where('company_id', companyId)
        .first();

      if (!upload) {
        throw Object.assign(new Error('Upload não encontrado'), { status: 404 });
      }

      let reconciledCount = 0;

      // Processar cada sugestão aceita
      for (const suggestion of acceptedSuggestions) {
        // Validar que journal entry pertence à empresa
        const journalEntry = await trx('journal_entries')
          .where('id', suggestion.journal_entry_id)
          .where('company_id', companyId)
          .first();

        if (!journalEntry) {
          logger.warn('Journal entry not found or not in company', {
            journalEntryId: suggestion.journal_entry_id,
            companyId,
          });
          continue;
        }

        // Atualizar reconciliation_matches
        await trx('reconciliation_matches')
          .where('upload_id', uploadId)
          .where('bank_transaction_id', suggestion.bank_transaction_id)
          .where('journal_entry_id', suggestion.journal_entry_id)
          .update({
            is_reconciled: true,
            matched_at: new Date(),
            matched_by: userId,
          });

        // Registrar no histórico
        await trx('reconciliation_history').insert({
          upload_id: uploadId,
          action: 'accepted',
          bank_transaction_id: suggestion.bank_transaction_id,
          journal_entry_id: suggestion.journal_entry_id,
          executed_by: userId,
        });

        reconciledCount++;
      }

      // Atualizar status do upload
      await trx('bank_reconciliation_uploads')
        .where('id', uploadId)
        .update({ status: 'reconciled' });

      await trx.commit();

      const totalTransactions = await db('bank_transactions')
        .where('upload_id', uploadId)
        .count('* as count')
        .first();

      const unmatchedCount = (typeof totalTransactions.count === 'string' ? parseInt(totalTransactions.count, 10) : totalTransactions.count) - reconciledCount;

      logger.info('Bank reconciliation executed', {
        uploadId,
        reconciledCount,
        unmatchedCount,
      });

      return {
        upload_id: uploadId,
        total_processed: typeof totalTransactions.count === 'string' ? parseInt(totalTransactions.count, 10) : totalTransactions.count,
        reconciled_count: reconciledCount,
        unmatched_count: unmatchedCount,
        status: 'reconciled',
      };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }
}
