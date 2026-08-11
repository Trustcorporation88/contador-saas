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
import { addToBlacklist } from './cache/tokenBlacklist';
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
  isActive: boolean;
}

/**
 * Usuário ativo? A coluna é `is_active` no schema atual e `active` no legado;
 * quando nenhuma das duas existe, trata como ativo (não trava base antiga).
 */
function isRowActive(row: Record<string, unknown>): boolean {
  if (row.is_active !== undefined && row.is_active !== null) return Boolean(row.is_active);
  if (row.active !== undefined && row.active !== null) return Boolean(row.active);
  return true;
}

/**
 * Códigos de recuperação vêm como JSON de hashes na coluna backup_codes. Sem
 * hidratar, eles se perderiam no restart mesmo estando gravados no banco.
 */
function parseBackupCodes(valor: unknown): string[] | undefined {
  if (!valor) return undefined;
  if (Array.isArray(valor)) return valor.map(String);
  try {
    const parsed = JSON.parse(String(valor));
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    logger.warn('backup_codes em formato inesperado — ignorando');
    return undefined;
  }
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

    // Detecta nomes reais das colunas para compatibilidade com diferentes schemas
    const usersColumns = (await db('users').columnInfo()) as Record<string, unknown>;
    const hasPasswordHashColumn = Boolean(usersColumns.password_hash);
    const hasPasswordColumn = Boolean(usersColumns.password);
    const hasCompanyIdColumn = Boolean(usersColumns.company_id);
    const nameColumn = usersColumns.full_name ? 'full_name' : 'name';
    const activeColumn = usersColumns.is_active ? 'is_active' : 'active';

    const existingAdmin = await db('users').whereRaw('LOWER(email) = ?', [adminEmail]).first();

    if (!existingAdmin) {
      if (!adminPassword) {
        logger.warn('Admin bootstrap skipped: ADMIN_BOOTSTRAP_PASSWORD is empty', {
          adminEmail,
        });
        this.bootstrapFinished = true;
        return;
      }

      // Garante que existe uma empresa para o admin bootstrap
      const BOOTSTRAP_COMPANY_CNPJ = '00000000000000';
      let bootstrapCompany = await db('companies').where('cnpj', BOOTSTRAP_COMPANY_CNPJ).first();

      if (!bootstrapCompany) {
        const [inserted] = await db('companies')
          .insert({
            cnpj: BOOTSTRAP_COMPANY_CNPJ,
            legal_name: 'Empresa Bootstrap',
            trade_name: 'O Contador',
            status: 'active',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');
        bootstrapCompany = inserted;
        logger.info('Bootstrap company created', { id: bootstrapCompany.id });
      }

      const passwordHash = await bcrypt.hash(adminPassword, envConfig.bcryptRounds);
      const payload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        email: adminEmail,
        role: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (hasCompanyIdColumn) {
        payload.company_id = bootstrapCompany.id;
      }

      payload[nameColumn] = 'Administrador';
      payload[activeColumn] = true;
      if (hasPasswordHashColumn) payload.password_hash = passwordHash;
      if (hasPasswordColumn) payload.password = passwordHash;

      await db('users').insert(payload);

      logger.info('Admin user bootstrapped successfully', { adminEmail });
    } else if (envConfig.adminBootstrapForceReset && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, envConfig.bcryptRounds);
      const payload: Record<string, unknown> = { updated_at: new Date() };

      if (hasPasswordHashColumn) payload.password_hash = passwordHash;
      if (hasPasswordColumn) payload.password = passwordHash;

      await db('users').where('id', existingAdmin.id).update(payload);

      logger.warn('Admin password force-reset via bootstrap flag', { adminEmail });
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

    // Buscar usuário
    const user = await this.findUserByEmail(email);
    if (!user) {
      this.recordLoginAttempt(email);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    // Bloqueio gravado no banco. A checagem em memória acima não sobrevive a um
    // restart, e o Railway reinicia a cada deploy: quem estivesse bloqueado
    // voltava a ter as 5 tentativas liberadas. Este teto persiste.
    this.assertNaoBloqueado(user, email);

    // Comparar senha com suporte a schema legado (senha em texto puro)
    const isPasswordValid = await this.verifyPasswordForUser(user, password);
    if (!isPasswordValid) {
      this.recordLoginAttempt(email);
      await this.registrarFalhaNoBanco(user);
      throw new InvalidCredentialsError('Invalid email or password');
    }

    // Conta desativada não entra. Sem esta checagem, desativar um usuário no
    // banco não tirava o acesso dele — ele continuava logando normalmente.
    if (user.isActive === false) {
      this.recordLoginAttempt(email);
      logger.warn('Tentativa de login em conta desativada', { email });
      throw new InvalidCredentialsError('Invalid email or password');
    }

    // Resetar login attempts, em memória e no banco
    loginAttemptsStore.delete(email);
    await this.limparFalhasNoBanco(user);

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
    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.companyId,
    );

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

  /**
   * Grava campos de MFA na tabela users.
   *
   * O usersStore é um Map em memória. Antes desta correção, enableMFA e verifyMFA
   * só escreviam nele: o usuário escaneava o QR code, o sistema confirmava a
   * ativação, e no deploy seguinte (o Railway reinicia a cada deploy) o Map
   * zerava, o usuário era re-hidratado do banco e o MFA voltava desligado — sem
   * aviso, o login parava de pedir o segundo fator. Pior que não ter MFA, porque
   * o usuário acredita estar protegido.
   *
   * Filtra pelas colunas existentes seguindo o mesmo padrão de
   * updateUserPasswordColumns: o schema varia entre ambientes, e uma coluna
   * ausente não deve derrubar a operação inteira.
   */
  private async persistMfaColumns(
    userId: string,
    campos: { mfaEnabled?: boolean; mfaSecret?: string | null; backupCodesHash?: string[] | null },
  ): Promise<void> {
    const db = await getDatabase();
    const usersColumns = (await db('users').columnInfo()) as Record<string, unknown>;

    const payload: Record<string, unknown> = {};
    if (campos.mfaEnabled !== undefined && usersColumns.mfa_enabled) {
      payload.mfa_enabled = campos.mfaEnabled;
    }
    if (campos.mfaSecret !== undefined && usersColumns.mfa_secret) {
      payload.mfa_secret = campos.mfaSecret;
    }
    if (campos.backupCodesHash !== undefined && usersColumns.backup_codes) {
      // Só os hashes, nunca os códigos em texto claro.
      payload.backup_codes = campos.backupCodesHash
        ? JSON.stringify(campos.backupCodesHash)
        : null;
    }

    if (Object.keys(payload).length === 0) {
      // Sem as colunas, o MFA seria "ativado" só em memória e morreria no
      // próximo restart. Falhar aqui é melhor que dar a ativação por concluída.
      throw Object.assign(
        new Error(
          'Colunas de MFA ausentes na tabela users — rode as migrações ' +
          '(025_users_mfa_e_lockout) antes de habilitar MFA.',
        ),
        { status: 503 },
      );
    }

    if (usersColumns.updated_at) payload.updated_at = new Date();
    await db('users').where('id', userId).update(payload);
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
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
    // findUserById e não usersStore.get: o JWT é stateless e sobrevive ao
    // restart, mas o Map não. Lendo só o Map, um usuário autenticado que
    // chamasse este endpoint depois de um deploy recebia "User not found".
    const user = await this.findUserById(userId);
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
    const backupCodesHash = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, envConfig.bcryptRounds)),
    );

    // Gravar no banco ANTES de devolver o QR code. Se a gravação falhar, o
    // usuário não deve receber um secret que o servidor vai esquecer no próximo
    // restart — ele guardaria o QR code no autenticador acreditando ter MFA.
    // mfa_enabled continua false: só a verificação do código ativa.
    await this.persistMfaColumns(userId, {
      mfaSecret: secret.base32,
      backupCodesHash,
      mfaEnabled: false,
    });

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
   * Verificar código TOTP — ou um código de recuperação — e ativar MFA.
   *
   * O código de recuperação é a única saída de quem perdeu o celular. Antes
   * desta correção ele não existia na prática: enableMFA gerava dez, gravava os
   * hashes e devolvia a lista, mas NENHUM caminho do sistema os aceitava. O
   * guard abaixo exigia exatamente 6 caracteres, e os códigos têm 8 — então
   * eram recusados já na primeira linha, antes de qualquer comparação.
   *
   * Resultado: perder o aparelho trancava o usuário fora da conta, e a única
   * saída seria mexer no banco. Num sistema com um único administrador, isso é
   * perder o sistema.
   */
  async verifyMFA(userId: string, code: string): Promise<MFAVerifyResponse> {
    // Normaliza antes de medir: o usuário copia o código de um papel e traz
    // espaço, hífen ou minúscula. Recusar por formatação seria recusar o código
    // certo no momento em que ele é a última alternativa.
    const informado = String(code ?? '').replace(/[\s-]/g, '').toUpperCase();
    const pareceTotp   = /^\d{6}$/.test(informado);
    const pareceBackup = /^[0-9A-F]{8}$/.test(informado);

    if (!pareceTotp && !pareceBackup) {
      throw new InvalidTokenError('Invalid MFA code format');
    }

    // Idem enableMFA: hidrata do banco. Sem isso, habilitar e confirmar o MFA
    // em processos diferentes (ou com um deploy no meio) falhava.
    const user = await this.findUserById(userId);
    if (!user) {
      throw new InvalidCredentialsError('User not found');
    }

    if (!user.mfaSecret) {
      throw new Error('MFA setup not found. Please enable MFA first.');
    }

    const isValid = pareceTotp && speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: informado,
      window: 2, // Permite 30s antes/depois do tempo atual
    });

    let usouCodigoDeRecuperacao = false;

    if (!isValid) {
      // Só chega aqui quem errou o TOTP ou digitou algo com cara de código de
      // recuperação. Tentar a lista nos dois casos é o que permite usar o
      // código de recuperação sem uma segunda tela pedindo "que tipo é este".
      const indice = await this.consumirCodigoDeRecuperacao(user, informado);
      if (indice === null) {
        throw new InvalidTokenError('Invalid MFA code');
      }
      usouCodigoDeRecuperacao = true;
    }

    // Ativar MFA no banco. O comentário anterior aqui dizia "armazenar secret
    // permanentemente" e só fazia usersStore.set — um Map em memória.
    await this.persistMfaColumns(userId, { mfaEnabled: true });

    if (usouCodigoDeRecuperacao) {
      logger.warn('Acesso liberado por código de recuperação de MFA', {
        userId,
        restantes: user.backupCodesHash?.length ?? 0,
      });
    }

    user.mfaEnabled = true;
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
        await addToBlacklist(jti, userId, decoded.exp, 'logout', {
          email: decoded.email,
          companyId: decoded.companyId,
        });
        logger.info('Refresh token blacklisted on logout', { userId, jti });
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

    await db('password_reset_tokens').where('user_id', user.id).whereNull('used_at').del();

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
  private findRefreshTokenByUserAndHash(
    userId: string,
    token: string,
  ): RefreshTokenStore | undefined {
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
    const dbUser = await db('users').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first();

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
        backupCodesHash: parseBackupCodes(dbUser.backup_codes),
        loginAttempts: Number(dbUser.login_attempts || 0),
        lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
        lockedUntil: dbUser.locked_until ? new Date(dbUser.locked_until) : undefined,
        isActive: isRowActive(dbUser),
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
      backupCodesHash: parseBackupCodes(dbUser.backup_codes),
      loginAttempts: Number(dbUser.login_attempts || 0),
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
      lockedUntil: dbUser.locked_until ? new Date(dbUser.locked_until) : undefined,
      isActive: isRowActive(dbUser),
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
   * Confere o código contra a lista de recuperação e o CONSOME.
   *
   * Devolve o índice usado, ou null se nenhum bateu.
   *
   * Uso único não é detalhe: o código de recuperação é escrito num papel, tirado
   * de foto, colado num gerenciador. Se continuasse valendo depois de usado,
   * cada um deles viraria uma senha permanente que dispensa o segundo fator —
   * exatamente o que o MFA existe para impedir. Gasta-se ao usar.
   *
   * A remoção é gravada ANTES de liberar o acesso. Se a gravação falhar, o
   * acesso é negado: liberar sem consumir deixaria o código valendo de novo, e
   * o usuário não teria como saber.
   */
  private async consumirCodigoDeRecuperacao(
    user: { id: string; backupCodesHash?: string[] },
    codigo: string,
  ): Promise<number | null> {
    const hashes = user.backupCodesHash;
    if (!hashes || hashes.length === 0) return null;

    let indice = -1;
    for (let i = 0; i < hashes.length; i++) {
      // Comparação sequencial, sem short-circuit por índice: bcrypt.compare já
      // é resistente a timing, e a lista tem no máximo dez itens.
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(codigo, hashes[i])) {
        indice = i;
        break;
      }
    }
    if (indice === -1) return null;

    const restantes = hashes.filter((_, i) => i !== indice);
    await this.persistMfaColumns(user.id, { backupCodesHash: restantes });
    user.backupCodesHash = restantes;

    return indice;
  }

  /** Tentativas falhas até bloquear, e por quanto tempo. */
  private static readonly MAX_TENTATIVAS_LOGIN = 5;
  private static readonly BLOQUEIO_MINUTOS = 15;

  /**
   * Recusa o login quando há bloqueio vigente gravado no banco.
   *
   * O rate limit em memória (loginAttemptsStore) protege contra rajadas dentro de
   * um processo, mas morre no restart — e o Railway reinicia a cada deploy, então
   * um atacante ganhava 5 tentativas novas a cada deploy. Esta checagem lê o
   * locked_until da tabela, que sobrevive.
   */
  private assertNaoBloqueado(user: UserStore, email: string): void {
    if (!user.lockedUntil) return;
    if (user.lockedUntil.getTime() <= Date.now()) return;

    const minutos = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    logger.warn('Login recusado: conta bloqueada por tentativas falhas', {
      email, lockedUntil: user.lockedUntil.toISOString(),
    });
    throw new RateLimitError(
      `Conta temporariamente bloqueada por tentativas de login. Tente novamente em ${minutos} minuto(s).`,
    );
  }

  /**
   * Incrementa o contador de falhas no banco e bloqueia ao atingir o teto.
   *
   * Falha de gravação não impede o login de prosseguir: sem as colunas
   * (ambiente sem a migração 025) a proteção fica degradada, e derrubar todo
   * login por causa disso seria pior. Diferente do MFA, onde seguir em silêncio
   * enganaria o usuário sobre estar protegido.
   */
  private async registrarFalhaNoBanco(user: UserStore): Promise<void> {
    const tentativas = (user.loginAttempts ?? 0) + 1;
    const bloquear = tentativas >= AuthService.MAX_TENTATIVAS_LOGIN;
    const lockedUntil = bloquear
      ? new Date(Date.now() + AuthService.BLOQUEIO_MINUTOS * 60 * 1000)
      : user.lockedUntil ?? null;

    user.loginAttempts = tentativas;
    user.lockedUntil = lockedUntil ?? undefined;
    usersStore.set(user.id, user);

    if (bloquear) {
      logger.warn('Conta bloqueada por tentativas de login falhas', {
        userId: user.id, tentativas, lockedUntil: lockedUntil?.toISOString(),
      });
    }

    await this.persistLockoutColumns(user.id, { loginAttempts: tentativas, lockedUntil });
  }

  /** Zera o contador após login bem-sucedido. */
  private async limparFalhasNoBanco(user: UserStore): Promise<void> {
    const precisaLimpar = (user.loginAttempts ?? 0) > 0 || Boolean(user.lockedUntil);

    user.loginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLogin = new Date();
    usersStore.set(user.id, user);

    // Evita um UPDATE por login quando não havia nada a limpar; last_login
    // sozinho não justifica escrita a cada autenticação.
    if (!precisaLimpar) return;
    await this.persistLockoutColumns(user.id, { loginAttempts: 0, lockedUntil: null });
  }

  /** Grava as colunas de lockout, tolerando schema sem elas. */
  private async persistLockoutColumns(
    userId: string,
    campos: { loginAttempts?: number; lockedUntil?: Date | null },
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const usersColumns = (await db('users').columnInfo()) as Record<string, unknown>;

      const payload: Record<string, unknown> = {};
      if (campos.loginAttempts !== undefined && usersColumns.login_attempts) {
        payload.login_attempts = campos.loginAttempts;
      }
      if (campos.lockedUntil !== undefined && usersColumns.locked_until) {
        payload.locked_until = campos.lockedUntil;
      }
      if (Object.keys(payload).length === 0) {
        logger.warn(
          'Colunas de lockout ausentes na tabela users — bloqueio por tentativas ' +
          'não sobrevive a restart. Rode a migração 025_users_mfa_e_lockout.',
        );
        return;
      }

      await db('users').where('id', userId).update(payload);
    } catch (error) {
      // Nunca derruba o login por causa da contabilização de falhas.
      logger.error('Falha ao persistir contador de tentativas de login', {
        userId, error: (error as Error).message,
      });
    }
  }

  /**
   * Verificar rate limiting para login
   */
  private checkLoginRateLimit(email: string): void {
    const attempt = loginAttemptsStore.get(email);

    if (attempt) {
      if (new Date() < attempt.resetTime) {
        if (attempt.attempts >= AuthService.MAX_TENTATIVAS_LOGIN) {
          throw new RateLimitError(
            `Too many login attempts. Try again in ${AuthService.BLOQUEIO_MINUTOS} minutes.`,
          );
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
        // Mesma janela do bloqueio persistido, para os dois não divergirem.
        resetTime: new Date(Date.now() + AuthService.BLOQUEIO_MINUTOS * 60 * 1000),
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
      isActive: true,
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

  static generateAccessToken(user: {
    id: string;
    email: string;
    role: string;
    company_id?: string;
  }): string {
    const secret = process.env.JWT_SECRET ?? envConfig.jwt.secret;
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role, companyId: user.company_id },
      secret,
      { expiresIn: envConfig.jwt.expiry as any, algorithm: envConfig.jwt.algorithm },
    );
  }

  static generateRefreshToken(userId: string): string {
    const secret = process.env.JWT_REFRESH_SECRET ?? envConfig.jwt.refreshSecret;
    return jwt.sign({ userId }, secret, { expiresIn: envConfig.jwt.refreshExpiry as any });
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
