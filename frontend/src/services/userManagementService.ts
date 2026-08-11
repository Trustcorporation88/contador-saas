/**
 * Gestão de usuários — cliente da API.
 *
 * Todas as rotas exigem papel admin no backend. Aqui não há checagem de
 * permissão: esconder o botão não protege nada, quem protege é o servidor.
 * A tela só evita oferecer o que vai ser recusado.
 */

import api from '../config/api';

export type Papel = 'admin' | 'auditor' | 'accountant' | 'manager' | 'viewer';

export interface Usuario {
  id: string;
  email: string;
  nome_completo: string | null;
  papel: string;
  ativo: boolean;
  mfa_ativo: boolean;
  ultimo_login: string | null;
  criado_em: string;
  /** Empresas que o usuário enxerga. Para admin, todas as da base. */
  empresas: number;
}

export interface EmpresaDoUsuario {
  id: string;
  legal_name: string;
  cnpj: string;
  desde: string;
}

export interface CriarUsuarioDTO {
  email: string;
  senha: string;
  nome_completo: string;
  papel?: Papel;
  confirmar_acesso_total?: boolean;
}

/** Rótulos em português, com a consequência de cada papel dita por extenso. */
export const PAPEIS: Array<{ valor: Papel; rotulo: string; descricao: string }> = [
  {
    valor: 'accountant',
    rotulo: 'Contador',
    descricao: 'Vê e trabalha nas empresas que criar e nas que você atribuir.',
  },
  {
    valor: 'manager',
    rotulo: 'Gerente',
    descricao: 'Mesmo alcance do contador, com acesso a relatórios gerenciais.',
  },
  {
    valor: 'auditor',
    rotulo: 'Auditor',
    descricao: 'Mesmo alcance, voltado a consulta e conferência.',
  },
  {
    valor: 'viewer',
    rotulo: 'Consulta',
    descricao: 'Apenas leitura das empresas atribuídas.',
  },
  {
    valor: 'admin',
    rotulo: 'Administrador',
    descricao: 'Enxerga TODAS as empresas da base e gerencia usuários.',
  },
];

export const UserManagementService = {
  async listar(): Promise<Usuario[]> {
    const { data } = await api.get('/users');
    return data.data;
  },

  async criar(dto: CriarUsuarioDTO): Promise<Usuario> {
    const { data } = await api.post('/users', dto);
    return data.data;
  },

  async definirAtivo(id: string, ativo: boolean): Promise<void> {
    await api.patch(`/users/${id}/ativo`, { ativo });
  },

  async definirPapel(id: string, papel: Papel, confirmarAcessoTotal?: boolean): Promise<void> {
    await api.patch(`/users/${id}/papel`, {
      papel,
      confirmar_acesso_total: confirmarAcessoTotal,
    });
  },

  async definirSenha(id: string, senha: string): Promise<void> {
    await api.patch(`/users/${id}/senha`, { senha });
  },

  async empresas(id: string): Promise<EmpresaDoUsuario[]> {
    const { data } = await api.get(`/users/${id}/empresas`);
    return data.data;
  },

  async atribuirEmpresa(id: string, companyId: string): Promise<void> {
    await api.post(`/users/${id}/empresas`, { company_id: companyId });
  },

  async revogarEmpresa(id: string, companyId: string): Promise<void> {
    await api.delete(`/users/${id}/empresas/${companyId}`);
  },
};

export default UserManagementService;
