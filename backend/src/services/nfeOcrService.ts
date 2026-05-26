/**
 * NfeOcrService — Extração automática de dados de NF-e via OCR
 * 
 * Suporta:
 *  - PDF parsing com pdf-parse
 *  - OCR de imagens com Tesseract.js (desabilitado por enquanto)
 *  - Extração de campos estruturados (CNPJ, NF, valor, itens)
 *  - Validação de chave de acesso (44 dígitos)
 *  - Geração de preview de lançamento contábil
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import pdfParse from 'pdf-parse';
// import * as Tesseract from 'tesseract.js'; // TODO: Install tesseract.js separately
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  NfeOcrData,
  NfeUploadResponse,
  NfeJournalEntryPreview,
  NfeUploadRecord,
  NfeRegistryRecord,
  SefazValidationResponse,
} from '../models/dtos/nfeOcrDTO';

// ─── Regex Patterns for NF-e extraction ───────────────────────────────────

const NF_PATTERNS = {
  // NF-e number: "NF-e Nº 123456" or "NF-e número: 123456"
  nf_number: /NF-?e\s*(?:Nº|número|Número|nº):?\s*(\d{1,9})/i,
  
  // NF-e series: "Série 1" or "SÉRIE: 01"
  nf_series: /série|series|série:?\s*(\d{1,3})/i,
  
  // Invoice key: 44-digit sequence
  invoice_key: /(?:chave|chave de acesso|chave nfe):?\s*(\d{44})/i,
  
  // CNPJ: XX.XXX.XXX/XXXX-XX
  cnpj: /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g,
  
  // Total value: "R$ 1.234,56" or "Total: 1234.56"
  total_value: /(?:total|valor total|vl\s*total|total\s*nf[e-]?):?\s*R?\$?\s*([\d.,]+)/i,
  
  // Emission date: DD/MM/YYYY or DD-MM-YYYY
  emission_date: /(?:emissão|data emissão|data de emissão):?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i,
  
  // Company name: Often after CNPJ
  company_name: /(?:razão social|empresa|emitente):?\s*([A-Z\s]+?)(?:\n|CNPJ|$)/i,
};

// ─── Helper Functions ──────────────────────────────────────────────────────

/** Extract value from text using regex */
function extractWithRegex(text: string, pattern: RegExp, groupIndex: number = 1): string | null {
  const match = text.match(pattern);
  return match ? match[groupIndex] : null;
}

/** Parse decimal value handling both . and , as decimal separators */
function parseDecimalValue(value: string | null): number | null {
  if (!value) return null;
  // Remove spaces, then handle . and , as decimal separators
  const cleaned = value.trim().replace(/\s/g, '');
  // If has both . and , the last one is decimal separator
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Comma is decimal, dot is thousands
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      // Dot is decimal, comma is thousands
      return parseFloat(cleaned.replace(/,/g, ''));
    }
  }
  // If only one separator, assume it's decimal
  return parseFloat(cleaned.replace(/[.,]/, '.'));
}

/** Parse date DD/MM/YYYY to ISO string */
function parseDateString(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/** Validate NF-e key format (44 digits with check digit) */
function validateInvoiceKey(key: string): boolean {
  if (!key || key.length !== 44) return false;
  if (!/^\d{44}$/.test(key)) return false;
  
  // Validate check digit (module 11)
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = key.length - 2; i >= 0; i--) {
    sum += parseInt(key[i]) * weights[(key.length - 2 - i) % 8];
  }
  const rem = sum % 11;
  const checkDigit = rem < 2 ? 0 : 11 - rem;
  return parseInt(key[43]) === checkDigit;
}

/** Format CNPJ to XX.XXX.XXX/XXXX-XX */
function formatCnpj(cnpj: string | null): string | null {
  if (!cnpj) return null;
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return null;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
}

/** Estimate extraction confidence (0-1) based on found fields */
function estimateConfidence(data: NfeOcrData): number {
  let score = 0;
  let total_fields = 0;
  
  const required_fields = ['nf_number', 'issuer_cnpj', 'total_value', 'emission_date'];
  required_fields.forEach(field => {
    total_fields++;
    if (data[field as keyof NfeOcrData]) score++;
  });
  
  // Check for optional fields
  if (data.invoice_key && validateInvoiceKey(data.invoice_key)) score += 0.5;
  if (data.items && data.items.length > 0) score += 0.5;
  total_fields += 1;
  
  return Math.min(1, score / total_fields);
}

// ─── Main OCR Service ─────────────────────────────────────────────────────

export class NfeOcrService {

  /**
   * Extract text from PDF using pdf-parse
   */
  private static async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await (pdfParse as any)(dataBuffer);
      return pdfData.text || '';
    } catch (error) {
      logger.error('PDF parsing error', { filePath, error: (error as Error).message });
      throw Object.assign(
        new Error('Falha ao extrair texto do PDF'),
        { status: 400 }
      );
    }
  }

  /**
   * Extract text from image using Tesseract.js (Portuguese language)
   */
  private static async extractTextFromImage(filePath: string): Promise<string> {
    try {
      logger.info('Starting OCR processing', { filePath });
      
      // Using Tesseract worker
      const { data: { text } } = await Tesseract.recognize(
        filePath,
        'por+eng', // Portuguese + English
        {
          logger: (m: any) => logger.debug('Tesseract progress', { progress: m.progress }),
        }
      );
      
      return text || '';
    } catch (error) {
      logger.error('OCR processing error', { filePath, error: (error as Error).message });
      throw Object.assign(
        new Error('Falha ao processar imagem com OCR'),
        { status: 400 }
      );
    }
  }

  /**
   * Parse extracted text to NF-e structured data
   */
  private static parseNfeFields(text: string): NfeOcrData {
    logger.debug('Parsing NF-e fields from text', { textLength: text.length });

    const data: NfeOcrData = {
      raw_text: text,
    };

    // Extract NF-e number
    const nf_number = extractWithRegex(text, NF_PATTERNS.nf_number);
    if (nf_number) data.nf_number = nf_number.padStart(9, '0');

    // Extract NF-e series
    const nf_series = extractWithRegex(text, NF_PATTERNS.nf_series);
    if (nf_series) data.nf_series = nf_series.padStart(3, '0');

    // Extract invoice key (chave de acesso)
    const invoice_key = extractWithRegex(text, NF_PATTERNS.invoice_key);
    if (invoice_key) {
      data.invoice_key = invoice_key;
      if (!validateInvoiceKey(invoice_key)) {
        logger.warn('Invalid invoice key format', { invoice_key });
      }
    }

    // Extract CNPJ
    const cnpj_match = text.match(NF_PATTERNS.cnpj);
    if (cnpj_match && cnpj_match.length > 0) {
      // Usually the first CNPJ is the issuer (emitter)
      data.issuer_cnpj = cnpj_match[0].replace(/\D/g, '');
    }

    // Extract company name
    const company_name = extractWithRegex(text, NF_PATTERNS.company_name);
    if (company_name) data.issuer_name = company_name.trim().substring(0, 150);

    // Extract total value
    const total_str = extractWithRegex(text, NF_PATTERNS.total_value);
    const total = parseDecimalValue(total_str);
    if (total !== null && total > 0) data.total_value = parseFloat(total.toFixed(2));

    // Extract emission date
    const date_str = extractWithRegex(text, NF_PATTERNS.emission_date);
    const parsed_date = parseDateString(date_str);
    if (parsed_date) data.emission_date = parsed_date;

    return data;
  }

  /**
   * Process uploaded file (PDF or image) and extract NF-e data
   */
  static async processUpload(
    companyId: string,
    file: Express.Multer.File,
  ): Promise<NfeUploadResponse> {
    const uploadId = randomUUID();
    const filePath = file.path;
    const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'image';

    try {
      // Step 1: Extract text from file
      logger.info('Processing NF-e upload', { 
        uploadId, 
        fileName: file.originalname, 
        fileType,
        size: file.size,
      });

      let extractedText: string;
      if (fileType === 'pdf') {
        extractedText = await this.extractTextFromPdf(filePath);
      } else {
        extractedText = await this.extractTextFromImage(filePath);
      }

      // Step 2: Parse extracted text to structured data
      const ocrData = this.parseNfeFields(extractedText);

      // Step 3: Calculate confidence score
      const confidence = estimateConfidence(ocrData);

      logger.info('NF-e extraction complete', {
        uploadId,
        confidence,
        hasInvoiceKey: !!ocrData.invoice_key,
        hasIssuerCnpj: !!ocrData.issuer_cnpj,
        hasTotal: !!ocrData.total_value,
      });

      // Step 4: Store upload record
      const db = await getDatabase();
      const record: NfeUploadRecord = {
        id: uploadId,
        company_id: companyId,
        file_name: file.originalname,
        file_path: filePath,
        file_type: fileType,
        file_size: file.size,
        ocr_data: ocrData,
        status: confidence > 0.6 ? 'extracted' : 'error',
        extraction_confidence: confidence,
        error_message: confidence <= 0.6 ? 'Confiança de extração baixa' : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db('nfe_uploads').insert(record);

      return {
        id: uploadId,
        company_id: companyId,
        file_name: file.originalname,
        file_size: file.size,
        file_type: fileType,
        ocr_data: ocrData,
        status: confidence > 0.6 ? 'extracted' : 'error',
        extraction_confidence: confidence,
        error: confidence <= 0.6 ? 'Confiança de extração baixa (< 60%)' : undefined,
        created_at: record.created_at,
      };
    } catch (error) {
      logger.error('NF-e upload processing error', { 
        uploadId, 
        error: (error as Error).message,
      });

      // Store error record
      const db = await getDatabase();
      await db('nfe_uploads').insert({
        id: uploadId,
        company_id: companyId,
        file_name: file.originalname,
        file_path: filePath,
        file_type: fileType,
        file_size: file.size,
        ocr_data: {},
        status: 'error',
        extraction_confidence: 0,
        error_message: (error as Error).message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      throw error;
    } finally {
      // Clean up temp file
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        logger.warn('Failed to delete temp file', { filePath });
      }
    }
  }

  /**
   * Get upload record by ID
   */
  static async getUpload(uploadId: string, companyId: string): Promise<NfeUploadRecord> {
    const db = await getDatabase();
    const record = await db('nfe_uploads')
      .where({ id: uploadId, company_id: companyId })
      .first();
    
    if (!record) {
      throw Object.assign(
        new Error('Upload não encontrado'),
        { status: 404 }
      );
    }

    return record as NfeUploadRecord;
  }

  /**
   * Generate journal entry preview based on OCR data
   * Determines if it's entrada (purchase) or saída (sale) based on context
   */
  static async generateJournalEntryPreview(
    uploadId: string,
    companyId: string,
  ): Promise<NfeJournalEntryPreview> {
    const upload = await this.getUpload(uploadId, companyId);
    const { ocr_data: data } = upload;

    if (!data.nf_number || !data.total_value || !data.issuer_cnpj) {
      throw Object.assign(
        new Error('Dados insuficientes para gerar preview. Campos obrigatórios faltando.'),
        { status: 400 }
      );
    }

    // Determine transaction type based on context
    // TODO: Could use issuer CNPJ lookup or user context to determine type
    // For now, assume ENTRADA (purchase from supplier)
    const type = 'entrada';

    const suggested_entries: NfeJournalEntryPreview['suggested_entries'] = [];

    if (type === 'entrada') {
      // Entrada: Debit Inventory/Stock, Credit Accounts Payable
      suggested_entries.push(
        {
          account_code: '1.1.2.1', // Estoques de Mercadorias
          account_name: 'Estoques de Mercadorias',
          debit: data.total_value,
        },
        {
          account_code: '2.1.1.1', // Fornecedores
          account_name: 'Fornecedores',
          credit: data.total_value,
        }
      );
    } else {
      // Saída: Debit Accounts Receivable, Credit Revenue
      suggested_entries.push(
        {
          account_code: '1.1.1.2', // Clientes
          account_name: 'Clientes',
          debit: data.total_value,
        },
        {
          account_code: '3.1.1.1', // Receita de Vendas
          account_name: 'Receita de Vendas',
          credit: data.total_value,
        }
      );
    }

    return {
      nf_number: data.nf_number || '',
      nf_series: data.nf_series || '1',
      issuer_cnpj: data.issuer_cnpj || '',
      issuer_name: data.issuer_name || 'Fornecedor',
      total_value: data.total_value || 0,
      emission_date: data.emission_date || new Date().toISOString().slice(0, 10),
      type,
      suggested_entries,
    };
  }

  /**
   * Validate NF-e key with SEFAZ (mock for now, integrates later)
   */
  static async validateWithSefaz(invoiceKey: string): Promise<SefazValidationResponse> {
    // Validate format first
    if (!validateInvoiceKey(invoiceKey)) {
      return {
        status: 'invalid',
        invoice_key: invoiceKey,
        message: 'Chave de acesso inválida',
      };
    }

    // Mock SEFAZ response
    // TODO: Integrate with real SEFAZ API via certificate
    logger.info('Mock SEFAZ validation', { invoiceKey });
    
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 500));

    return {
      status: 'valid',
      invoice_key: invoiceKey,
      issuer_cnpj: invoiceKey.substring(4, 18),
      message: 'Chave de acesso válida',
    };
  }

  /**
   * Confirm upload and create journal entry
   */
  static async confirmAndCreateEntry(
    uploadId: string,
    companyId: string,
    adjustments?: { debit_account?: string; credit_account?: string },
    labels?: string[],
  ): Promise<{ journal_entry_id: string; nfe_status: 'processed' }> {
    const db = await getDatabase();
    const upload = await this.getUpload(uploadId, companyId);

    if (!upload.ocr_data.nf_number || !upload.ocr_data.total_value) {
      throw Object.assign(
        new Error('Dados insuficientes para criar lançamento'),
        { status: 400 }
      );
    }

    // Get preview with suggested accounts
    const preview = await this.generateJournalEntryPreview(uploadId, companyId);

    // Use adjustments if provided, otherwise use suggestions
    const debit_account = adjustments?.debit_account || preview.suggested_entries[0].account_code;
    const credit_account = adjustments?.credit_account || preview.suggested_entries[1].account_code;

    // Create journal entry
    const journalEntryId = randomUUID();
    const now = new Date().toISOString();

    return await db.transaction(async (trx) => {
      // Create journal entry
      const [entry] = await trx('journal_entries').insert({
        id: journalEntryId,
        company_id: companyId,
        description: `NF-e ${upload.ocr_data.nf_number} - ${upload.ocr_data.issuer_name}`,
        entry_date: upload.ocr_data.emission_date || now.slice(0, 10),
        total_amount: upload.ocr_data.total_value,
        status: 'posted',
        labels: labels ? JSON.stringify(labels) : null,
        created_at: now,
        updated_at: now,
      }).returning('*');

      // Create debit journal line
      await trx('journal_lines').insert({
        id: randomUUID(),
        journal_entry_id: journalEntryId,
        account_code: debit_account,
        debit: upload.ocr_data.total_value,
        credit: 0,
        reference: `OCR - NF-e ${upload.ocr_data.nf_number}`,
        created_at: now,
      });

      // Create credit journal line
      await trx('journal_lines').insert({
        id: randomUUID(),
        journal_entry_id: journalEntryId,
        account_code: credit_account,
        debit: 0,
        credit: upload.ocr_data.total_value,
        reference: `OCR - NF-e ${upload.ocr_data.nf_number}`,
        created_at: now,
      });

      // Update upload status
      await trx('nfe_uploads')
        .where({ id: uploadId })
        .update({ 
          status: 'confirmed',
          updated_at: now,
        });

      // Register NF-e if has valid invoice key
      if (upload.ocr_data.invoice_key && validateInvoiceKey(upload.ocr_data.invoice_key)) {
        await trx('nfe_registry').insert({
          id: randomUUID(),
          company_id: companyId,
          invoice_key: upload.ocr_data.invoice_key,
          nf_number: upload.ocr_data.nf_number || '',
          nf_series: upload.ocr_data.nf_series || '1',
          issuer_cnpj: upload.ocr_data.issuer_cnpj || '',
          total_value: upload.ocr_data.total_value || 0,
          emission_date: upload.ocr_data.emission_date || now.slice(0, 10),
          journal_entry_id: journalEntryId,
          sefaz_status: 'pending',
          created_at: now,
          updated_at: now,
        });
      }

      return {
        journal_entry_id: journalEntryId,
        nfe_status: 'processed' as const,
      };
    });
  }
}
