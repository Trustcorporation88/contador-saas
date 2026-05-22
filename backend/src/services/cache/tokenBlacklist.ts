/**
 * JWT Token Blacklist Service
 * 
 * Gerencia revogação de tokens JWT usando Redis.
 * Permite logout forçado e invalidação de sessões comprometidas.
 * 
 * @module services/cache/tokenBlacklist
 */

import Redis from 'ioredis';
import { envConfig } from '../../config/env';
import { logger } from '../../middleware/requestLogger';

/**
 * Redis client singleton
 */
let redisClient: Redis | null = null;

/**
 * Inicializa conexão Redis
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      password: envConfig.redis.password || undefined,
      db: envConfig.redis.db,
      maxRetriesPerRequest: envConfig.redis.maxRetries,
      retryStrategy: (times: number) => {
        if (times > envConfig.redis.maxRetries) {
          logger.error('Redis max retries exceeded for token blacklist');
          return null;
        }
        return Math.min(times * envConfig.redis.retryDelay, 2000);
      },
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error in token blacklist', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Token blacklist Redis connected');
    });
  }

  return redisClient;
}

/**
 * Token metadata armazenado no blacklist
 */
interface BlacklistedTokenMetadata {
  userId: string;
  email?: string;
  companyId?: string;
  revokedAt: number;
  reason: 'logout' | 'revoke_all' | 'security' | 'password_change';
  expiresAt: number;
}

/**
 * Adiciona token ao blacklist
 * 
 * @param jti - JWT ID (unique identifier)
 * @param userId - ID do usuário
 * @param expiresAt - Timestamp de expiração do token (Unix timestamp em segundos)
 * @param reason - Motivo da revogação
 * @param metadata - Metadados adicionais
 */
export async function addToBlacklist(
  jti: string,
  userId: string,
  expiresAt: number,
  reason: BlacklistedTokenMetadata['reason'],
  metadata?: Partial<BlacklistedTokenMetadata>,
): Promise<void> {
  const redis = getRedisClient();
  const key = `blacklist:token:${jti}`;
  const now = Date.now();

  const tokenMetadata: BlacklistedTokenMetadata = {
    userId,
    email: metadata?.email,
    companyId: metadata?.companyId,
    revokedAt: now,
    reason,
    expiresAt: expiresAt * 1000, // Converte para ms
  };

  try {
    // Calcula TTL em segundos (expiry - now)
    const ttlSeconds = Math.max(1, Math.ceil((expiresAt * 1000 - now) / 1000));

    // Armazena no Redis com TTL automático
    await redis.setex(key, ttlSeconds, JSON.stringify(tokenMetadata));

    logger.info('Token added to blacklist', {
      jti,
      userId,
      reason,
      ttlSeconds,
    });
  } catch (error) {
    logger.error('Failed to add token to blacklist', {
      jti,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Verifica se token está no blacklist
 * 
 * @param jti - JWT ID
 * @returns true se token está blacklisted, false caso contrário
 */
export async function isBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `blacklist:token:${jti}`;

  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error('Failed to check token blacklist', {
      jti,
      error: error instanceof Error ? error.message : String(error),
    });
    // Em caso de erro, assume que token NÃO está blacklisted
    // (fail open para disponibilidade)
    return false;
  }
}

/**
 * Obtém metadados de token blacklisted
 * 
 * @param jti - JWT ID
 * @returns Metadata do token ou null se não blacklisted
 */
export async function getBlacklistMetadata(
  jti: string,
): Promise<BlacklistedTokenMetadata | null> {
  const redis = getRedisClient();
  const key = `blacklist:token:${jti}`;

  try {
    const data = await redis.get(key);
    if (!data) {
      return null;
    }

    return JSON.parse(data) as BlacklistedTokenMetadata;
  } catch (error) {
    logger.error('Failed to get blacklist metadata', {
      jti,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Revoga todos os tokens de um usuário
 * 
 * IMPORTANTE: Esta operação é pesada. Use com moderação.
 * Implementa uma blacklist de usuário com expiração.
 * 
 * @param userId - ID do usuário
 * @param expirySeconds - Tempo de validade da blacklist (padrão: 7 dias - refresh token expiry)
 * @param reason - Motivo da revogação
 */
export async function revokeAllUserTokens(
  userId: string,
  expirySeconds: number = 7 * 24 * 60 * 60, // 7 dias
  reason: BlacklistedTokenMetadata['reason'] = 'revoke_all',
): Promise<void> {
  const redis = getRedisClient();
  const key = `blacklist:user:${userId}`;
  const now = Date.now();

  const metadata = {
    userId,
    revokedAt: now,
    reason,
    expiresAt: now + expirySeconds * 1000,
  };

  try {
    await redis.setex(key, expirySeconds, JSON.stringify(metadata));

    logger.warn('All user tokens revoked', {
      userId,
      reason,
      expirySeconds,
    });
  } catch (error) {
    logger.error('Failed to revoke all user tokens', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Verifica se todos os tokens de um usuário estão revogados
 * 
 * @param userId - ID do usuário
 * @returns true se todos tokens do usuário estão revogados
 */
export async function isUserTokensRevoked(userId: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `blacklist:user:${userId}`;

  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error('Failed to check user token revocation', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Verifica se um token é válido (não está blacklisted)
 * Checa tanto blacklist individual quanto revogação total do usuário
 * 
 * @param jti - JWT ID
 * @param userId - ID do usuário
 * @param issuedAt - Timestamp de emissão do token (Unix timestamp em segundos)
 * @returns {valid, reason} - Resultado da verificação
 */
export async function validateToken(
  jti: string,
  userId: string,
  issuedAt: number,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // 1. Verifica blacklist de token específico
    const tokenBlacklisted = await isBlacklisted(jti);
    if (tokenBlacklisted) {
      const metadata = await getBlacklistMetadata(jti);
      return {
        valid: false,
        reason: metadata?.reason || 'token_revoked',
      };
    }

    // 2. Verifica se todos tokens do usuário foram revogados
    const userRevoked = await isUserTokensRevoked(userId);
    if (userRevoked) {
      const redis = getRedisClient();
      const key = `blacklist:user:${userId}`;
      const data = await redis.get(key);

      if (data) {
        const metadata = JSON.parse(data);
        // Token é inválido se foi emitido ANTES da revogação
        if (issuedAt * 1000 < metadata.revokedAt) {
          return {
            valid: false,
            reason: metadata.reason || 'user_tokens_revoked',
          };
        }
      }
    }

    return { valid: true };
  } catch (error) {
    logger.error('Token validation error', {
      jti,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail open: em caso de erro, considera token válido
    return { valid: true };
  }
}

/**
 * Remove token do blacklist (uso administrativo/debug)
 * 
 * @param jti - JWT ID
 */
export async function removeFromBlacklist(jti: string): Promise<void> {
  const redis = getRedisClient();
  const key = `blacklist:token:${jti}`;

  try {
    await redis.del(key);
    logger.info('Token removed from blacklist', { jti });
  } catch (error) {
    logger.error('Failed to remove token from blacklist', {
      jti,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Estatísticas do blacklist (uso administrativo/observabilidade)
 * 
 * @returns {tokenCount, userCount} - Estatísticas
 */
export async function getBlacklistStats(): Promise<{
  tokenCount: number;
  userCount: number;
}> {
  const redis = getRedisClient();

  try {
    const tokenKeys = await redis.keys('blacklist:token:*');
    const userKeys = await redis.keys('blacklist:user:*');

    return {
      tokenCount: tokenKeys.length,
      userCount: userKeys.length,
    };
  } catch (error) {
    logger.error('Failed to get blacklist stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { tokenCount: 0, userCount: 0 };
  }
}

export default {
  addToBlacklist,
  isBlacklisted,
  getBlacklistMetadata,
  revokeAllUserTokens,
  isUserTokensRevoked,
  validateToken,
  removeFromBlacklist,
  getBlacklistStats,
};
