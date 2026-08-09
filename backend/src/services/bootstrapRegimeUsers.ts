/**
 * Contas de demonstração por regime tributário (uma por regime).
 *
 * OPT-IN. Antes esta rotina rodava em todo boot, inclusive em produção, criando
 * quatro usuários com senha fixa no código-fonte E com role 'admin'. Como o
 * middleware multi-tenant trata 'admin' como acesso liberado a qualquer
 * empresa (sem checar company_users), qualquer pessoa com acesso ao
 * repositório entrava na produção e lia os dados de todos os clientes.
 *
 * Agora: só cria quando ENABLE_REGIME_DEMO_USERS=true, a senha vem de
 * REGIME_DEMO_PASSWORD (nada versionado) e os usuários são 'user', restritos
 * à própria empresa de demonstração pelo vínculo em company_users.
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

interface RegimeDemoUser {
  email: string;
  name: string;
  companyName: string;
  tradeName: string;
  taxRegime: string;
  cnpj: string;
}

const REGIME_DEMO_USERS: RegimeDemoUser[] = [
  {
    email: 'lucroreal@procontador.com.br',
    name: 'Demo Lucro Real',
    companyName: 'Empresa Demo Lucro Real Ltda',
    tradeName: 'Lucro Real',
    taxRegime: 'lucro_real',
    cnpj: '11111111000191',
  },
  {
    email: 'lucropresumido@procontador.com.br',
    name: 'Demo Lucro Presumido',
    companyName: 'Empresa Demo Lucro Presumido Ltda',
    tradeName: 'Lucro Presumido',
    taxRegime: 'lucro_presumido',
    cnpj: '22222222000182',
  },
  {
    email: 'simplesnacional@procontador.com.br',
    name: 'Demo Simples Nacional',
    companyName: 'Empresa Demo Simples Nacional Ltda',
    tradeName: 'Simples Nacional',
    taxRegime: 'simples_nacional',
    cnpj: '33333333000173',
  },
  {
    email: 'mei@procontador.com.br',
    name: 'Demo MEI',
    companyName: 'Empresa Demo MEI',
    tradeName: 'MEI',
    taxRegime: 'mei',
    cnpj: '44444444000164',
  },
];

let bootstrapFinished = false;

/** Só cria as contas de demonstração quando explicitamente habilitado. */
export function regimeDemoUsersEnabled(): boolean {
  return String(process.env.ENABLE_REGIME_DEMO_USERS || '').toLowerCase() === 'true';
}

/**
 * Fecha o buraco em bases que já rodaram a versão anterior: as contas de
 * demonstração foram criadas lá com senha do código-fonte e role 'admin', que
 * dá acesso a qualquer empresa. Desativar aqui evita depender de alguém
 * lembrar de limpar o banco no dia do deploy.
 */
async function desativarContasDemoExistentes(): Promise<void> {
  const db = await getDatabase();
  if (!(await db.schema.hasTable('users'))) return;

  const usersColumns = (await db('users').columnInfo()) as Record<string, unknown>;
  const activeColumn = usersColumns.is_active ? 'is_active' : 'active';
  const emails = REGIME_DEMO_USERS.map((demo) => demo.email.toLowerCase());

  const existentes = await db('users')
    .whereRaw(`LOWER(email) IN (${emails.map(() => '?').join(',')})`, emails)
    .select('id', 'email', 'role');
  if (existentes.length === 0) return;

  const afetados = await db('users')
    .whereIn('id', existentes.map((u) => String(u.id)))
    .update({ role: 'user', [activeColumn]: false, updated_at: new Date() });

  logger.warn(
    'Contas de demonstração encontradas e desativadas (senha fixa e role admin na versão anterior). '
      + 'Se precisar delas, defina ENABLE_REGIME_DEMO_USERS=true e REGIME_DEMO_PASSWORD.',
    { afetados, emails: existentes.map((u) => u.email) },
  );
}

export async function bootstrapRegimeDemoUsers(): Promise<void> {
  if (bootstrapFinished) {
    return;
  }

  if (!regimeDemoUsersEnabled()) {
    await desativarContasDemoExistentes();
    bootstrapFinished = true;
    return;
  }

  const demoPassword = process.env.REGIME_DEMO_PASSWORD || '';
  if (!demoPassword) {
    logger.warn(
      'ENABLE_REGIME_DEMO_USERS=true mas REGIME_DEMO_PASSWORD não foi definida — '
        + 'contas de demonstração não serão criadas.',
    );
    bootstrapFinished = true;
    return;
  }

  const db = await getDatabase();
  const hasCompanies = await db.schema.hasTable('companies');
  const hasUsers = await db.schema.hasTable('users');
  if (!hasCompanies || !hasUsers) {
    bootstrapFinished = true;
    return;
  }

  const usersColumns = (await db('users').columnInfo()) as Record<string, unknown>;
  const hasPasswordHashColumn = Boolean(usersColumns.password_hash);
  const hasPasswordColumn = Boolean(usersColumns.password);
  const hasCompanyIdColumn = Boolean(usersColumns.company_id);
  const nameColumn = usersColumns.full_name ? 'full_name' : 'name';
  const activeColumn = usersColumns.is_active ? 'is_active' : 'active';
  const hasCompanyUsers = await db.schema.hasTable('company_users');

  for (const demo of REGIME_DEMO_USERS) {
    const email = demo.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(demoPassword, envConfig.bcryptRounds);

    let company = await db('companies').where('cnpj', demo.cnpj).first();
    if (!company) {
      const companyId = crypto.randomUUID();
      const now = new Date();
      const [inserted] = await db('companies')
        .insert({
          id: companyId,
          cnpj: demo.cnpj,
          legal_name: demo.companyName,
          trade_name: demo.tradeName,
          email,
          status: 'active',
          tax_regime: demo.taxRegime,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .returning('*');
      company = inserted;
      logger.info('Regime demo company created', { email, taxRegime: demo.taxRegime });
    }

    const companyId = String(company.id);
    let user = await db('users').whereRaw('LOWER(email) = ?', [email]).first();

    if (!user) {
      const userId = crypto.randomUUID();
      const payload: Record<string, unknown> = {
        id: userId,
        email,
        // Nunca 'admin': esse papel ignora o vínculo em company_users e abre
        // todas as empresas da base.
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (hasCompanyIdColumn) {
        payload.company_id = companyId;
      }

      payload[nameColumn] = demo.name;
      payload[activeColumn] = true;
      if (hasPasswordHashColumn) payload.password_hash = passwordHash;
      if (hasPasswordColumn) payload.password = passwordHash;

      await db('users').insert(payload);
      user = { id: userId };
      logger.info('Regime demo user created', { email, taxRegime: demo.taxRegime });
    } else if (hasCompanyIdColumn && !user.company_id) {
      // Não sobrescreve a senha de um usuário já existente a cada restart —
      // apenas garante o vínculo com a empresa demo se ainda não existir.
      await db('users').where('id', user.id).update({ company_id: companyId, updated_at: new Date() });
    }

    if (hasCompanyUsers) {
      const userId = String(user.id);
      const link = await db('company_users')
        .where({ user_id: userId, company_id: companyId })
        .first();

      if (!link) {
        await db('company_users').insert({
          id: crypto.randomUUID(),
          user_id: userId,
          company_id: companyId,
          role: 'user',
          permissions: JSON.stringify(['read']),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }
  }

  bootstrapFinished = true;
  logger.info('Regime demo users bootstrap completed', { count: REGIME_DEMO_USERS.length });
}
