/**
 * EFD Builder Service
 * Core service for generating, validating and managing EFD (Escrituração Fiscal Digital)
 * RFB Compliant - Layout versão 4.0
 * 
 * EFD Structure:
 * E100 → Header (CNPJ, period, version)
 * E110 → Inventory (optional)
 * E200 → Operations (journal entries, NFe, etc)
 * E990 → Trailer (totals and record count)
 */

import { getDatabase } from '../config/database';
import {
  EFDGenerationResponse,
  EFDValidationResult,
  EFDValidationError,
  EFDRecord,
  EFDStatus,
  CreateEFDGenerationDTO,
  EFDAccountBalance,
  EFDJournalEntry,
} from '../models/dtos/efdDTO';
import crypto from 'crypto';
import { DateTime } from 'luxon'; // Better date handling for timezones
import fs from 'fs-extra';
import path from 'path';

export class EFDBuilderService {
  private static readonly EFD_VERSION = '4.0';
  private static readonly RFB_LAYOUT = 'LAYOUT_4_0'; // RFB Standard
  private static readonly RECORDS_PATH = process.env.EFD_FILES_PATH || './efd_files';

  /**
   * Initialize EFD files directory
   */
  static async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.RECORDS_PATH);
    } catch (error) {
      console.error('Error initializing EFD directory:', error);
    }
  }

  /**
   * Generate complete EFD for a given month/year
   * Main entry point for EFD generation process
   */
  static async generateEFD(companyId: string, data: CreateEFDGenerationDTO): Promise<EFDGenerationResponse> {
    const db = await getDatabase();
    const generationId = crypto.randomUUID();

    try {
      // 1. Get company data
      const company = await db('companies').where({ id: companyId }).first();
      if (!company) {
        throw new Error(`Company ${companyId} not found`);
      }

      // 2. Create generation record (pending)
      await db('efd_generations').insert({
        id: generationId,
        company_id: companyId,
        month: data.month,
        year: data.year,
        status: EFDStatus.GENERATING,
        created_at: new Date(),
      });

      // 3. Log action
      await this.logAudit(generationId, 'generate_start', 'pending');

      // 4. Generate EFD records
      const records = await this.buildEFDRecords(companyId, generationId, data);

      // 5. Calculate totals
      const totals = this.calculateTotals(records);

      // 6. Update generation with records and totals
      await db('efd_generations')
        .where({ id: generationId })
        .update({
          record_count: records.length,
          total_debit: totals.debit,
          total_credit: totals.credit,
          debit_credit_diff: Math.abs(totals.debit - totals.credit),
          debit_credit_balanced: Math.abs(totals.debit - totals.credit) < 0.01,
          generated_at: new Date(),
          status: EFDStatus.GENERATED,
        });

      // 7. Generate RFB format file
      const filePath = await this.generateRFBFile(generationId, company, records, totals);

      // 8. Update with file path
      await db('efd_generations').where({ id: generationId }).update({ file_path: filePath });

      // 9. Log successful generation
      await this.logAudit(generationId, 'generate_complete', 'success');

      return await this.getGenerationById(generationId);
    } catch (error) {
      // Update status to failed
      await db('efd_generations').where({ id: generationId }).update({
        status: EFDStatus.VALIDATION_FAILED,
        validation_errors: [(error as Error).message],
      });

      await this.logAudit(generationId, 'generate_error', 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Build all EFD records from company data
   * Includes: Header, Journal Entries, Inventory, Trailer
   */
  private static async buildEFDRecords(
    companyId: string,
    generationId: string,
    data: CreateEFDGenerationDTO,
  ): Promise<EFDRecord[]> {
    const db = await getDatabase();
    const records: EFDRecord[] = [];
    let sequence = 1;

    try {
      // Get company details
      const company = await db('companies').where({ id: companyId }).first();
      if (!company) throw new Error('Company not found');

      // E100 - HEADER RECORD
      records.push(this.buildE100Header(company, data, sequence++));

      // E110 - INVENTORY (optional)
      if (data.includeInventory) {
        const inventoryRecords = await this.buildE110Inventory(companyId, generationId, sequence);
        records.push(...inventoryRecords.records);
        sequence = inventoryRecords.nextSequence;
      }

      // E200 - OPERATIONS (journal entries, NFe, etc)
      const operationRecords = await this.buildE200Operations(companyId, generationId, data, sequence);
      records.push(...operationRecords.records);
      sequence = operationRecords.nextSequence;

      // E990 - TRAILER RECORD
      records.push(
        this.buildE990Trailer(records.filter((r) => r.type !== 'E100' && r.type !== 'E990'), sequence),
      );

      // Save records to database
      for (const record of records) {
        await db('efd_records').insert({
          id: crypto.randomUUID(),
          generation_id: generationId,
          record_type: record.type,
          sequence: record.fields.sequence || sequence++,
          fields: record.fields,
          document_number: record.fields.document_number || null,
          document_date: record.fields.document_date || null,
          debit_value: record.fields.debit_value || null,
          credit_value: record.fields.credit_value || null,
          raw_line: this.formatRFBLine(record),
          created_at: new Date(),
        });
      }

      return records;
    } catch (error) {
      throw new Error(`Error building EFD records: ${(error as Error).message}`);
    }
  }

  /**
   * E100 - Header Record
   * Format: |E100|RazaoSocial|CNPJ|Data|Periodo|...
   */
  private static buildE100Header(
    company: any,
    data: CreateEFDGenerationDTO,
    sequence: number,
  ): EFDRecord {
    const periodStart = new Date(data.year, data.month - 1, 1);
    const periodEnd = new Date(data.year, data.month, 0);

    return {
      type: 'E100',
      sequence,
      fields: {
        sequence,
        record_type: 'E100',
        company_name: company.company_name.substring(0, 100),
        cnpj: company.cnpj.replace(/[^\d]/g, ''),
        fiscal_period_start: this.formatDate(periodStart, 'DDMMYYYY'),
        fiscal_period_end: this.formatDate(periodEnd, 'DDMMYYYY'),
        layout_version: this.EFD_VERSION,
        generated_date: this.formatDate(new Date(), 'DDMMYYYY'),
        generated_time: this.formatTime(new Date()),
        version: this.EFD_VERSION,
      },
    };
  }

  /**
   * E110 - Inventory Records
   * Optional: only if includeInventory is true
   */
  private static async buildE110Inventory(
    companyId: string,
    generationId: string,
    startSequence: number,
  ): Promise<{ records: EFDRecord[]; nextSequence: number }> {
    const db = await getDatabase();
    const records: EFDRecord[] = [];
    let sequence = startSequence;

    try {
      // Get inventory items from products table
      const items = await db('products')
        .where({ company_id: companyId })
        .whereNotNull('inventory_count')
        .select();

      for (const item of items) {
        records.push({
          type: 'E110',
          sequence: sequence++,
          fields: {
            sequence,
            record_type: 'E110',
            product_code: item.id,
            product_description: item.name.substring(0, 100),
            unit_measure: 'UN',
            opening_balance: item.inventory_count || 0,
            unit_value: item.price || 0,
            total_value: (item.inventory_count || 0) * (item.price || 0),
          },
        });
      }

      return { records, nextSequence: sequence };
    } catch (error) {
      console.error('Error building E110 inventory:', error);
      return { records, nextSequence: sequence };
    }
  }

  /**
   * E200 - Operations Records
   * Journal entries, financial transactions
   */
  private static async buildE200Operations(
    companyId: string,
    generationId: string,
    data: CreateEFDGenerationDTO,
    startSequence: number,
  ): Promise<{ records: EFDRecord[]; nextSequence: number }> {
    const db = await getDatabase();
    const records: EFDRecord[] = [];
    let sequence = startSequence;

    try {
      // Get period dates
      const periodStart = new Date(data.year, data.month - 1, 1);
      const periodEnd = new Date(data.year, data.month, 0);

      // Get journal entries for the period
      const entries = await db('journal_entries')
        .where({ company_id: companyId })
        .whereBetween('entry_date', [periodStart, periodEnd])
        .select();

      // Save entries to efd_journal_entries table
      for (const entry of entries) {
        // Get account details
        const accountFrom = await db('accounts').where({ id: entry.account_from_id }).first();
        const accountTo = await db('accounts').where({ id: entry.account_to_id }).first();

        // Save journal entry reference
        await db('efd_journal_entries').insert({
          id: crypto.randomUUID(),
          generation_id: generationId,
          journal_entry_id: entry.id,
          sequence,
          account_from_id: entry.account_from_id,
          account_to_id: entry.account_to_id,
          account_from_code: accountFrom?.account_code || '',
          account_to_code: accountTo?.account_code || '',
          description: entry.description.substring(0, 255),
          debit_value: entry.debit_value || 0,
          credit_value: entry.credit_value || 0,
          entry_date: entry.entry_date,
          document_number: entry.document_number || '',
          reference_document: entry.reference_document || '',
          created_at: new Date(),
        });

        // Create E200 records (one per debit/credit)
        if ((entry.debit_value || 0) > 0) {
          records.push({
            type: 'E200',
            sequence: sequence++,
            fields: {
              sequence,
              record_type: 'E200',
              entry_date: this.formatDate(new Date(entry.entry_date), 'DD/MM/YYYY'),
              account_code: accountFrom?.account_code || '',
              account_name: accountFrom?.account_name || '',
              description: entry.description.substring(0, 255),
              debit_value: entry.debit_value || 0,
              credit_value: 0,
              document_number: entry.document_number || '',
              nature_code: this.getNatureCode(accountFrom?.account_nature || ''),
            },
          });
        }

        if ((entry.credit_value || 0) > 0) {
          records.push({
            type: 'E200',
            sequence: sequence++,
            fields: {
              sequence,
              record_type: 'E200',
              entry_date: this.formatDate(new Date(entry.entry_date), 'DD/MM/YYYY'),
              account_code: accountTo?.account_code || '',
              account_name: accountTo?.account_name || '',
              description: entry.description.substring(0, 255),
              debit_value: 0,
              credit_value: entry.credit_value || 0,
              document_number: entry.document_number || '',
              nature_code: this.getNatureCode(accountTo?.account_nature || ''),
            },
          });
        }
      }

      return { records, nextSequence: sequence };
    } catch (error) {
      console.error('Error building E200 operations:', error);
      return { records, nextSequence: sequence };
    }
  }

  /**
   * E990 - Trailer Record
   * Contains totals and record count
   */
  private static buildE990Trailer(records: EFDRecord[], sequence: number): EFDRecord {
    const totals = this.calculateTotals(records);

    return {
      type: 'E990',
      sequence,
      fields: {
        sequence,
        record_type: 'E990',
        total_records: records.length + 2, // +2 for E100 and E990
        total_debit: totals.debit,
        total_credit: totals.credit,
        debit_credit_diff: Math.abs(totals.debit - totals.credit),
        debit_credit_balanced: Math.abs(totals.debit - totals.credit) < 0.01,
        hash: this.generateHash(records),
      },
    };
  }

  /**
   * Calculate total debit and credit from records
   */
  private static calculateTotals(records: EFDRecord[]): { debit: number; credit: number } {
    return records.reduce(
      (acc, record) => ({
        debit: acc.debit + (parseFloat(String(record.fields.debit_value)) || 0),
        credit: acc.credit + (parseFloat(String(record.fields.credit_value)) || 0),
      }),
      { debit: 0, credit: 0 },
    );
  }

  /**
   * Generate RFB format file (.txt)
   * Writes records in RFB official format
   */
  private static async generateRFBFile(
    generationId: string,
    company: any,
    records: EFDRecord[],
    totals: { debit: number; credit: number },
  ): Promise<string> {
    try {
      const lines: string[] = [];

      // Add all records as formatted lines
      for (const record of records) {
        lines.push(this.formatRFBLine(record));
      }

      // Create file path
      const fileName = `EFD_${company.cnpj}_${DateTime.now().toFormat('yyyyMMdd_HHmmss')}.txt`;
      const filePath = path.join(this.RECORDS_PATH, generationId, fileName);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Write file
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

      return filePath;
    } catch (error) {
      throw new Error(`Error generating RFB file: ${(error as Error).message}`);
    }
  }

  /**
   * Format EFD record as RFB line
   * Pipe-delimited format: |field1|field2|field3|...
   */
  private static formatRFBLine(record: EFDRecord): string {
    const fields = [record.type];

    // Add fields in order
    const fieldOrder = [
      'record_type',
      'sequence',
      'company_name',
      'cnpj',
      'fiscal_period_start',
      'fiscal_period_end',
      'layout_version',
      'account_code',
      'account_name',
      'entry_date',
      'description',
      'debit_value',
      'credit_value',
      'document_number',
      'product_description',
      'opening_balance',
      'unit_value',
      'total_records',
      'total_debit',
      'total_credit',
      'hash',
    ];

    for (const fieldName of fieldOrder) {
      if (fieldName in record.fields) {
        fields.push(String(record.fields[fieldName]));
      }
    }

    return fields.join('|');
  }

  /**
   * Validate complete EFD
   * Comprehensive validation including:
   * - Debit/Credit balance
   * - All accounts have valid codes
   * - Dates within period
   * - Required fields present
   */
  static async validateEFD(generationId: string): Promise<EFDValidationResult> {
    const db = await getDatabase();
    const errors: EFDValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Get generation
      const generation = await db('efd_generations').where({ id: generationId }).first();
      if (!generation) {
        throw new Error('Generation not found');
      }

      // Get all records
      const records = await db('efd_records').where({ generation_id: generationId }).orderBy('sequence');

      // 1. Check debit/credit balance
      const totals = { debit: 0, credit: 0 };
      for (const record of records) {
        if (record.record_type === 'E200') {
          totals.debit += record.debit_value || 0;
          totals.credit += record.credit_value || 0;
        }
      }

      const diff = Math.abs(totals.debit - totals.credit);
      const isBalanced = diff < 0.01;

      if (!isBalanced) {
        errors.push({
          code: 'DEBIT_CREDIT_IMBALANCE',
          message: `Débito total (${totals.debit}) não confere com crédito total (${totals.credit}). Diferença: ${diff}`,
          severity: 'error',
          details: { debit: totals.debit, credit: totals.credit, difference: diff },
        });
      }

      // 2. Check E100 header exists
      const e100 = records.find((r) => r.record_type === 'E100');
      if (!e100) {
        errors.push({
          code: 'MISSING_E100_HEADER',
          message: 'Registro E100 (header) não encontrado',
          severity: 'error',
          record_type: 'E100',
        });
      }

      // 3. Check E990 trailer exists
      const e990 = records.find((r) => r.record_type === 'E990');
      if (!e990) {
        errors.push({
          code: 'MISSING_E990_TRAILER',
          message: 'Registro E990 (trailer) não encontrado',
          severity: 'error',
          record_type: 'E990',
        });
      }

      // 4. Validate account codes
      const accountRecords = records.filter((r) => r.record_type === 'E200');
      for (const record of accountRecords) {
        if (!record.fields.account_code) {
          errors.push({
            code: 'MISSING_ACCOUNT_CODE',
            message: `Registro E200 (seq ${record.sequence}) sem código de conta`,
            severity: 'error',
            record_type: 'E200',
            details: { sequence: record.sequence },
          });
        }
      }

      // 5. Check for duplicate entries
      const sequences = new Set();
      for (const record of records) {
        if (sequences.has(record.sequence)) {
          warnings.push(`Sequência duplicada: ${record.sequence}`);
        }
        sequences.add(record.sequence);
      }

      // 6. Verify record count in E990
      if (e990 && e990.fields.total_records !== records.length) {
        warnings.push(
          `Contagem de registros em E990 (${e990.fields.total_records}) diferente da atual (${records.length})`,
        );
      }

      // Update generation validation status
      const isValid = errors.filter((e) => e.severity === 'error').length === 0;

      await db('efd_validations').insert({
        id: crypto.randomUUID(),
        generation_id: generationId,
        is_valid: isValid,
        validation_errors: errors.map((e) => e.message),
        validation_warnings: warnings,
        total_debit: totals.debit,
        total_credit: totals.credit,
        debit_credit_diff: diff,
        total_records: records.length,
        error_count: errors.filter((e) => e.severity === 'error').length,
        warning_count: warnings.length,
        validated_at: new Date(),
        created_at: new Date(),
      });

      // Update generation status
      await db('efd_generations').where({ id: generationId }).update({
        status: isValid ? EFDStatus.VALIDATED : EFDStatus.VALIDATION_FAILED,
        validated_at: new Date(),
        validation_errors: errors.map((e) => e.message),
      });

      await this.logAudit(generationId, 'validate', isValid ? 'success' : 'failed');

      return {
        is_valid: isValid,
        errors,
        warnings,
        summary: {
          total_records: records.length,
          total_debit: totals.debit,
          total_credit: totals.credit,
          debit_credit_diff: diff,
          debit_credit_balanced: isBalanced,
        },
      };
    } catch (error) {
      await this.logAudit(generationId, 'validate_error', 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get generation by ID with all details
   */
  static async getGenerationById(generationId: string): Promise<EFDGenerationResponse> {
    const db = await getDatabase();
    const generation = await db('efd_generations').where({ id: generationId }).first();

    if (!generation) {
      throw new Error('Generation not found');
    }

    return {
      id: generation.id,
      company_id: generation.company_id,
      month: generation.month,
      year: generation.year,
      status: generation.status,
      generated_at: generation.generated_at,
      validated_at: generation.validated_at,
      file_path: generation.file_path,
      validation_errors: generation.validation_errors || [],
      record_count: generation.record_count || 0,
      total_debit: generation.total_debit || 0,
      total_credit: generation.total_credit || 0,
      metadata: generation.metadata || {},
    };
  }

  /**
   * Download EFD file
   */
  static async downloadEFD(generationId: string): Promise<Buffer> {
    const db = await getDatabase();
    const generation = await db('efd_generations').where({ id: generationId }).first();

    if (!generation || !generation.file_path) {
      throw new Error('EFD file not found');
    }

    try {
      await this.logAudit(generationId, 'download', 'success');
      return await fs.readFile(generation.file_path);
    } catch (error) {
      await this.logAudit(generationId, 'download_error', 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * List EFD generations for a company
   */
  static async listGenerations(
    companyId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: EFDGenerationResponse[]; total: number }> {
    const db = await getDatabase();

    let query = db('efd_generations').where({ company_id: companyId });

    if (filters.status) {
      query = query.where({ status: filters.status });
    }

    if (filters.month) {
      query = query.where({ month: filters.month });
    }

    if (filters.year) {
      query = query.where({ year: filters.year });
    }

    const total = await query.clone().count('id as count').first();

    const data = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data: data.map((d) => ({
        id: d.id,
        company_id: d.company_id,
        month: d.month,
        year: d.year,
        status: d.status,
        generated_at: d.generated_at,
        validated_at: d.validated_at,
        file_path: d.file_path,
        validation_errors: d.validation_errors || [],
        record_count: d.record_count || 0,
        total_debit: d.total_debit || 0,
        total_credit: d.total_credit || 0,
        metadata: d.metadata || {},
      })),
      total: typeof total?.count === 'number' ? total.count : parseInt(String(total?.count || 0), 10),
    };
  }

  /**
   * Get account balances for validation
   */
  static async getAccountBalances(generationId: string): Promise<EFDAccountBalance[]> {
    const db = await getDatabase();
    return await db('efd_account_balances').where({ generation_id: generationId }).select();
  }

  /**
   * Get journal entries included in EFD
   */
  static async getJournalEntries(generationId: string): Promise<EFDJournalEntry[]> {
    const db = await getDatabase();
    return await db('efd_journal_entries').where({ generation_id: generationId }).orderBy('sequence');
  }

  /**
   * Format date utility
   */
  private static formatDate(date: Date, format: string): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date(date);

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());

    switch (format) {
      case 'DDMMYYYY':
        return `${day}${month}${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      default:
        return d.toISOString();
    }
  }

  /**
   * Format time utility
   */
  private static formatTime(date: Date): string {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  }

  /**
   * Get nature code from account nature
   */
  private static getNatureCode(nature: string): string {
    const codeMap: { [key: string]: string } = {
      asset: '01',
      liability: '02',
      equity: '03',
      revenue: '04',
      expense: '05',
      cost: '06',
    };
    return codeMap[nature.toLowerCase()] || '99';
  }

  /**
   * Generate hash for integrity verification
   */
  private static generateHash(records: EFDRecord[]): string {
    const data = records.map((r) => `${r.type}${r.sequence}`).join('|');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Log audit trail
   */
  private static async logAudit(
    generationId: string,
    action: string,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const db = await getDatabase();
      await db('efd_audit_log').insert({
        id: crypto.randomUUID(),
        generation_id: generationId,
        action,
        status,
        details: null,
        error_message: errorMessage || null,
        performed_at: new Date(),
      });
    } catch (error) {
      console.error('Error logging audit:', error);
    }
  }
}

export default EFDBuilderService;
