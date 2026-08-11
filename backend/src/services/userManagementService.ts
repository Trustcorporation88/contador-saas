/**
 * Gestão de usuários — criação de acesso e vínculo com empresas.
 *
 * Até aqui o sistema tinha um único usuário, criado pelo bootstrap a partir de
 * variáveis de ambiente. Não havia como criar outro: nenhuma rota de registro,
 * nenhuma tela, e o /api/v1/setup recusa quando já existe alguém.
 *
 * O motor de isolamento, porém, já estava pronto e correto: `company_users`
 * liga usuário a empresa, `companyService.create` vincula automaticamente quem
 * cria, e listar/abrir/editar validam o vínculo para quem não é admin. O que
 * faltava era a porta de entrada. É ela que este serviço abre.
 *
 * O MODELO DE ACESSO, EM UMA FRASE
 * Usuário comum enxerga as empresas que ele criou mais as que um admin lhe
 * atribuiu. Admin enxerga tudo.
 *
 * Isso torna o papel `admin` a decisão mais perigosa desta tela: conceder admin
 * a alguém dá acesso à contabilidade de TODAS as empresas da base, e é
 * exatamente o oposto do que se quer ao cadastrar um colaborador. Por isso a
 * criação de admin exige uma confirmação explícita, em vez de ser só mais um
 * valor no campo "papel".
 */

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

/** Papéis aceitos. `admin` enxerga todas as empresas — ver assertPapel. */
export const PAPEIS_VALIDOS = ['admin', 'auditor', 'accountant', 'manager', 'viewer'] as const;
export type Papel = (typeof PAPEIS_VALIDOS)[number];

/** Papel padrão de quem é cadastrado para tocar a própria carteira de clientes. */
export const PAPEL_PADRAO: Papel = 'accountant';

const SENHA_MINIMA = 8;

export interface CriarUsuarioDTO {
  email: string;
  senha: string;
  nome_completo: string;
  papel?: Papel;
  /** Obrigatório quando papel = 'admin'. Ver assertPapel. */
  confirmar_acesso_total?: boolean;
}

export interface UsuarioResumo {
  id: string;
  email: string;
  nome_completo: string | null;
  papel: string;
  ativo: boolean;
  mfa_ativo: boolean;
  ultimo_login: Date | null;
  criado_em: Date;
  /** Quantas empresas o usuário enxerga. Para admin, todas as da base. */
  empresas: number;
}

function erro(mensagem: string, status = 400): Error & { status: number } {
  return Object.assign(new Error(mensagem), { status });
}

function normalizarEmail(valor: string): string {
  return String(valor ?? '').trim().toLowerCase();
}

/**
 * Recusa o papel `admin` sem confirmação explícita.
 *
 * O campo extra existe porque o erro aqui é silencioso e caro: um colaborador
 * criado como admin passa a ver a contabilidade de todas as empresas da base, e
 * nada na tela denuncia isso — a listagem dele simplesmente vem completa, como
 * se fosse o esperado.
 */
function assertPapel(papel: Papel, confirmou: boolean | undefined): void {
  if (!PAPEIS_VALIDOS.includes(papel)) {
    throw erro(`Papel inválido: "${papel}". Use um de: ${PAPEIS_VALIDOS.join(', ')}.`);
  }
  if (papel === 'admin' && confirmou !== true) {
    throw erro(
      'O papel "admin" dá acesso à contabilidade de TODAS as empresas da base, ' +
      'inclusive as que não forem atribuídas a este usuário. ' +
      'Se é isso mesmo, envie confirmar_acesso_total: true. ' +
      `Para um colaborador que deve ver só a carteira dele, use "${PAPEL_PADRAO}".`,
      422,
    );
  }
}

function assertSenha(senha: string): void {
  if (!senha || senha.length < SENHA_MINIMA) {
    throw erro(`A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`);
  }
}

function assertEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw erro(`E-mail inválido: "${email}".`);
  }
}

/** Nunca devolve password_hash, mfa_secret nem backup_codes. */
function paraResumo(linha: Record<string, unknown>, empresas: number): UsuarioResumo {
  return {
    id: String(linha.id),
    email: String(linha.email),
    nome_completo: (linha.full_name as string) ?? null,
    papel: String(linha.role ?? PAPEL_PADRAO),
    ativo: linha.is_active !== false,
    mfa_ativo: linha.mfa_enabled === true,
    ultimo_login: (linha.last_login as Date) ?? null,
    criado_em: linha.created_at as Date,
    empresas,
  };
}

async function buscarPorId(db: Knex, id: string): Promise<Record<string, unknown>> {
  const linha = await db('users').where('id', id).first();
  if (!linha) throw erro('Usuário não encontrado.', 404);
  return linha as Record<string, unknown>;
}

/** Empresas visíveis: admin vê todas; os demais, só as vinculadas e ativas. */
async function contarEmpresas(db: Knex, userId: string, papel: string): Promise<number> {
  if (papel === 'admin') {
    const r = await db('companies').where('is_active', true).count<{ c: string }>({ c: '*' }).first();
    return Number(r?.c ?? 0);
  }
  const r = await db('company_users')
    .where({ user_id: userId, is_active: true })
    .count<{ c: string }>({ c: '*' })
    .first();
  return Number(r?.c ?? 0);
}

export class UserManagementService {

  /**
   * Cria um usuário com login e senha.
   *
   * A senha é definida por quem cria e trocada pelo dono depois. Não há envio de
   * e-mail: implantar isso agora seria mais uma peça sem uso comprovado no
   * caminho crítico de autenticação.
   */
  static async criar(dados: CriarUsuarioDTO, criadoPor: string): Promise<UsuarioResumo> {
    const db = await getDatabase();

    const email = normalizarEmail(dados.email);
    const nome = String(dados.nome_completo ?? '').trim();
    const papel = (dados.papel ?? PAPEL_PADRAO) as Papel;

    assertEmail(email);
    assertSenha(dados.senha);
    assertPapel(papel, dados.confirmar_acesso_total);
    if (nome.length < 3) throw erro('Informe o nome completo do usuário.');

    // Comparação em minúsculas: "Flavio@..." e "flavio@..." são o mesmo login,
    // e um índice UNIQUE cru deixaria os dois coexistirem.
    const jaExiste = await db('users').whereRaw('LOWER(email) = ?', [email]).first();
    if (jaExiste) throw erro(`Já existe um usuário com o e-mail ${email}.`, 409);

    const id = randomUUID();
    await db('users').insert({
      id,
      email,
      password_hash: await bcrypt.hash(dados.senha, envConfig.bcryptRounds),
      full_name: nome,
      role: papel,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info('Usuário criado', { id, email, papel, criadoPor });

    return paraResumo(await buscarPorId(db, id), 0);
  }

  /** Lista os usuários com a contagem de empresas que cada um enxerga. */
  static async listar(): Promise<UsuarioResumo[]> {
    const db = await getDatabase();
    const linhas = await db('users').orderBy('created_at', 'asc');

    return Promise.all(
      (linhas as Record<string, unknown>[]).map(async (linha) => paraResumo(
        linha,
        await contarEmpresas(db, String(linha.id), String(linha.role ?? '')),
      )),
    );
  }

  /**
   * Ativa ou desativa o acesso.
   *
   * Desativar não apaga: o usuário some do login mas os vínculos e o rastro de
   * auditoria continuam, o que importa quando é preciso reconstituir quem
   * lançou o quê.
   */
  static async definirAtivo(
    id: string, ativo: boolean, executadoPor: string,
  ): Promise<UsuarioResumo> {
    const db = await getDatabase();
    const usuario = await buscarPorId(db, id);

    // Trancar-se fora do próprio sistema é irreversível pela interface: não
    // sobra ninguém para reativar. Só o banco resolveria.
    if (id === executadoPor && !ativo) {
      throw erro('Você não pode desativar a própria conta.', 422);
    }

    await db('users').where('id', id).update({ is_active: ativo, updated_at: new Date() });
    logger.info('Acesso de usuário alterado', { id, ativo, executadoPor });

    return paraResumo(
      { ...usuario, is_active: ativo },
      await contarEmpresas(db, id, String(usuario.role ?? '')),
    );
  }

  /** Troca o papel. Mesma proteção do admin da criação. */
  static async definirPapel(
    id: string, papel: Papel, confirmarAcessoTotal: boolean | undefined, executadoPor: string,
  ): Promise<UsuarioResumo> {
    const db = await getDatabase();
    const usuario = await buscarPorId(db, id);
    assertPapel(papel, confirmarAcessoTotal);

    // Rebaixar a si mesmo tira o acesso à própria tela de usuários, e aí não há
    // como voltar atrás sem mexer no banco.
    if (id === executadoPor && usuario.role === 'admin' && papel !== 'admin') {
      throw erro('Você não pode rebaixar a própria conta de administrador.', 422);
    }

    await db('users').where('id', id).update({ role: papel, updated_at: new Date() });
    logger.info('Papel de usuário alterado', { id, de: usuario.role, para: papel, executadoPor });

    return paraResumo({ ...usuario, role: papel }, await contarEmpresas(db, id, papel));
  }

  /** Define uma nova senha. O dono troca depois pelo fluxo normal. */
  static async definirSenha(id: string, senha: string, executadoPor: string): Promise<void> {
    const db = await getDatabase();
    await buscarPorId(db, id);
    assertSenha(senha);

    await db('users').where('id', id).update({
      password_hash: await bcrypt.hash(senha, envConfig.bcryptRounds),
      // Zera o bloqueio por tentativas: senha nova com conta travada deixaria o
      // usuário parado sem entender o motivo.
      login_attempts: 0,
      locked_until: null,
      updated_at: new Date(),
    });
    logger.info('Senha redefinida por administrador', { id, executadoPor });
  }

  /**
   * Atribui uma empresa ao usuário.
   *
   * É o segundo caminho de acesso: o primeiro é o usuário criar a empresa, e aí
   * o vínculo nasce sozinho em companyService.create.
   */
  static async atribuirEmpresa(
    userId: string, companyId: string, executadoPor: string,
  ): Promise<void> {
    const db = await getDatabase();
    const usuario = await buscarPorId(db, userId);

    const empresa = await db('companies').where('id', companyId).first();
    if (!empresa) throw erro('Empresa não encontrada.', 404);

    const vinculo = await db('company_users')
      .where({ user_id: userId, company_id: companyId })
      .first();

    if (vinculo) {
      // Revincular é reativar: apagar e recriar perderia a data original.
      if (vinculo.is_active) return;
      await db('company_users')
        .where('id', vinculo.id)
        .update({ is_active: true, updated_at: new Date() });
    } else {
      const temPermissions = await db.schema.hasColumn('company_users', 'permissions');
      await db('company_users').insert({
        id: randomUUID(),
        user_id: userId,
        company_id: companyId,
        // Papel DENTRO da empresa. Quem recebe a atribuição trabalha nela por
        // inteiro; o que ele não pode é ver as outras — isso é decidido pelo
        // papel global, não por este.
        role: 'admin',
        ...(temPermissions ? { permissions: JSON.stringify(['*']) } : {}),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    logger.info('Empresa atribuída a usuário', {
      userId, companyId, papelGlobal: usuario.role, executadoPor,
    });
  }

  /**
   * Remove o acesso do usuário a uma empresa.
   *
   * Desativa o vínculo em vez de apagar a linha: a data de criação diz desde
   * quando aquele usuário tinha acesso, e isso é o que responde "quem podia
   * mexer nesta empresa em março?" numa auditoria.
   */
  static async revogarEmpresa(
    userId: string, companyId: string, executadoPor: string,
  ): Promise<void> {
    const db = await getDatabase();
    const atualizadas = await db('company_users')
      .where({ user_id: userId, company_id: companyId })
      .update({ is_active: false, updated_at: new Date() });

    if (!atualizadas) throw erro('Este usuário não tem vínculo com esta empresa.', 404);
    logger.info('Acesso a empresa revogado', { userId, companyId, executadoPor });
  }

  /** Empresas que o usuário enxerga hoje. */
  static async empresasDoUsuario(
    userId: string,
  ): Promise<Array<{ id: string; legal_name: string; cnpj: string; desde: Date }>> {
    const db = await getDatabase();
    const usuario = await buscarPorId(db, userId);

    // Admin não tem vínculos em company_users e mesmo assim vê tudo. Listar só
    // os vínculos dele mostraria uma lista vazia para quem enxerga a base
    // inteira — o contrário do que a tela precisa comunicar.
    if (usuario.role === 'admin') {
      return db('companies')
        .where('is_active', true)
        .select('id', 'legal_name', 'cnpj', 'created_at as desde')
        .orderBy('legal_name');
    }

    return db('company_users')
      .join('companies', 'companies.id', 'company_users.company_id')
      .where('company_users.user_id', userId)
      .where('company_users.is_active', true)
      .where('companies.is_active', true)
      .select(
        'companies.id',
        'companies.legal_name',
        'companies.cnpj',
        'company_users.created_at as desde',
      )
      .orderBy('companies.legal_name');
  }
}

export default UserManagementService;
