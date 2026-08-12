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
  /** Já recebeu Ciência da Operação. Decide se a linha mostra o botão. */
  manifestado?: boolean;
  manifestado_em?: string | null;
  id: string;
  doc_type: string;
  chave: string;
  direcao: string | null;
  emitente_cnpj: string | null;
  destinatario_cnpj: string | null;
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

  async sync(tipo: FiscalDocType = 'all'): Promise<{
    success?: boolean;
    message: string;
    stdout?: string;
    nfe_capturados?: number;
    nfse_capturados?: number;
    warnings?: string[];
  }> {
    const { data } = await api.post(companyPath('/sync'), { tipo }, { timeout: 300000 });
    return data;
  },

  async reprocess(): Promise<{ message: string; stdout?: string }> {
    const { data } = await api.post(companyPath('/reprocess'), {}, { timeout: 300000 });
    return data;
  },

  /**
   * Ciência da Operação em UMA nota, pela chave.
   *
   * Existe porque manifestar em lote não serve para todo caso: nota que o
   * contador não reconhece não deve receber ciência às cegas — o evento é
   * registrado na SEFAZ e não se desfaz. Quem escolhe é ele, linha por linha.
   */
  async manifestar(chave: string): Promise<{
    ok: boolean;
    cStat: string;
    motivo: string;
    ja_manifestado?: boolean;
  }> {
    const { data } = await api.post(
      companyPath('/manifestar'),
      { chave },
      { timeout: 180000 },
    );
    return data;
  },

  /**
   * Ciência da Operação nos resumos ainda não manifestados.
   *
   * Timeout largo porque são eventos enviados um a um à SEFAZ, de propósito:
   * disparar em paralelo contra o Ambiente Nacional é a receita para tomar
   * consumo indevido.
   */
  async manifestarResumos(limite = 20): Promise<{
    total: number;
    manifestados: number;
    falhas: number;
  }> {
    const { data } = await api.post(
      companyPath('/manifestar-resumos'),
      { limite },
      { timeout: 600000 },
    );
    return data;
  },
};
