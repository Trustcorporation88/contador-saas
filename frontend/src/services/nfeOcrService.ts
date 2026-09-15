import api from '../config/api';

export interface NfeOcrData {
  nf_number?: string;
  nf_series?: string;
  issuer_cnpj?: string;
  issuer_name?: string;
  total_value?: number;
  emission_date?: string;
  invoice_key?: string;
  confidence?: number;
  raw_text?: string;
}

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

export interface NfeJournalEntryPreview {
  nf_number: string;
  nf_series: string;
  issuer_cnpj: string;
  issuer_name: string;
  total_value: number;
  emission_date: string;
  type: 'entrada' | 'saida';
  suggested_entries: Array<{
    account_code: string;
    account_name: string;
    debit?: number;
    credit?: number;
  }>;
}

export const NfeOcrService = {
  async upload(companyId: string, file: File): Promise<NfeUploadResponse> {
    const form = new FormData();
    form.append('file', file);

    const { data } = await api.post<NfeUploadResponse>(
      `/companies/${companyId}/nfe/ocr/upload`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
        // 422 = extração parcial / baixa confiança — ainda devolve ocr_data
        validateStatus: (status) => status === 201 || status === 422,
      },
    );

    return data;
  },

  async getPreview(companyId: string, uploadId: string): Promise<NfeJournalEntryPreview> {
    const { data } = await api.get<NfeJournalEntryPreview>(
      `/companies/${companyId}/nfe/ocr/${uploadId}/preview`,
    );
    return data;
  },
};
