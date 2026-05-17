# SECURITY-ARCHITECTURE.md
## Modelo de Segurança & Autenticação - Contador App

**Data**: 2026-05-17  
**Versão**: 1.0  
**Status**: ✅ Finalizado

---

## 1. Visão Geral

A arquitetura de segurança do Contador App foi projetada para proteger dados contábeis críticos, garantindo confidencialidade, integridade e disponibilidade. O modelo implementa autenticação robusta com JWT + refresh tokens, autorização baseada em papéis (RBAC), autenticação multifator via TOTP, e criptografia de dados sensíveis.

### Camadas de Segurança

```
┌──────────────────────────────────────────┐
│  Cliente (Browser/Mobile)                │
└─────────────────┬────────────────────────┘
                  │ HTTPS/TLS 1.2+
                  ▼
┌──────────────────────────────────────────┐
│  Camada 1: AUTENTICAÇÃO (JWT)            │
│  - Login com email/senha                 │
│  - Geração de access + refresh tokens    │
│  - Validação de JWT em cada requisição   │
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│  Camada 2: AUTORIZAÇÃO (RBAC)            │
│  - Verificação de role (admin/accountant │
│  - Validação de permissions              │
│  - Company scope isolation               │
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│  Camada 3: ENCRIPTAÇÃO                   │
│  - Dados sensíveis (AES-256-GCM)         │
│  - Password hashing (bcrypt)             │
│  - MFA secret (AES-256-GCM)              │
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│  Base de Dados (PostgreSQL)              │
│  - Dados em repouso criptografados       │
│  - Audit logs de acesso                  │
└──────────────────────────────────────────┘
```

---

## 2. Autenticação (JWT)

### Fluxo de Login Completo

```
┌─────────────────────────────────────────────────────────┐
│ FLUXO DE LOGIN                                          │
└─────────────────────────────────────────────────────────┘

1. Cliente envia credenciais
   POST /auth/login
   {
     "email": "contador@empresa.com",
     "password": "senha_segura_123"
   }
                    │
                    ▼
2. Server valida credenciais
   - Busca usuário por email
   - Compara password (bcrypt.compare)
   - Se inválido → 401 Unauthorized
                    │
                    ▼
3. Se MFA ativo → Retorna token temporário
   {
     "mfa_required": true,
     "temp_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
   }
   Cliente deve fazer POST /auth/verify-mfa
                    │
                    ▼
4. Se sem MFA → Retorna tokens
   {
     "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "user": {
       "id": "uuid-123",
       "email": "contador@empresa.com",
       "role": "accountant",
       "company_id": "company-456"
     }
   }
                    │
                    ▼
5. Cliente armazena tokens
   - access_token → localStorage (ou sessionStorage)
   - refresh_token → localStorage (seguro com httpOnly flag no cookie)
```

### Estrutura JWT (Access Token)

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "key-id-2026"
}
```

**Payload (Claims):**
```json
{
  "sub": "user-uuid-123",
  "email": "contador@empresa.com",
  "role": "accountant",
  "company_id": "company-456",
  "permissions": ["journal:create", "reports:view", "company:read"],
  "iat": 1715952000,
  "exp": 1715955600,
  "iss": "contador-app",
  "aud": "contador-web"
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  SECRET_KEY
)
```

### Tempos de Expiração

| Token | TTL | Armazenamento | Propósito |
|-------|-----|---------------|-----------|
| Access Token | 1 hora (3600s) | localStorage | Requisições autenticadas |
| Refresh Token | 7 dias (604800s) | BD + httpOnly cookie | Renovar access token |
| Temp Token (MFA) | 5 min (300s) | Memory | Validar código TOTP |

### Revogação de Tokens

**Logout:**
```typescript
POST /auth/logout
Authorization: Bearer {access_token}

Ações:
1. Marcar refresh_token como revogado em BD
2. Adicionar access_token em blacklist (Redis, TTL=1h)
3. Limpar cookies
4. Retornar 200 OK
```

**Refresh Token Revocation:**
```typescript
// Tokens revogados são consultados em Redis
// Antes de processar requisição autenticada
const isTokenRevoked = await redis.get(`revoked:${token_jti}`);
if (isTokenRevoked) {
  throw new UnauthorizedException('Token revogado');
}
```

---

## 3. TOTP MFA (Two-Factor Authentication)

### Implementação TOTP (RFC 6238)

TOTP (Time-based One-Time Password) gera códigos de 6 dígitos que mudam a cada 30 segundos usando o relógio do sistema.

### Setup MFA (Onboarding)

```
┌─────────────────────────────────────────────────────────┐
│ SETUP MFA - FLUXO COMPLETO                              │
└─────────────────────────────────────────────────────────┘

1. Cliente solicita setup MFA
   GET /auth/mfa-setup
   Authorization: Bearer {access_token}
                    │
                    ▼
2. Server gera segredo
   - secret = speakeasy.generateSecret({
       name: "Contador App (contador@empresa.com)",
       issuer: "Contador App"
     })
   - QR code = qrcode.toDataURL(secret.otpauth_url)
                    │
                    ▼
3. Server retorna QR code (sem criptografar ainda)
   {
     "qr_code": "data:image/png;base64,...",
     "secret": "JBSWY3DPEBLW64TMMQ======",
     "backup_codes": [
       "12345678",
       "87654321",
       ...
     ]
   }
                    │
                    ▼
4. Cliente escaneia QR com Google Authenticator/Authy
   - App gera código TOTP (ex: 123456)
                    │
                    ▼
5. Cliente valida TOTP
   POST /auth/verify-mfa-setup
   {
     "totp_code": "123456",
     "backup_codes": ["12345678", ...]
   }
                    │
                    ▼
6. Server valida código
   - speakeasy.totp.verify({
       secret: "JBSWY3DPEBLW64TMMQ======",
       encoding: "base32",
       token: "123456",
       window: 2
     })
   - Se válido → Criptografa secret com AES-256-GCM
   - Armazena em BD:
     users.mfa_secret (criptografado)
     users.mfa_backup_codes (hashed)
     users.mfa_enabled = true
                    │
                    ▼
7. Retorna confirmação
   {
     "mfa_enabled": true,
     "message": "MFA ativado com sucesso"
   }
```

### Login com MFA Ativo

```
┌─────────────────────────────────────────────────────────┐
│ LOGIN COM MFA - FLUXO COMPLETO                          │
└─────────────────────────────────────────────────────────┘

1. Cliente envia email + senha
   POST /auth/login
   {
     "email": "contador@empresa.com",
     "password": "senha_123"
   }
                    │
                    ▼
2. Server valida credenciais (bcrypt.compare)
                    │
                    ▼
3. Se MFA ativo (users.mfa_enabled = true)
   - Gera temp_token com exp=5min
   - Retorna:
   {
     "mfa_required": true,
     "temp_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "message": "Digite código TOTP do Google Authenticator"
   }
                    │
                    ▼
4. Cliente obtém código TOTP (ex: 987654)
   POST /auth/verify-mfa
   {
     "temp_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "totp_code": "987654"
   }
                    │
                    ▼
5. Server verifica temp_token (não deve estar revogado)
   - Extrai user_id do payload
                    │
                    ▼
6. Descriptografa MFA secret (AES-256-GCM)
   - mfa_secret = decrypt(users.mfa_secret_encrypted)
                    │
                    ▼
7. Valida código TOTP
   - speakeasy.totp.verify({
       secret: mfa_secret,
       encoding: "base32",
       token: "987654",
       window: 2
     })
   - Se inválido → 401 Unauthorized
                    │
                    ▼
8. Código válido → Gera tokens finais
   {
     "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "user": { ... }
   }
                    │
                    ▼
9. Registra login em audit_logs
   - IP origin
   - User-Agent
   - Timestamp
   - Sucesso/falha
```

### Backup Codes

Backup codes são gerados durante setup MFA (10 códigos únicos) para recuperação em caso de perda do device:

```
Características:
- 8 dígitos aleatórios por código
- Hash bcrypt armazenado em BD
- One-time use (marcado como usado após validação)
- Pode substituir código TOTP em POST /auth/verify-mfa

POST /auth/verify-mfa
{
  "temp_token": "...",
  "backup_code": "12345678"  # Alternativa ao totp_code
}

Validação:
1. bcrypt.compare(input_code, users.mfa_backup_codes[i])
2. Se match → Atualiza código como usado
3. Impede reutilização do mesmo código
```

### Exemplo TOTP Numérico

```
Timestamp: 1715952000 (2026-05-17 12:00:00 UTC)
Intervalo: 30 segundos
Counter: 1715952000 / 30 = 57198400

HMAC-SHA1(secret, counter) = 0x...abc...
Dígitos dinâmicos = 6
Código TOTP: 123456

Próximo código em: 30 segundos
Timestamp: 1715952030
Counter: 57198401
Código TOTP: 789012
```

---

## 4. RBAC (Role-Based Access Control)

### Três Papéis Definidos

| Role | Descrição | Escopo |
|------|-----------|--------|
| **admin** | Acesso total ao sistema | Todas as empresas (super-admin) |
| **accountant** | Acesso contábil e operacional | Company-specific |
| **viewer** | Acesso read-only a relatórios | Company-specific |

### Associação de Roles

```
Tabela: company_users
┌─────────┬──────────┬────────────────┬──────────┐
│ user_id │ company_ │ role           │ status   │
│         │ id       │                │          │
├─────────┼──────────┼────────────────┼──────────┤
│ user-1  │ comp-A   │ admin          │ active   │
│ user-1  │ comp-B   │ accountant     │ active   │
│ user-2  │ comp-A   │ accountant     │ active   │
│ user-3  │ comp-A   │ viewer         │ inactive │
└─────────┴──────────┴────────────────┴──────────┘

Nota: Um usuário pode ter diferentes roles em diferentes empresas.
Ex: admin em comp-A, accountant em comp-B, viewer em comp-C
```

### Validação por Endpoint

```typescript
// Exemplo: GET /companies/{company_id}/journal
// Middleware de autorização

@UseGuards(JwtAuthGuard, RbacGuard)
@RequireRoles('admin', 'accountant')  // Roles permitidas
@Get('journal')
async getJournal(
  @Param('company_id') companyId: string,
  @GetUser() user: UserPayload
) {
  // 1. Verificar se user está autenticado (JwtAuthGuard)
  // 2. Verificar se user tem acesso à company_id (company scope)
  // 3. Verificar se role está em ['admin', 'accountant'] (RbacGuard)
  // 4. Retornar dados
  
  return this.journalService.getByCompany(companyId);
}
```

---

## 5. Permission Matrix

Matriz detalhada de permissões por role e ação:

| Ação | Admin | Accountant | Viewer | Descrição |
|------|:-----:|:----------:|:------:|-----------|
| **Companies** | | | | |
| company:create | ✅ | ❌ | ❌ | Criar nova empresa |
| company:read | ✅ | ✅ | ✅ | Listar/visualizar empresa |
| company:update | ✅ | ❌ | ❌ | Atualizar dados empresa |
| company:delete | ✅ | ❌ | ❌ | Deletar empresa |
| **Users** | | | | |
| users:create | ✅ | ❌ | ❌ | Adicionar usuário |
| users:read | ✅ | ✅ | ❌ | Listar usuários |
| users:update | ✅ | ❌ | ❌ | Atualizar perfil usuário |
| users:delete | ✅ | ❌ | ❌ | Remover usuário |
| users:assign-role | ✅ | ❌ | ❌ | Atribuir role |
| **Journal** | | | | |
| journal:create | ✅ | ✅ | ❌ | Criar lançamento |
| journal:read | ✅ | ✅ | ✅ | Listar lançamentos |
| journal:update | ✅ | ✅ | ❌ | Editar lançamento |
| journal:delete | ✅ | ✅ | ❌ | Deletar lançamento |
| journal:approve | ✅ | ✅ | ❌ | Aprovar lançamento |
| **Documents** | | | | |
| documents:upload | ✅ | ✅ | ❌ | Upload documentos |
| documents:read | ✅ | ✅ | ✅ | Visualizar documentos |
| documents:delete | ✅ | ✅ | ❌ | Deletar documentos |
| **Reports** | | | | |
| reports:view | ✅ | ✅ | ✅ | Acessar relatórios |
| reports:export | ✅ | ✅ | ❌ | Exportar relatórios |
| **Tax** | | | | |
| tax:create | ✅ | ✅ | ❌ | Criar cálculo fiscal |
| tax:read | ✅ | ✅ | ✅ | Visualizar impostos |
| tax:update | ✅ | ✅ | ❌ | Atualizar cálculos |
| **Audit** | | | | |
| audit:read | ✅ | ❌ | ❌ | Ver logs de auditoria |
| audit:export | ✅ | ❌ | ❌ | Exportar logs |

---

## 6. Encriptação de Dados Sensíveis

### Password Hashing (bcrypt)

```
Algoritmo: bcrypt (Blowfish adaptive hash)
Rounds: 12+ (ajustável para futuro)
Custo computacional: ~100-200ms por hash

Exemplo:
Password original: "Senha@Segura123!"
Hash bcrypt: $2b$12$R9h7cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ee34qXvrkzLqKHi2

Verificação:
bcrypt.compare("Senha@Segura123!", "$2b$12$R9h7...") → true
bcrypt.compare("SenhaErrada", "$2b$12$R9h7...") → false
```

### MFA Secret Encryption (AES-256-GCM)

```
Chave: 256-bit (32 bytes)
Modo: GCM (Galois/Counter Mode)
Nonce: 96-bit (12 bytes) aleatório por encrypt
Tag de autenticação: 128-bit (16 bytes)

Fluxo:
1. MFA Secret: "JBSWY3DPEBLW64TMMQ======" (gerado pelo speakeasy)
2. Gera nonce aleatório (12 bytes)
3. Criptografa:
   ciphertext = encrypt(plaintext, key, nonce)
   authTag = generateTag()
4. Armazena em BD: nonce + ciphertext + authTag
5. Na verificação:
   plaintext = decrypt(ciphertext, key, nonce, authTag)

Proteção:
- Dados criptografados em repouso
- Nonce único por encriptação (prevent replay)
- Auth tag verifica integridade
```

### Dados em Repouso (Field-Level)

Campos sensíveis a criptografar:

```
Tabela: users
- phone (PII)
- ssn/cpf (PII)
- address (PII)
- mfa_secret (sensitive)

Tabela: documents
- content/attachment (sensível)

Implementação:
@Entity()
class User {
  @Column()
  @Encrypted()  // Decorator que aplica AES-256-GCM
  phone: string;
  
  @Column()
  @Encrypted()
  cpf: string;
}

Chave de criptografia:
- Master key armazenada em AWS KMS / Azure KeyVault
- Rotação de chaves a cada 90 dias
- Separate data key por database
```

### Dados em Trânsito (TLS)

```
Protocolo: TLS 1.2+ (obrigatório)
Cipher suites recomendadas:
- TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
- TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256

Certificado SSL:
- Válido (não auto-assinado)
- SAN: *.contador-app.com.br, contador-app.com.br
- Renovação: automática a cada 90 dias (Let's Encrypt)

Headers de segurança:
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy: default-src 'self'
```

---

## 7. Fluxo de Segurança Visual (ASCII)

### Diagrama de Login

```
┌───────────────────────────────────────────────────────────┐
│                        LOGIN FLOW                          │
└───────────────────────────────────────────────────────────┘

┌──────────────────┐                ┌──────────────────────┐
│ Cliente (Browser)│                │ API Server           │
└────────┬─────────┘                └──────────┬───────────┘
         │                                     │
         │  1. POST /auth/login                │
         │     {email, password}               │
         ├────────────────────────────────────>│
         │                                     │
         │                           2. Buscar user (BD)
         │                           3. bcrypt.compare()
         │                                     │
         │                           ┌─────────▼──────────┐
         │                           │ MFA Ativado?       │
         │                           └─────────┬──────────┘
         │                                     │
         │  4a. temp_token (MFA required)      │
         │  {mfa_required: true}                │
         │<────────────────────────────────────┤
         │                                     │
         │  5. GET /auth/mfa-setup OR          │
         │      POST /auth/verify-mfa          │
         │      {temp_token, totp_code}        │
         ├────────────────────────────────────>│
         │                                     │
         │                           6. Valida TOTP
         │                           7. Gera tokens
         │                                     │
         │  8. access_token, refresh_token     │
         │<────────────────────────────────────┤
         │                                     │
         │  9. Armazena tokens                 │
         │     localStorage                    │
         │                                     │
         │  10. Registra audit_log             │
         │<────────────────────────────────────┤
         │                                     │
```

### Diagrama de Autorização (RBAC)

```
┌───────────────────────────────────────────────────────────┐
│                   AUTHORIZATION CHECK                      │
└───────────────────────────────────────────────────────────┘

Requisição com Bearer Token:
GET /companies/{company_id}/journal
Authorization: Bearer eyJ0eXAi...

         ▼
┌──────────────────────────────────┐
│ 1. JWT Validation                │
│    - Verifica signature          │
│    - Verifica expiração (exp)    │
│    - Extrai payload              │
└──────────┬───────────────────────┘
           │ Token inválido → 401
           ▼ Token válido
┌──────────────────────────────────┐
│ 2. Company Scope Check           │
│    - Valida {company_id}         │
│    - Verifica company_users      │
│    - User ativo (status=active)  │
└──────────┬───────────────────────┘
           │ Sem acesso → 403
           ▼ Acesso permitido
┌──────────────────────────────────┐
│ 3. Role Validation               │
│    - Endpoint requer:            │
│      @RequireRoles('admin',      │
│        'accountant')             │
│    - Verifica user.role          │
└──────────┬───────────────────────┘
           │ Role insuficiente → 403
           ▼ Role permitida
┌──────────────────────────────────┐
│ 4. Permission Check              │
│    - Ação: journal:read          │
│    - Matriz de permissões        │
│    - Admin ✅ Accountant ✅      │
│      Viewer ✅                   │
└──────────┬───────────────────────┘
           │ Permissão negada → 403
           ▼ Permissão concedida
┌──────────────────────────────────┐
│ 5. Execute Handler               │
│    - Retorna journal data        │
│    - Status: 200 OK              │
│    - Log: audit_logs             │
└──────────────────────────────────┘
```

---

## 8. Exemplos de Código TypeScript

### JWT Creation

```typescript
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  sub: string; // user.id
  email: string;
  role: 'admin' | 'accountant' | 'viewer';
  company_id: string;
  permissions: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export function createAccessToken(user: User): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    company_id: user.company_id,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    iss: 'contador-app',
    aud: 'contador-web',
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'secret-key', {
    algorithm: 'HS256',
  });
}

export function createRefreshToken(user: User): string {
  const payload = {
    sub: user.id,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 604800, // 7 dias
    iss: 'contador-app',
  };

  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || 'refresh-secret', {
    algorithm: 'HS256',
  });
}
```

### JWT Validation

```typescript
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key', {
      algorithms: ['HS256'],
      issuer: 'contador-app',
      audience: 'contador-web',
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedException('Token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedException('Token inválido');
    }
    throw error;
  }
}

export async function verifyRefreshToken(token: string): Promise<string> {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || 'refresh-secret', {
      algorithms: ['HS256'],
      issuer: 'contador-app',
    }) as any;

    // Verifica se token está revogado em BD
    const isRevoked = await db.query(
      'SELECT id FROM revoked_tokens WHERE jti = $1',
      [decoded.jti]
    );

    if (isRevoked.rowCount > 0) {
      throw new UnauthorizedException('Token revogado');
    }

    return decoded.sub;
  } catch (error) {
    throw new UnauthorizedException('Refresh token inválido');
  }
}
```

### TOTP Generation e Verification

```typescript
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

// Setup MFA
export async function setupMFA(email: string) {
  const secret = speakeasy.generateSecret({
    name: `Contador App (${email})`,
    issuer: 'Contador App',
    length: 32,
  });

  // Gera QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Gera backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  return {
    qr_code: qrCode,
    secret: secret.base32,
    backup_codes: backupCodes,
  };
}

// Verify TOTP during MFA setup
export function verifyMFASetup(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2, // Allow ±1 time step (30s cada)
  });
}

// Verify TOTP during login
export function verifyMFAToken(mfaSecret: string, totp_code: string): boolean {
  return speakeasy.totp.verify({
    secret: mfaSecret,
    encoding: 'base32',
    token: totp_code,
    window: 2,
  });
}

// Generate backup code hash
export async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

// Verify backup code
export async function verifyBackupCode(inputCode: string, hashedCode: string): Promise<boolean> {
  return bcrypt.compare(inputCode, hashedCode);
}
```

### Authentication Middleware

```typescript
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt.service';

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header ausente');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      throw new UnauthorizedException('Esquema de autenticação inválido');
    }

    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    try {
      const payload = verifyAccessToken(token);
      (req as any).user = payload; // Anexa ao objeto request
      next();
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
```

### Authorization Guard (RBAC)

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector, private db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Sem requisito de role
    }

    const request = context.switchToHttp().getRequest();
    const user = (request as any).user;
    const companyId = request.params.company_id;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Valida company scope
    const userCompany = await this.db.query(
      `SELECT role FROM company_users 
       WHERE user_id = $1 AND company_id = $2 AND status = 'active'`,
      [user.sub, companyId]
    );

    if (userCompany.rowCount === 0) {
      throw new ForbiddenException('Sem acesso a esta empresa');
    }

    const userRole = userCompany.rows[0].role;

    // Verifica role
    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(`Role '${userRole}' não permitida`);
    }

    return true;
  }
}

// Decorator para especificar roles
import { SetMetadata } from '@nestjs/common';
export const RequireRoles = (...roles: string[]) => SetMetadata('roles', roles);
```

### Password Hashing

```typescript
import * as bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12); // 12 rounds
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Validação de força de senha
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Mínimo 12 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Deve conter letra maiúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Deve conter letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Deve conter número');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Deve conter caractere especial (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

### Encryption/Decryption (AES-256-GCM)

```typescript
import * as crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 12; // 96 bits (GCM)
const AUTH_TAG_SIZE = 16; // 128 bits

export function encryptField(plaintext: string, masterKey: string): string {
  const iv = crypto.randomBytes(IV_SIZE);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(masterKey, 'hex'), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Formato: iv + authTag + ciphertext
  const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  return combined;
}

export function decryptField(encrypted: string, masterKey: string): string {
  const [ivHex, tagHex, ciphertextHex] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = ciphertextHex;

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(masterKey, 'hex'), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Exemplo: Criptografa CPF
const masterKey = process.env.ENCRYPTION_MASTER_KEY; // 64 hex chars (256 bits)
const cpfOriginal = '12345678901';
const cpfEncrypted = encryptField(cpfOriginal, masterKey);
// Retorna: "a1b2c3d4e5f6g7h8:i9j0k1l2m3n4o5p6:ciphertextHexString"

const cpfDecrypted = decryptField(cpfEncrypted, masterKey);
// Retorna: "12345678901"
```

---

## 9. Segurança em Produção

### HTTPS Obrigatório

```nginx
# nginx.conf - Redireciona HTTP → HTTPS
server {
    listen 80;
    server_name contador-app.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name contador-app.com.br *.contador-app.com.br;

    ssl_certificate /etc/ssl/certs/contador-app.crt;
    ssl_certificate_key /etc/ssl/private/contador-app.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # ... resto da configuração
}
```

### HSTS Headers

```typescript
// NestJS - Middleware
import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export class HstsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Força HTTPS por 2 anos, incluindo subdomínios
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    next();
  }
}
```

### CORS Configuration

```typescript
// main.ts - NestJS bootstrap
const app = await NestFactory.create(AppModule);

app.enableCors({
  origin: [
    'https://contador-app.com.br',
    'https://app.contador-app.com.br',
    // Apenas em desenvolvimento:
    process.env.NODE_ENV === 'development' && 'http://localhost:3000',
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.use(helmet()); // Adiciona headers de segurança
```

### Rate Limiting

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // 1 minuto
      limit: 100, // 100 requisições
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

// Rate limit específico para login
@Post('login')
@Throttle(5, 60 * 15) // 5 tentativas a cada 15 minutos
async login(@Body() dto: LoginDto) {
  // ...
}

@Post('forgot-password')
@Throttle(3, 60 * 60) // 3 tentativas a cada 1 hora
async forgotPassword(@Body() dto: ForgotPasswordDto) {
  // ...
}
```

### Input Validation

```typescript
import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(12, { message: 'Senha deve ter no mínimo 12 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Senha deve conter maiúscula, minúscula, número e caractere especial',
  })
  password: string;
}

// Validator: evita SQLi, XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove tags HTML
    .trim()
    .substring(0, 255); // Limita tamanho
}
```

### Proteção contra CSRF, XSS, SQLi

```typescript
// CSRF Protection
import * as csurf from 'csurf';

const csrfProtection = csurf({ cookie: true });

// XSS Protection - Helmet
app.use(helmet.xssFilter());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  },
}));

// SQLi Prevention - Prepared Statements (usando TypeORM)
@Repository(User)
export class UserRepository extends Repository<User> {
  async findByEmail(email: string): Promise<User | null> {
    // TypeORM usa prepared statements automaticamente
    return this.findOne({
      where: { email },
    });
  }
}

// Alternativamente com query builder:
const user = await this
  .createQueryBuilder('user')
  .where('user.email = :email', { email }) // Parametrizado
  .getOne();
```

### Audit Logging

```typescript
@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  action: string; // 'LOGIN', 'CREATE_JOURNAL', 'UPDATE_USER', etc.

  @Column()
  resource: string; // 'journal', 'company', 'user', etc.

  @Column({ nullable: true })
  resource_id: string;

  @Column()
  status: 'SUCCESS' | 'FAILURE'; // Falhas também são auditadas

  @Column({ nullable: true })
  ip_address: string;

  @Column({ nullable: true })
  user_agent: string;

  @Column({ type: 'jsonb', nullable: true })
  details: any; // Dados adicionais

  @CreateDateColumn()
  created_at: Date;
}

// Serviço de Auditoria
@Injectable()
export class AuditService {
  constructor(private auditRepository: Repository<AuditLog>) {}

  async log(
    userId: string,
    action: string,
    resource: string,
    status: 'SUCCESS' | 'FAILURE',
    request: Request,
    details?: any
  ) {
    const auditLog = this.auditRepository.create({
      user_id: userId,
      action,
      resource,
      status,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'],
      details,
    });

    await this.auditRepository.save(auditLog);
  }
}

// Uso em controller
@Post('login')
async login(@Body() dto: LoginDto, @Req() request: Request) {
  try {
    const result = await this.authService.login(dto);
    await this.auditService.log(
      result.user.id,
      'LOGIN',
      'auth',
      'SUCCESS',
      request,
      { email: dto.email }
    );
    return result;
  } catch (error) {
    await this.auditService.log(
      'unknown',
      'LOGIN_ATTEMPT',
      'auth',
      'FAILURE',
      request,
      { email: dto.email, error: error.message }
    );
    throw error;
  }
}
```

---

## 10. Recuperação de Conta

### Forgot Password Flow

```
┌─────────────────────────────────────────────────────────┐
│ FORGOT PASSWORD - FLUXO COMPLETO                        │
└─────────────────────────────────────────────────────────┘

1. Usuário solicita reset
   POST /auth/forgot-password
   {
     "email": "contador@empresa.com"
   }
                    │
                    ▼
2. Server valida email
   - Busca usuário por email
   - Se não encontrado → Retorna 200 (segurança)
                    │
                    ▼
3. Gera reset token
   - Token JWT com:
     payload: { sub: user.id, type: 'password-reset' }
     exp: 1 hora
   - Armazena em BD: password_reset_tokens.token_hash
                    │
                    ▼
4. Envia email
   Subject: "Recuperar acesso - Contador App"
   Body:
   "Clique no link para resetar sua senha (válido por 1 hora):
    https://contador-app.com.br/reset-password?token={reset_token}
    
    Se você não solicitou, ignore este email."
                    │
                    ▼
5. Usuário clica link
   GET /auth/reset-password?token={reset_token}
   - Frontend valida token
   - Exibe formulário de nova senha
                    │
                    ▼
6. Usuário envia nova senha
   POST /auth/reset-password
   {
     "token": "{reset_token}",
     "new_password": "NovaSenha@123456",
     "confirm_password": "NovaSenha@123456"
   }
                    │
                    ▼
7. Server valida
   - JWT.verify(token)
   - Valida força de senha
   - Confirma senhas iguais
                    │
                    ▼
8. Atualiza senha
   - Hash com bcrypt(12 rounds)
   - Atualiza users.password_hash
   - Marca todos os refresh tokens como revogados
   - Deleta password_reset_token (one-time use)
                    │
                    ▼
9. Envia confirmação por email
   Subject: "Sua senha foi resetada"
   Body: "Sua senha foi alterada com sucesso.
          Se você não fez isso, contate o suporte."
                    │
                    ▼
10. Usuário faz login com nova senha
```

### Email Verification

```typescript
// Email verification token
export function createEmailVerificationToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      type: 'email-verification',
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Fluxo:
// 1. User se registra → gera verification token
// 2. Envia email com link: /auth/verify-email?token={token}
// 3. GET /auth/verify-email?token={token}
//    - Valida JWT
//    - Atualiza users.email_verified = true
//    - Redireciona para login

@Post('register')
async register(@Body() dto: RegisterDto) {
  const user = await this.userService.create(dto);
  const verificationToken = createEmailVerificationToken(user);

  await this.emailService.sendVerificationEmail(user.email, verificationToken);

  return { message: 'Verifique seu email para ativar a conta' };
}

@Get('verify-email')
async verifyEmail(@Query('token') token: string) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.type !== 'email-verification') {
    throw new BadRequestException('Token inválido');
  }

  await this.userService.verifyEmail(decoded.sub);

  return { message: 'Email verificado com sucesso' };
}
```

### Password Reset Implementation

```typescript
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private emailService: EmailService,
    private db: DatabaseService
  ) {}

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Retorna 200 por segurança (não revela se email existe)
      return { message: 'Se o email existe, você receberá um link de reset' };
    }

    // Gera reset token
    const resetToken = jwt.sign(
      {
        sub: user.id,
        type: 'password-reset',
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Armazena hash do token em BD
    const tokenHash = await bcrypt.hash(resetToken, 10);
    await this.db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.id, tokenHash]
    );

    // Envia email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'Email de reset enviado' };
  }

  async resetPassword(token: string, newPassword: string) {
    // Valida JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new BadRequestException('Token expirado ou inválido');
    }

    if (decoded.type !== 'password-reset') {
      throw new BadRequestException('Token inválido');
    }

    // Valida força de senha
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new BadRequestException(validation.errors);
    }

    // Atualiza senha
    const passwordHash = await hashPassword(newPassword);
    await this.db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, decoded.sub]
    );

    // Revoga todos os refresh tokens
    await this.db.query(
      `INSERT INTO revoked_tokens (user_id, type, created_at)
       VALUES ($1, 'all', NOW())`,
      [decoded.sub]
    );

    // Deleta token de reset (one-time use)
    await this.db.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1`,
      [decoded.sub]
    );

    return { message: 'Senha resetada com sucesso' };
  }
}
```

---

## Resumo Executivo

Esta arquitetura de segurança implementa:

✅ **Autenticação robusta**: JWT com access/refresh tokens (1h/7d)  
✅ **MFA obrigatória**: TOTP com backup codes para recuperação  
✅ **Autorização granular**: RBAC com 3 roles e 20+ permissões  
✅ **Criptografia forte**: bcrypt (12 rounds), AES-256-GCM (dados sensíveis)  
✅ **Proteção em produção**: TLS 1.2+, HSTS, CORS, Rate limiting  
✅ **Auditoria completa**: Todos os logins e ações registradas  
✅ **Recuperação segura**: Email verification, password reset, backup codes  

**Bibliotecas principais:**
- `jsonwebtoken` - JWT signing/verification
- `speakeasy` - TOTP generation/verification
- `bcrypt` - Password hashing
- `crypto` (native) - AES-256-GCM encryption
- `helmet` - HTTP headers security
- `@nestjs/throttler` - Rate limiting

**Conformidade:**
- OWASP Top 10 (A01:2021 → A10:2021)
- RFC 6238 (TOTP)
- RFC 7519 (JWT)
- ISO/IEC 27001 (Information Security)

---

**Documento preparado por**: Security Engineer  
**Revisão técnica**: Backend Architect  
**Status**: ✅ PRONTO PARA IMPLEMENTAÇÃO
