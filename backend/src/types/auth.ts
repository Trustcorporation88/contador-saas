/**
 * Authentication & Authorization Type Definitions
 * TypeScript interfaces para estruturas de autenticação
 */

// JWT Payload
export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: string;
  companyId: string;
  iat: number; // issued at
  exp: number; // expiration
}

// Login Request/Response
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    mfaEnabled: boolean;
  };
}

// Refresh Token Request/Response
export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// MFA Setup
export interface MFASetupResponse {
  qrCode: string; // base64 encoded
  secret: string;
  backupCodes: string[]; // 10 backup codes
}

// MFA Verification
export interface MFAVerifyRequest {
  code: string; // 6 digit TOTP code
}

export interface MFAVerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    mfaEnabled: boolean;
  };
}

// Token info for validation
export interface TokenInfo {
  isValid: boolean;
  decoded?: JWTPayload;
  error?: string;
}

// Refresh Token DB record
export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

// MFA Secrets storage
export interface MFASecrets {
  secret: string;
  backupCodesHash: string[]; // bcrypt hashed codes
  enabledAt: Date;
}

// Auth Error types
export class InvalidCredentialsError extends Error {
  constructor(message: string = 'Invalid email or password') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidTokenError extends Error {
  constructor(message: string = 'Invalid or expired token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class MFARequiredError extends Error {
  constructor(message: string = 'MFA verification required') {
    super(message);
    this.name = 'MFARequiredError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Too many login attempts. Please try again later.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class TokenRevokedError extends Error {
  constructor(message: string = 'Refresh token has been revoked') {
    super(message);
    this.name = 'TokenRevokedError';
  }
}
