/**
 * Application-wide constants
 * HTTP status codes, error codes, business logic constants
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error Codes
export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
} as const;

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  AUDITOR: 'auditor',
  ACCOUNTANT: 'accountant',
  MANAGER: 'manager',
  VIEWER: 'viewer',
} as const;

// Account Types
export const ACCOUNT_TYPES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

// Journal Entry Status
export const JOURNAL_STATUS = {
  DRAFT: 'draft',
  POSTED: 'posted',
  CANCELLED: 'cancelled',
  REVERSED: 'reversed',
} as const;

// Tax Regimes
export const TAX_REGIMES = {
  LUCRO_REAL: 'lucro_real',
  LUCRO_PRESUMIDO: 'lucro_presumido',
  SIMPLES_NACIONAL: 'simples_nacional',
} as const;

// Common Tax Types
export const TAX_TYPES = {
  ICMS: 'ICMS',
  COFINS: 'COFINS',
  PIS: 'PIS',
  ISS: 'ISS',
  IRPJ: 'IRPJ',
  CSLL: 'CSLL',
  IRRF: 'IRRF',
  INSS: 'INSS',
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 3600, // 1 hour
  LONG: 86400, // 24 hours
} as const;

// Date Formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Currency (Brazilian Real)
export const CURRENCY = {
  CODE: 'BRL',
  SYMBOL: 'R$',
  DECIMAL_PLACES: 2,
} as const;

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  EMAIL_MAX_LENGTH: 255,
  NAME_MAX_LENGTH: 255,
  ACCOUNT_CODE_MAX_LENGTH: 20,
} as const;

// API Limits
export const API_LIMITS = {
  MAX_REQUEST_BODY_SIZE: '10mb',
  MAX_FILE_UPLOAD_SIZE: 50 * 1024 * 1024, // 50MB
  REQUEST_TIMEOUT_MS: 30000,
} as const;

export default {
  HTTP_STATUS,
  ERROR_CODES,
  USER_ROLES,
  ACCOUNT_TYPES,
  JOURNAL_STATUS,
  TAX_REGIMES,
  TAX_TYPES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  CACHE_TTL,
  DATE_FORMAT,
  DATETIME_FORMAT,
  CURRENCY,
  VALIDATION,
  API_LIMITS,
};
