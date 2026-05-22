/**
 * Authentication Service
 * Core business logic para autenticação, JWT, TOTP MFA
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import { envConfig } from '../config/env';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  JWTPayload,
  LoginResponse,
  MFASetupResponse,
  MFAVerifyResponse,
  InvalidCredentialsError,
  InvalidTokenError,
  MFARequiredError,
  RateLimitError,
  TokenRevokedError,
} from '../types/auth';

// In-memory stores (replace with database in production)
// In production, use PostgreSQL for all of these
interface UserStore {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  companyId: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  backupCodesHash?: string[];
  lastLogin?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
}

interface RefreshTokenStore {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

interface PasswordResetTokenStore {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

// Mock database stores
const usersStore: Map<string, UserStore> = new Map();
const refreshTokensStore: Map<string, RefreshTokenStore> = new Map();
const loginAttemptsStore: Map<string, { attempts: number; resetTime: Date }> = new Map();

export class AuthService {
  private bootstrapFinished = false;

  private static readonly BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

  private extractPasswordHashFromRow(dbUser: any): string | undefined {
    const candidate = dbUser?.password_hash ?? dbUser?.passwordHash ?? dbUser?.password;
    if (!candidate || typeof candidate !== 'string') {
      return undefined;
    }
    return candidate;
  }

  async bootstrapAdminUser(): Promise<void> {
    if (this.bootstrapFinished) {
      return;
    }

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
      logger.warn('Users table created automatically during bootstrap');
    }

    const resetTableExists = await db.schema.hasTable('password_reset_tokens');
    if (!resetTableExists) {
      await db.schema.createTable('password_reset_tokens', (table) => {
        table.string('id', 64).primary();
        table.string('user_id', 64).notNullable();
        table.string('token_hash', 128).notNullable().unique();
        table.timestamp('expires_at').notNullable();
        table.timestamp('used_at').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.index(['user_id']);
        table.index(['expires_at']);
      });
      logger.info('Table password_reset_tokens created');
    }

    const adminEmail = envConfig.adminBootstrapEmail.toLowerCase().trim();
    const adminPassword = envConfig.adminBootstrapPassword;

    const existingAdmin = await db('users').whereRaw('LOWER(email) = ?', [adminEmail]).first();
    const usersColumns = await db('users').columnInfo();
    const hasPasswordHashColumn = Boolean((usersColumns as any).password_hash);
    const hasPasswordColumn = Boolean((usersColumns as any).password);

    if (!existingAdmin) {
      if (!adminPassword) {
        logger.warn('Admin bootstrap skipped: ADMIN_BOOTSTRAP_PASSWORD is empty', {
          adminEmail,
        });
        this.bootstrapFinished = true;
        return;
      }

      const passwordHash = await bcrypt.hash(adminPassword, envConfig.bcryptRounds);
      const payload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        email: adminEmail,
        name: 'Administrador',
        role: 'admin',
        company_id: 'bootstrap-company',
        active: true,
        mfa_enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (hasPasswordHashColumn) payload.password_hash = passwordHash;
      if (hasPasswordColumn) payload.password = passwordHash;

      await db('users').insert(payload);

      logger.info('Admin user bootstrapped successfully', {
        adminEmail,
      });
    } else if (envConfig.adminBootstrapForceReset && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, envConfig.bcryptRounds);
      const payload: Record<string, unknown> = {
        updated_at: new Date(),
      };

      if (hasPasswordHashColumn) payload.password_hash = passwordHash;
      if (hasPasswordColumn) payload.password = passwordHash;

      await db('users').where('id', existingAdmin.id).update(payload);

      logger.warn('Admin password force-reset via bootstrap flag', {
        adminEmail,
      });
    }

    this.bootstrapFinished = true;
  }

  /**
   * Login com email e senha
   * Retorna access token, refresh token e user info
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // Validação básica
    if (!email || !password) {
      throw new InvalidCredentialsError('Email and password are required');
    }

    email = email.toLowerCase().trim();

    // Check rate limiting (5 attempts / 15 minutes)
    this.checkLoginRateLimit(email);

    await this.bootstrapAdminUser();

    // Buscar usuário
    const user = await this.findUserByEmail(email);
    if (!user) {
      this.recordLoginAttempt(email);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    // Comparar senha com suporte a schema legado (senha em texto puro)
    const isPasswordValid = await this.verifyPasswordForUser(user, password);
    if (!isPasswordValid) {
      this.recordLoginAttempt(email);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    // Resetar login attempts
    loginAttemptsStore.delete(email);

    // Se MFA habilitado, retornar token temporário
    if (user.mfaEnabled) {
      const tempToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          mfaRequired: true,
        } as any,
        envConfig.jwt.secret,
        {
          expiresIn: '5m', // Válido por 5 minutos apenas
          algorithm: envConfig.jwt.algorithm as any,
        },
      );

      logger.info(`Login iniciado com MFA pendente para usuário: ${email}`);

      return {
        accessToken: tempToken,
        refreshToken: '',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          mfaEnabled: true,
        },
      };
    }

    // Gerar tokens JWT
    const { accessToken, refreshToken } = this.generateTokens(user.id, user.email, user.role, user.companyId);

    // Armazenar refresh token no BD (hash)
    await this.storeRefreshToken(user.id, refreshToken);

    // Atualizar last login
    user.lastLogin = new Date();
    usersStore.set(user.id, user);

    try {
      const db = await getDatabase();
      await db('users').where('id', user.id).update({
        last_login: new Date(),
        updated_at: new Date(),
      });
    } catch (error) {
      logger.warn('Could not persist last_login in database', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info(`Usuário logado com sucesso: ${email}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mfaEnabled: false,
      },
    };
  }

  private isBcryptHash(value: string): boolean {
    return AuthService.BCRYPT_HASH_REGEX.test(value);
  }

  private async verifyPasswordForUser(user: UserStore, plainPassword: string): Promise<boolean> {
    const storedValue = String(user.passwordHash || '');
    if (!storedValue) {
      return false;
    }

    if (this.isBcryptHash(storedValue)) {
      try {
        return await bcrypt.compare(plainPassword, storedValue);
      } catch (error) {
        logger.warn('Password hash compare failed; treating as invalid credentials', {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }

    // Compatibilidade temporária: senha legada em texto puro.
    if (plainPassword !== storedValue) {
      return false;
    }

    try {
      const secureHash = await bcrypt.hash(plainPassword, envConfig.bcryptRounds);
      await this.updateUserPasswordColumns(user.id, secureHash);
      user.passwordHash = secureHash;
      usersStore.set(user.id, user);

      logger.warn('Legacy plaintext password migrated to bcrypt hash', {
        userId: user.id,
      });
    } catch (error) {
      logger.error('Failed to migrate legacy plaintext password', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return true;
  }

  private async updateUserPasswordColumns(userId: string, passwordHash: string): Promise<void> {
    const db = await getDatabase();
    const usersColumns = await db('users').columnInfo();
    const hasPasswordHashColumn = Boolean((usersColumns as any).password_hash);
    const hasPasswordColumn = Boolean((usersColumns as any).password);

    const payload: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (hasPasswordHashColumn) payload.password_hash = passwordHash;
    if (hasPasswordColumn) payload.password = passwordHash;

    if (!hasPasswordHashColumn && !hasPasswordColumn) {
      logger.warn('No password column found to persist migrated hash', {
        userId,
      });
      return;
    }

    await db('users').where('id', userId).update(payload);
  }

  /**
   * Refresh access token usando refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new InvalidTokenError('Refresh token is required');
    }

    try {
      // Verificar JWT
      const decoded = jwt.verify(refreshToken, envConfig.jwt.refreshSecret) as JWTPayload;

      // Verificar se token foi revogado no BD
      const storedToken = this.findRefreshTokenByUserAndHash(decoded.sub, refreshToken);
      if (!storedToken) {
        throw new TokenRevokedError('Refresh token has been revoked');
      }

      // Verificar expiração
      if (new Date() > storedToken.expiresAt) {
        this.deleteRefreshToken(storedToken.id);
        throw new InvalidTokenError('Refresh token has expired');
      }

      // Buscar usuário
      const user = await this.findUserById(decoded.sub);
      if (!user) {
        throw new InvalidCredentialsError('User not found');
      }

      // Gerar novos tokens
      const tokens = this.generateTokens(user.id, user.email, user.role, user.companyId);

      // Remover token antigo
      this.deleteRefreshToken(storedToken.id);

      // Armazenar novo token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      logger.info(`Refresh token utilizado para usuário: ${user.email}`);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new InvalidTokenError('Refresh token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Habilitar MFA (TOTP) para usuário
   * Retorna QR code, secret e backup codes
   */
  async enableMFA(userId: string): Promise<MFASetupResponse> {
    const user = usersStore.get(userId);
    if (!user) {
      throw new InvalidCredentialsError('User not found');
    }

    if (user.mfaEnabled) {
      throw new Error('MFA is already enabled for this user');
    }

    // Gerar secret para TOTP (RFC 6238)
    const secret = speakeasy.generateSecret({
      name: `Contador App (${user.email})`,
      issuer: 'Contador App',
      length: 32,
    });

    // Gerar 10 backup codes (8 caracteres cada)
    const backupCodes = this.generateBackupCodes(10);

    // Hash dos backup codes (não armazenar plaintext)
    const backupCodesHash = await Promise.all(backupCodes.map((code) => bcrypt.hash(code, envConfig.bcryptRounds)));

    // Armazenar secret e backup codes temporariamente
    user.mfaSecret = secret.base32;
    user.backupCodesHash = backupCodesHash;

    logger.info(`MFA habilitação iniciada para usuário: ${user.email}`);

    return {
      qrCode: secret.otpauth_url || '',
      secret: secret.base32,
      backupCodes: backupCodes,
    };
  }

  /**
   * Verificar código TOTP e ativar MFA
   */
  async verifyMFA(userId: string, code: string): Promise<MFAVerifyResponse> {
    if (!code || code.length !== 6) {
      throw new InvalidTokenError('Invalid MFA code format');
    }

    const user = usersStore.get(userId);
    if (!user) {
      throw new InvalidCredentialsError('User not found');
    }

    if (!user.mfaSecret) {
      throw new Error('MFA setup not found. Please enable MFA first.');
    }

    // Verificar código TOTP
    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2, // Permite 30s antes/depois do tempo atual
    });

    if (!isValid) {
      throw new InvalidTokenError('Invalid MFA code');
    }

    // Ativar MFA
    user.mfaEnabled = true;

    // Armazenar secret permanentemente
    usersStore.set(userId, user);

    logger.info(`MFA ativado com sucesso para usuário: ${user.email}`);

    // Gerar tokens de acesso
    const tokens = this.generateTokens(user.id, user.email, user.role, user.companyId);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mfaEnabled: true,
      },
    };
  }

  /**
   * Fazer logout removendo refresh token
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, envConfig.jwt.refreshSecret) as JWTPayload;

      if (decoded.sub !== userId) {
        throw new InvalidTokenError('Token does not belong to user');
      }

      // Adiciona token ao blacklist
      const jti = (decoded as any).jti;
      if (jti) {
        const { addToBlacklist } = require('./cache/tokenBlacklist');
        await addToBlacklist(
          jti,
          userId,
          decoded.exp,
          'logout',
          { email: decoded.email, companyId: decoded.companyId }
        );
        logger.info(`Refresh token blacklisted on logout`, { userId, jti });
      }

      const storedToken = this.findRefreshTokenByUserAndHash(userId, refreshToken);
      if (storedToken) {
        this.deleteRefreshToken(storedToken.id);
      }

      logger.info(`Usuário deslogado: ${userId}`);
    } catch (error) {
      logger.warn(`Logout error para usuário ${userId}: ${error}`);
      // Não lançar erro, logout deve ser idempotente
    }
  }

  async requestPasswordReset(email: string): Promise<{ debugToken?: string }> {
    if (!email) {
      return {};
    }

    await this.bootstrapAdminUser();
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.findUserByEmail(normalizedEmail);
    if (!user) {
      return {};
    }

    const db = await getDatabase();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + envConfig.passwordResetTtlMinutes * 60 * 1000);

    await db('password_reset_tokens')
      .where('user_id', user.id)
      .whereNull('used_at')
      .del();

    await db('password_reset_tokens').insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date(),
    });

    logger.info('Password reset token issued', {
      userId: user.id,
      email: normalizedEmail,
      expiresAt: expiresAt.toISOString(),
    });

    if (envConfig.nodeEnv !== 'production') {
      return { debugToken: rawToken };
    }

    return {};
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) {
      throw new InvalidTokenError('Invalid reset request');
    }

    const passwordValidation = this.validatePasswordStrength(newPassword);
    if (!passwordValidation.ok) {
      throw new InvalidCredentialsError(passwordValidation.message);
    }

    await this.bootstrapAdminUser();
    const db = await getDatabase();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await db<PasswordResetTokenStore>('password_reset_tokens')
      .where('token_hash', tokenHash)
      .whereNull('used_at')
      .andWhere('expires_at', '>', new Date())
      .first();

    if (!record) {
      throw new InvalidTokenError('Reset token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, envConfig.bcryptRounds);
    const usersColumns = await db('users').columnInfo();
    const hasPasswordHashColumn = Boolean((usersColumns as any).password_hash);
    const hasPasswordColumn = Boolean((usersColumns as any).password);

    const payload: Record<string, unknown> = {
      updated_at: new Date(),
    };
    if (hasPasswordHashColumn) payload.password_hash = passwordHash;
    if (hasPasswordColumn) payload.password = passwordHash;

    await db('users').where('id', record.userId).update(payload);

    await db('password_reset_tokens').where('id', record.id).update({
      used_at: new Date(),
    });

    // Invalida refresh tokens em memória do usuário.
    for (const [tokenId, storedToken] of refreshTokensStore.entries()) {
      if (storedToken.userId === record.userId) {
        refreshTokensStore.delete(tokenId);
      }
    }

    logger.info('Password reset completed', {
      userId: record.userId,
    });
  }

  /**
   * Validar JWT token
   */
  validateToken(token: string): { isValid: boolean; decoded?: JWTPayload; error?: string } {
    try {
      const decoded = jwt.verify(token, envConfig.jwt.secret) as JWTPayload;
      return { isValid: true, decoded };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { isValid: false, error: 'Token expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { isValid: false, error: 'Invalid token' };
      }
      return { isValid: false, error: 'Token validation failed' };
    }
  }

  // ============ PRIVATE HELPERS ============

  /**
   * Gerar access token + refresh token
   */
  private generateTokens(
    userId: string,
    email: string,
    role: string,
    companyId: string,
  ): { accessToken: string; refreshToken: string } {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role,
      companyId,
    };

    // Access token: 1 hora
    const accessToken = jwt.sign(payload, envConfig.jwt.secret, {
      expiresIn: '1h',
      algorithm: envConfig.jwt.algorithm as any,
    });

    // Refresh token: 7 dias
    const refreshToken = jwt.sign(payload, envConfig.jwt.refreshSecret, {
      expiresIn: '7d',
      algorithm: envConfig.jwt.algorithm as any,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Armazenar refresh token com hash
   */
  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    const record: RefreshTokenStore = {
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    };

    refreshTokensStore.set(record.id, record);
  }

  /**
   * Buscar refresh token no BD
   */
  private findRefreshTokenByUserAndHash(userId: string, token: string): RefreshTokenStore | undefined {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    for (const stored of refreshTokensStore.values()) {
      if (stored.userId === userId && stored.tokenHash === tokenHash) {
        return stored;
      }
    }

    return undefined;
  }

  /**
   * Deletar refresh token
   */
  private deleteRefreshToken(tokenId: string): void {
    refreshTokensStore.delete(tokenId);
  }

  /**
   * Buscar usuário por email
   */
  private async findUserByEmail(email: string): Promise<UserStore | undefined> {
    const db = await getDatabase();
    const dbUser = await db('users')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .first();

    if (dbUser) {
      const passwordHash = this.extractPasswordHashFromRow(dbUser);
      if (!passwordHash) {
        logger.warn('User row found without password hash field', {
          email,
          userId: dbUser.id,
        });
        return undefined;
      }

      const hydratedUser: UserStore = {
        id: String(dbUser.id),
        email: String(dbUser.email),
        passwordHash,
        role: String(dbUser.role || 'viewer'),
        companyId: String(dbUser.company_id || ''),
        mfaEnabled: Boolean(dbUser.mfa_enabled),
        mfaSecret: dbUser.mfa_secret ? String(dbUser.mfa_secret) : undefined,
        loginAttempts: Number(dbUser.login_attempts || 0),
        lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
        lockedUntil: dbUser.locked_until ? new Date(dbUser.locked_until) : undefined,
      };

      usersStore.set(hydratedUser.id, hydratedUser);
      return hydratedUser;
    }

    for (const user of usersStore.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  private async findUserById(userId: string): Promise<UserStore | undefined> {
    const cached = usersStore.get(userId);
    if (cached) {
      return cached;
    }

    const db = await getDatabase();
    const dbUser = await db('users').where('id', userId).first();
    if (!dbUser) {
      return undefined;
    }

    const passwordHash = this.extractPasswordHashFromRow(dbUser);
    if (!passwordHash) {
      logger.warn('User row found without password hash field', {
        userId,
      });
      return undefined;
    }

    const hydratedUser: UserStore = {
      id: String(dbUser.id),
      email: String(dbUser.email),
      passwordHash,
      role: String(dbUser.role || 'viewer'),
      companyId: String(dbUser.company_id || ''),
      mfaEnabled: Boolean(dbUser.mfa_enabled),
      mfaSecret: dbUser.mfa_secret ? String(dbUser.mfa_secret) : undefined,
      loginAttempts: Number(dbUser.login_attempts || 0),
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
      lockedUntil: dbUser.locked_until ? new Date(dbUser.locked_until) : undefined,
    };

    usersStore.set(hydratedUser.id, hydratedUser);
    return hydratedUser;
  }

  private validatePasswordStrength(password: string): { ok: boolean; message: string } {
    if (password.length < 8) {
      return { ok: false, message: 'A senha deve ter no mínimo 8 caracteres' };
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasNumber || !hasSpecial) {
      return {
        ok: false,
        message: 'A senha deve conter letra maiúscula, número e caractere especial',
      };
    }

    return { ok: true, message: 'ok' };
  }

  /**
   * Gerar backup codes para MFA
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Verificar rate limiting para login
   */
  private checkLoginRateLimit(email: string): void {
    const attempt = loginAttemptsStore.get(email);

    if (attempt) {
      if (new Date() < attempt.resetTime) {
        if (attempt.attempts >= 5) {
          throw new RateLimitError('Too many login attempts. Try again in 15 minutes.');
        }
      } else {
        loginAttemptsStore.delete(email);
      }
    }
  }

  /**
   * Registrar tentativa de login falha
   */
  private recordLoginAttempt(email: string): void {
    const attempt = loginAttemptsStore.get(email);

    if (attempt) {
      attempt.attempts++;
    } else {
      loginAttemptsStore.set(email, {
        attempts: 1,
        resetTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
      });
    }
  }

  /**
   * Inicializar usuário de teste (para desenvolvimento)
   */
  static async initTestUser(): Promise<void> {
    const passwordHash = await bcrypt.hash('Test@123456', envConfig.bcryptRounds);

    const testUser: UserStore = {
      id: 'test-user-1',
      email: 'test@example.com',
      passwordHash,
      role: 'admin',
      companyId: 'test-company-1',
      mfaEnabled: false,
      loginAttempts: 0,
    };

    usersStore.set(testUser.id, testUser);
    logger.info('Test user initialized for development');
  }

  // ─── Static utility methods (usados nos testes unitários) ──────────────────

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, envConfig.bcryptRounds);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateAccessToken(user: { id: string; email: string; role: string; company_id?: string }): string {
    const secret = process.env.JWT_SECRET ?? envConfig.jwt.secret;
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role, companyId: user.company_id },
      secret,
      { expiresIn: envConfig.jwt.expiry as any, algorithm: envConfig.jwt.algorithm },
    );
  }

  static generateRefreshToken(userId: string): string {
    const secret = process.env.JWT_REFRESH_SECRET ?? envConfig.jwt.refreshSecret;
    return jwt.sign(
      { userId },
      secret,
      { expiresIn: envConfig.jwt.refreshExpiry as any },
    );
  }

  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      const secret = process.env.JWT_SECRET ?? envConfig.jwt.secret;
      return jwt.verify(token, secret) as JWTPayload;
    } catch {
      return null;
    }
  }

  static generateMfaSecret(email: string): { secret: string; otpauthUrl: string } {
    const generated = speakeasy.generateSecret({
      name: `${envConfig.totpIssuer} (${email})`,
      length: 20,
    });
    return {
      secret: generated.base32 ?? '',
      otpauthUrl: generated.otpauth_url ?? '',
    };
  }

  static verifyMfaToken(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: envConfig.totpWindow,
    });
  }
}

export default new AuthService();
