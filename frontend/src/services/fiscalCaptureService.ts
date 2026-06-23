import api from '../config/api';
import { useAuthStore } from '../store/authStore';

export type FiscalDocType = 'nfe' | 'nfse' | 'all';

export interface FiscalCertificate {
  id: string;
  company_id: string;
  cnpj: string;
  uf: string;
  cert_valid_until: string | null;
  serpro_motor_enabled: boolean;
  active: boolean;
  has_password: boolean;
}

export interface FiscalSyncStatus {
  doc_type: 'nfe' | 'nfse';
  cursor_value: string;
  last_sync_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

export interface FiscalCapture {
  id: string;
  doc_type: string;
  chave: string;
  direcao: string | null;
  valor_total: string | null;
  data_emissao: string | null;
  numero: string | null;
  captured_at: string;
}

export interface FiscalCaptureStatus {
  certificate: FiscalCertificate | null;
  sync: FiscalSyncStatus[];
  captures_total: number;
  python_available: boolean;
}

function companyPath(suffix: string): string {
  const companyId = useAuthStore.getState().currentCompanyId;
  if (!companyId) throw new Error('Selecione uma empresa');
  return `/companies/${companyId}/fiscal-capture${suffix}`;
}

export const FiscalCaptureService = {
  async getStatus(): Promise<FiscalCaptureStatus> {
    const { data } = await api.get(companyPath('/status'));
    return data.data;
  },

  async listCaptures(page = 1, limit = 10): Promise<{ data: FiscalCapture[]; total: number }> {
    const { data } = await api.get(companyPath('/captures'), { params: { page, limit } });
    return { data: data.data, total: data.total };
  },

  async uploadCertificate(payload: {
    cnpj: string;
    uf: string;
    password: string;
    serproMotor: boolean;
    file: File;
  }): Promise<FiscalCertificate> {
    const form = new FormData();
    form.append('certificate', payload.file);
    form.append('cnpj', payload.cnpj);
    form.append('uf', payload.uf);
    form.append('password', payload.password);
    form.append('serpro_motor', String(payload.serproMotor));

    const { data } = await api.post(companyPath('/certificate'), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return data.data;
  },

  async sync(tipo: FiscalDocType = 'all'): Promise<{ message: string; stdout?: string }> {
    const { data } = await api.post(companyPath('/sync'), { tipo }, { timeout: 300000 });
    return data;
  },
};
