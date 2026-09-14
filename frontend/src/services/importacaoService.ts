import api from '../config/api';

export interface LinhaImportacao {
  linha: number;
  cnpj: string;
  razao_social: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  projeto?: string | null;
  atividade?: string | null;
  categoria?: string;
  situacao: 'importar' | 'existente' | 'erro';
  motivo?: string;
}

export interface ResultadoLinha {
  linha: number;
  cnpj: string;
  razao_social: string;
  ok: boolean;
  company_id?: string;
  motivo?: string;
}

export interface AnaliseImportacao {
  linhas: LinhaImportacao[];
  resumo: { total: number; importar: number; existente: number; erro: number };
}

export const ImportacaoService = {
  async analisar(arquivo: File): Promise<AnaliseImportacao> {
    const form = new FormData();
    form.append('file', arquivo);
    const { data } = await api.post<{ data: AnaliseImportacao }>(
      '/companies/importar/analisar',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async importarLote(linhas: LinhaImportacao[], atribuirPara?: string): Promise<ResultadoLinha[]> {
    const { data } = await api.post<{ data: ResultadoLinha[] }>(
      '/companies/importar/lote',
      { linhas, atribuir_para: atribuirPara || undefined },
      // Cada linha consulta o cartão do CNPJ; o lote precisa de mais fôlego
      // que o timeout padrão.
      { timeout: 120000 },
    );
    return data.data;
  },
};
