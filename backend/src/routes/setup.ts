/**
 * Setup Route — one-time admin initialization
 *
 * Creates the first admin user when the database has no users yet.
 * Returns 403 Forbidden once any user exists, making it safe to leave deployed.
 * This is the standard pattern used by GitLab, Gitea, and similar platforms.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { envConfig } from '../config/env';
import { logger } from '../middleware/requestLogger';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
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

    const adminUser = {
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: name ?? 'Administrador',
      role: 'admin',
      company_id: 'bootstrap-company',
      active: true,
      mfa_enabled: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

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
