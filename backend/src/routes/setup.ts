/**
 * Setup Route — criação do primeiro admin (recuperação / primeiro deploy)
 *
 * A rota é pública e a única barreira era "só funciona se não existir nenhum
 * usuário". Não basta aqui: o admin criado recebe role 'admin', que no
 * middleware multi-tenant dá acesso a TODAS as empresas. E com
 * ADMIN_BOOTSTRAP_PASSWORD vazia o banco de produção fica sem usuário nenhum,
 * deixando este endpoint aberto na internet como um "vire superadmin".
 *
 * Em produção agora exige o header x-setup-token conferindo com SETUP_TOKEN;
 * sem a variável definida, a rota fica desligada.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

const router = Router();

/** Comparação em tempo constante, para o token não vazar por timing. */
function tokenConfere(informado: string, esperado: string): boolean {
  const a = Buffer.from(informado);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/', async (req: Request, res: Response) => {
  const setupToken = process.env.SETUP_TOKEN || '';
  const isProduction = envConfig.nodeEnv === 'production';

  if (isProduction) {
    if (!setupToken) {
      logger.warn('Tentativa de usar /setup em produção sem SETUP_TOKEN configurado');
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
      });
    }
    const informado = String(req.header('x-setup-token') || '');
    if (!informado || !tokenConfere(informado, setupToken)) {
      logger.warn('Tentativa de usar /setup com token inválido', { ip: req.ip });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid setup token',
      });
    }
  }

  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'email and password are required',
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'password must be at least 8 characters',
    });
  }

  try {
    const db = await getDatabase();

    const usersTableExists = await db.schema.hasTable('users');
    if (!usersTableExists) {
      await db.schema.createTable('users', (table) => {
        table.string('id', 64).primary();
        table.string('email', 255).unique().notNullable();
        table.string('password_hash', 255).notNullable();
        table.string('name', 255).notNullable();
        table.string('role', 32).notNullable().defaultTo('viewer');
        table.string('company_id', 64).notNullable();
        table.boolean('active').defaultTo(true);
        table.boolean('mfa_enabled').defaultTo(false);
        table.string('mfa_secret', 128).nullable();
        table.timestamp('last_login').nullable();
        table.integer('login_attempts').defaultTo(0);
        table.timestamp('locked_until').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
    }

    const existingCount = await db('users').count('id as cnt').first();
    const userCount = Number((existingCount as any)?.cnt ?? 0);

    if (userCount > 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Setup already completed. Admin user already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, envConfig.bcryptRounds);

    // Detecta os nomes reais das colunas, como faz o bootstrap do authService.
    // O insert fixo usava `name`/`active`/company_id='bootstrap-company', que
    // não existem no schema atual (`full_name`/`is_active`, company_id UUID):
    // a rota de recuperação estourava 500 justamente quando fosse necessária.
    const usersColumns = (await db('users').columnInfo()) as Record<string, unknown>;
    const nameColumn = usersColumns.full_name ? 'full_name' : 'name';
    const activeColumn = usersColumns.is_active ? 'is_active' : 'active';

    const adminUser: Record<string, unknown> = {
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      role: 'admin',
      mfa_enabled: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    adminUser[nameColumn] = name ?? 'Administrador';
    adminUser[activeColumn] = true;

    await db('users').insert(adminUser);

    logger.info('Admin user created via /setup endpoint', { email: adminUser.email });

    return res.status(201).json({
      message: 'Admin user created successfully. This endpoint is now disabled.',
      email: adminUser.email,
    });
  } catch (error) {
    logger.error('Setup endpoint error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create admin user',
    });
  }
});

export default router;
