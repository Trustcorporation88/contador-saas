import api from '../config/api';

export interface Alerta {
  id: string;
  company_id: string;
  tipo: 'desenquadramento_mei' | 'exclusao_sn' | string;
  status: string;
  severidade: 'info' | 'atencao' | 'critico' | string;
  mensagem: string;
  contexto: Record<string, unknown> | null;
  created_at: string;
}

export const AlertaService = {
  async listar(companyId: string): Promise<Alerta[]> {
    const { data } = await api.get<{ data: Alerta[] }>(`/companies/${companyId}/alertas`);
    return data.data;
  },
};
