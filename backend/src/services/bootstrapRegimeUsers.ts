/**
 * Bootstrap demo users per tax regime for procontador.com.br/login
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

interface RegimeDemoUser {
  email: string;
  password: string;
  name: string;
  companyName: string;
  tradeName: string;
  taxRegime: string;
  cnpj: string;
}

const REGIME_DEMO_USERS: RegimeDemoUser[] = [
  {
    email: 'lucroreal@procontador.com.br',
    password: 'LucroReal@2026',
    name: 'Demo Lucro Real',
    companyName: 'Empresa Demo Lucro Real Ltda',
    tradeName: 'Lucro Real',
    taxRegime: 'lucro_real',
    cnpj: '11111111000191',
  },
  {
    email: 'lucropresumido@procontador.com.br',
    password: 'LucroPresumido@2026',
    name: 'Demo Lucro Presumido',
    companyName: 'Empresa Demo Lucro Presumido Ltda',
    tradeName: 'Lucro Presumido',
    taxRegime: 'lucro_presumido',
    cnpj: '22222222000182',
  },
  {
    email: 'simplesnacional@procontador.com.br',
    password: 'SimplesNacional@2026',
    name: 'Demo Simples Nacional',
    companyName: 'Empresa Demo Simples Nacional Ltda',
    tradeName: 'Simples Nacional',
    taxRegime: 'simples_nacional',
    cnpj: '33333333000173',
  },
  {
    email: 'mei@procontador.com.br',
    password: 'Mei@2026',
    name: 'Demo MEI',
    companyName: 'Empresa Demo MEI',
    tradeName: 'MEI',
    taxRegime: 'mei',
    cnpj: '44444444000164',
  },
];

let bootstrapFinished = false;

export async function bootstrapRegimeDemoUsers(): Promise<void> {
  if (bootstrapFinished) {
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
    const passwordHash = await bcrypt.hash(demo.password, envConfig.bcryptRounds);

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
        role: 'admin',
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
    } else {
      const payload: Record<string, unknown> = { updated_at: new Date() };
      if (hasPasswordHashColumn) payload.password_hash = passwordHash;
      if (hasPasswordColumn) payload.password = passwordHash;
      if (hasCompanyIdColumn) payload.company_id = companyId;
      await db('users').where('id', user.id).update(payload);
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
          role: 'admin',
          permissions: JSON.stringify(['*']),
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
