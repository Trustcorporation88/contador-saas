/**
 * DTO para NF-e OCR — Extração automática de dados de PDF/Imagem
 */

/** Dados extraídos pela OCR */
export interface NfeOcrData {
  nf_number?: string;
  nf_series?: string;
  issuer_cnpj?: string;
  issuer_name?: string;
  total_value?: number;
  emission_date?: string;
  invoice_key?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_value: number;
  }>;
  confidence?: number; // 0-1, indicating extraction confidence
  raw_text?: string; // Raw OCR output for debugging
}

/** Upload de arquivo NF-e para OCR */
export interface NfeUploadRequest {
  file: Express.Multer.File;
  companyId: string;
}

/** Resposta após upload e extração */
export interface NfeUploadResponse {
  id: string;
  company_id: string;
  file_name: string;
  file_size: number;
  file_type: 'pdf' | 'image';
  ocr_data: NfeOcrData;
  status: 'extracted' | 'error';
  extraction_confidence: number;
  created_at: string;
  error?: string;
}

/** Preview de lançamento contábil baseado em OCR */
export interface NfeJournalEntryPreview {
  nf_number: string;
  nf_series: string;
  issuer_cnpj: string;
  issuer_name: string;
  total_value: number;
  emission_date: string;
  type: 'entrada' | 'saida'; // entrada de mercadoria ou saída/venda
  suggested_entries: Array<{
    account_code: string;
    account_name: string;
    debit?: number;
    credit?: number;
  }>;
}

/** Confirmação e criação do lançamento */
export interface NfeConfirmRequest {
  nfe_upload_id: string;
  adjustments?: {
    debit_account?: string;
    credit_account?: string;
  };
  labels?: string[];
}

/** Resposta após confirmar e criar lançamento */
export interface NfeConfirmResponse {
  journal_entry_id: string;
  nfe_status: 'processed';
  nf_number: string;
  total_value: number;
  created_at: string;
}

/** Validação com SEFAZ */
export interface SefazValidationResponse {
  status: 'valid' | 'invalid' | 'pending';
  invoice_key: string;
  issuer_cnpj?: string;
  total_value?: number;
  emission_date?: string;
  message?: string;
}

/** Registro de upload NF-e (banco de dados) */
export interface NfeUploadRecord {
  id: string;
  company_id: string;
  file_name: string;
  file_path: string;
  file_type: 'pdf' | 'image';
  file_size: number;
  ocr_data: NfeOcrData;
  status: 'uploaded' | 'extracted' | 'confirmed' | 'error';
  extraction_confidence: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

/** Registro NF-e no cadastro principal */
export interface NfeRegistryRecord {
  id: string;
  company_id: string;
  invoice_key: string;
  nf_number: string;
  nf_series: string;
  issuer_cnpj: string;
  total_value: number;
  emission_date: string;
  journal_entry_id?: string;
  sefaz_status: 'valid' | 'invalid' | 'pending';
  created_at: string;
  updated_at: string;
}
