/**
 * Aba de Usuários — criar acesso e decidir quais empresas cada um enxerga.
 *
 * Esta é a tela onde um clique errado concede acesso à contabilidade de
 * terceiros. O desenho segue disso:
 *
 * - A consequência de cada papel aparece por extenso ANTES de escolher, não
 *   depois. "Administrador" sem explicação parece só um nível a mais; o texto
 *   diz que enxerga TODAS as empresas da base.
 * - Escolher Administrador exige marcar uma confirmação. O backend recusa sem
 *   ela (422) — aqui a caixa existe para a decisão ser consciente, não para
 *   evitar o erro do servidor.
 * - A contagem de empresas fica visível na lista: é o resumo de quanto cada
 *   pessoa alcança, e denuncia de relance um acesso amplo demais.
 *
 * O backend valida tudo de novo. Esconder botão não protege nada; a tela só
 * evita oferecer o que seria recusado.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Users, Building2, Check, X, KeyRound, ShieldAlert, Trash2, Plus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { CompanyService } from '../../services/companyService';
import {
  UserManagementService, PAPEIS, type Papel, type Usuario,
} from '../../services/userManagementService';

type Toast = (texto: string, ok?: boolean) => void;

/** Mensagem de erro da API, que é onde estão as explicações boas. */
function mensagemDoErro(erro: unknown, padrao: string): string {
  const e = erro as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || padrao;
}

function rotuloPapel(papel: string): string {
  return PAPEIS.find((p) => p.valor === papel)?.rotulo ?? papel;
}

// ─── Modal: novo usuário ──────────────────────────────────────────────────────

function NovoUsuarioModal({ aberto, fechar, toast }: {
  aberto: boolean; fechar: () => void; toast: Toast;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel>('accountant');
  const [confirmouAcessoTotal, setConfirmouAcessoTotal] = useState(false);
  const [erro, setErro] = useState('');

  const limpar = () => {
    setEmail(''); setNome(''); setSenha('');
    setPapel('accountant'); setConfirmouAcessoTotal(false); setErro('');
  };

  const criar = useMutation({
    mutationFn: () => UserManagementService.criar({
      email, senha, nome_completo: nome, papel,
      confirmar_acesso_total: papel === 'admin' ? confirmouAcessoTotal : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast('Usuário criado. Passe a senha por um canal seguro.');
      limpar(); fechar();
    },
    onError: (e) => setErro(mensagemDoErro(e, 'Não foi possível criar o usuário.')),
  });

  const descricaoPapel = PAPEIS.find((p) => p.valor === papel)?.descricao ?? '';
  const ehAdmin = papel === 'admin';
  const podeSalvar = email && nome.length >= 3 && senha.length >= 8
    && (!ehAdmin || confirmouAcessoTotal);

  return (
    <Modal open={aberto} onClose={() => { limpar(); fechar(); }} title="Novo usuário">
      <div className="space-y-4">
        <Input label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input label="E-mail (login)" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <div>
          <Input label="Senha inicial" type="text" value={senha}
            onChange={(e) => setSenha(e.target.value)} />
          {/* Campo em texto claro de propósito: quem cria precisa ler para
              repassar. Esconder aqui não protege nada e provoca erro de digitação
              numa senha que o dono ainda não tem como recuperar. */}
          <p className="mt-1 text-xs text-gray-500">
            Mínimo 8 caracteres. Você repassa ao usuário, que troca depois.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
          <select
            value={papel}
            onChange={(e) => { setPapel(e.target.value as Papel); setConfirmouAcessoTotal(false); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{descricaoPapel}</p>
        </div>

        {ehAdmin && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="flex gap-2">
              <ShieldAlert className="h-5 w-5 flex-none text-amber-600" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">Administrador enxerga tudo</p>
                <p className="mt-1">
                  Este usuário verá a contabilidade de <strong>todas</strong> as empresas
                  da base — inclusive as que você não atribuir a ele — e poderá
                  criar outros usuários.
                </p>
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={confirmouAcessoTotal}
                    onChange={(e) => setConfirmouAcessoTotal(e.target.checked)} />
                  Entendi, quero conceder acesso total
                </label>
              </div>
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => { limpar(); fechar(); }}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!podeSalvar || criar.isPending}>
            {criar.isPending ? 'Criando...' : 'Criar usuário'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: empresas do usuário ───────────────────────────────────────────────

function EmpresasDoUsuarioModal({ usuario, fechar, toast }: {
  usuario: Usuario | null; fechar: () => void; toast: Toast;
}) {
  const queryClient = useQueryClient();
  const [selecionada, setSelecionada] = useState('');
  const aberto = Boolean(usuario);

  const { data: vinculadas = [], isLoading } = useQuery({
    queryKey: ['usuario-empresas', usuario?.id],
    queryFn: () => UserManagementService.empresas(usuario!.id),
    enabled: aberto,
  });

  const { data: todas } = useQuery({
    queryKey: ['empresas-para-atribuir'],
    queryFn: () => CompanyService.list({ limit: 100 }),
    enabled: aberto,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['usuario-empresas', usuario?.id] });
    queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  };

  const atribuir = useMutation({
    mutationFn: (companyId: string) => UserManagementService.atribuirEmpresa(usuario!.id, companyId),
    onSuccess: () => { invalidar(); setSelecionada(''); toast('Empresa atribuída.'); },
    onError: (e) => toast(mensagemDoErro(e, 'Não foi possível atribuir.'), false),
  });

  const revogar = useMutation({
    mutationFn: (companyId: string) => UserManagementService.revogarEmpresa(usuario!.id, companyId),
    onSuccess: () => { invalidar(); toast('Acesso revogado.'); },
    onError: (e) => toast(mensagemDoErro(e, 'Não foi possível revogar.'), false),
  });

  const ehAdmin = usuario?.papel === 'admin';
  const jaVinculadas = new Set(vinculadas.map((e) => e.id));
  const disponiveis = (todas?.data ?? []).filter((c) => !jaVinculadas.has(c.id));

  return (
    <Modal open={aberto} onClose={fechar} title={`Empresas de ${usuario?.nome_completo ?? ''}`}>
      <div className="space-y-4">
        {ehAdmin && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {/* Sem este aviso, a lista cheia pareceria resultado de atribuições
                — quando na verdade o papel dá acesso a tudo, e revogar não teria
                efeito nenhum. */}
            Este usuário é <strong>administrador</strong>: enxerga todas as empresas
            da base por causa do papel, não por atribuição. Para limitar o alcance,
            troque o papel dele.
          </div>
        )}

        {!ehAdmin && (
          <div className="flex gap-2">
            <select
              value={selecionada}
              onChange={(e) => setSelecionada(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Selecione uma empresa para atribuir...</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button
              onClick={() => atribuir.mutate(selecionada)}
              disabled={!selecionada || atribuir.isPending}
            >
              <Plus className="h-4 w-4" /> Atribuir
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-gray-200">
          {isLoading && <p className="p-4 text-sm text-gray-400">Carregando...</p>}
          {!isLoading && vinculadas.length === 0 && (
            <p className="p-4 text-sm text-gray-400">
              Nenhuma empresa ainda. As que ele cadastrar aparecem aqui automaticamente.
            </p>
          )}
          {vinculadas.map((empresa) => (
            <div key={empresa.id}
              className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{empresa.legal_name}</p>
                <p className="text-xs text-gray-400">{empresa.cnpj}</p>
              </div>
              {!ehAdmin && (
                <button
                  onClick={() => revogar.mutate(empresa.id)}
                  disabled={revogar.isPending}
                  title="Revogar acesso"
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={fechar}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: nova senha ────────────────────────────────────────────────────────

function SenhaModal({ usuario, fechar, toast }: {
  usuario: Usuario | null; fechar: () => void; toast: Toast;
}) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const salvar = useMutation({
    mutationFn: () => UserManagementService.definirSenha(usuario!.id, senha),
    onSuccess: () => {
      toast('Senha redefinida. Passe ao usuário por um canal seguro.');
      setSenha(''); setErro(''); fechar();
    },
    onError: (e) => setErro(mensagemDoErro(e, 'Não foi possível redefinir.')),
  });

  return (
    <Modal open={Boolean(usuario)} onClose={() => { setSenha(''); setErro(''); fechar(); }}
      title={`Nova senha — ${usuario?.nome_completo ?? ''}`}>
      <div className="space-y-4">
        <Input label="Nova senha" type="text" value={senha}
          onChange={(e) => setSenha(e.target.value)} />
        <p className="text-xs text-gray-500">
          Mínimo 8 caracteres. Isso também destrava a conta se ela estiver
          bloqueada por tentativas de login.
        </p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setSenha(''); setErro(''); fechar(); }}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={senha.length < 8 || salvar.isPending}>
            {salvar.isPending ? 'Salvando...' : 'Redefinir'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Aba ──────────────────────────────────────────────────────────────────────

export default function UsuariosTab({ toast }: { toast: Toast }) {
  const queryClient = useQueryClient();
  const usuarioLogado = useAuthStore((s) => s.user);
  const [novoAberto, setNovoAberto] = useState(false);
  const [verEmpresasDe, setVerEmpresasDe] = useState<Usuario | null>(null);
  const [trocarSenhaDe, setTrocarSenhaDe] = useState<Usuario | null>(null);

  const { data: usuarios = [], isLoading, error } = useQuery({
    queryKey: ['usuarios'],
    queryFn: UserManagementService.listar,
  });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      UserManagementService.definirAtivo(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast('Acesso atualizado.');
    },
    onError: (e) => toast(mensagemDoErro(e, 'Não foi possível alterar.'), false),
  });

  if (error) {
    // 403 aqui significa que quem abriu não é admin — o backend recusou.
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">
          {mensagemDoErro(error, 'Apenas administradores podem gerenciar usuários.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Users className="h-4 w-4" /> Usuários
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Cada usuário enxerga as empresas que cadastrar e as que você atribuir.
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)}>
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Usuário</th>
              <th className="px-4 py-2.5 text-left font-medium">Papel</th>
              <th className="px-4 py-2.5 text-left font-medium">Empresas</th>
              <th className="px-4 py-2.5 text-left font-medium">MFA</th>
              <th className="px-4 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Carregando...</td></tr>
            )}
            {usuarios.map((u) => {
              const souEu = u.id === usuarioLogado?.id;
              return (
                <tr key={u.id} className={clsx('border-t border-gray-100', !u.ativo && 'bg-gray-50')}>
                  <td className="px-4 py-3">
                    <p className={clsx('font-medium', u.ativo ? 'text-gray-800' : 'text-gray-400')}>
                      {u.nome_completo}
                      {souEu && <span className="ml-2 text-xs text-gray-400">(você)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      u.papel === 'admin'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-700',
                    )}>
                      {rotuloPapel(u.papel)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setVerEmpresasDe(u)}
                      className="flex items-center gap-1.5 text-primary-600 hover:underline"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {u.empresas}
                      {u.papel === 'admin' && (
                        <span className="text-xs text-gray-400">(todas)</span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {u.mfa_ativo
                      ? <Check className="h-4 w-4 text-green-600" />
                      : <X className="h-4 w-4 text-gray-300" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setTrocarSenhaDe(u)}
                        title="Redefinir senha"
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => alternarAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                        // Desativar a própria conta tranca quem está usando a
                        // tela para fora do sistema, sem ninguém para desfazer.
                        disabled={souEu || alternarAtivo.isPending}
                        title={souEu ? 'Você não pode desativar a própria conta' : (u.ativo ? 'Desativar' : 'Reativar')}
                        className={clsx(
                          'rounded px-2 py-1 text-xs font-medium',
                          souEu && 'cursor-not-allowed text-gray-300',
                          !souEu && u.ativo && 'text-red-600 hover:bg-red-50',
                          !souEu && !u.ativo && 'text-green-700 hover:bg-green-50',
                        )}
                      >
                        {u.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NovoUsuarioModal aberto={novoAberto} fechar={() => setNovoAberto(false)} toast={toast} />
      <EmpresasDoUsuarioModal usuario={verEmpresasDe}
        fechar={() => setVerEmpresasDe(null)} toast={toast} />
      <SenhaModal usuario={trocarSenhaDe} fechar={() => setTrocarSenhaDe(null)} toast={toast} />
    </div>
  );
}
