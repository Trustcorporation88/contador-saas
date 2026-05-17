# Contador App - Backend

Backend Node.js/Express para sistema integrado de contabilidade corporativa com suporte a múltiplas empresas, auditorias e compliance regulatório.

## 📋 Características

- ✅ TypeScript strict mode
- ✅ Express.js framework modular
- ✅ PostgreSQL com connection pooling (Knex.js)
- ✅ JWT authentication com refresh tokens
- ✅ 2FA (TOTP) support
- ✅ Global error handling
- ✅ Request logging (Winston)
- ✅ CORS & Security headers (Helmet)
- ✅ Input validation (Joi)
- ✅ In-memory caching (node-cache)
- ✅ Docker Compose para desenvolvimento

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+ LTS
- npm 9+
- Docker & Docker Compose (opcional)

### Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env

# 3. Iniciar PostgreSQL (Docker)
docker-compose up -d

# 4. Desenvolvimento
npm run dev

# 5. Build para produção
npm run build
npm start
```

## 📁 Estrutura de Pastas

```
backend/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Entry point
│   ├── config/
│   │   ├── database.ts        # PostgreSQL connection pool
│   │   ├── env.ts             # Environment variables validation
│   │   └── constants.ts       # App constants
│   ├── middleware/
│   │   ├── auth.ts            # JWT validation
│   │   ├── errorHandler.ts    # Global error handling
│   │   └── requestLogger.ts   # Request logging
│   ├── routes/
│   │   ├── index.ts           # Main router
│   │   ├── auth.ts            # Authentication endpoints
│   │   ├── companies.ts       # Company management
│   │   ├── accounts.ts        # Chart of accounts
│   │   ├── journals.ts        # Journal entries
│   │   ├── reports.ts         # Financial reports
│   │   ├── taxes.ts           # Tax calculation
│   │   └── audit.ts           # Audit trails
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic
│   ├── models/                # Data models & queries
│   ├── utils/                 # Utility functions
│   └── types/                 # TypeScript interfaces
├── tests/                     # Jest test files
├── dist/                      # Compiled JavaScript
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

## 📝 Scripts NPM

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia servidor com ts-node (modo watch) |
| `npm start` | Inicia servidor de produção |
| `npm run build` | Compila TypeScript para JavaScript |
| `npm test` | Executa testes com Jest |
| `npm run lint` | Valida código com ESLint |
| `npm run format` | Formata código com Prettier |
| `npm run clean` | Remove diretório dist |

## 🔌 API Endpoints (Planejado)

### Autenticação
- `POST /api/v1/auth/register` - Registrar usuário
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Renovar token
- `POST /api/v1/auth/2fa/setup` - Setup 2FA
- `POST /api/v1/auth/2fa/verify` - Verificar 2FA

### Empresas
- `GET /api/v1/companies` - Listar empresas
- `POST /api/v1/companies` - Criar empresa
- `GET /api/v1/companies/:id` - Detalhes da empresa
- `PUT /api/v1/companies/:id` - Atualizar empresa

### Plano de Contas
- `GET /api/v1/accounts` - Listar contas
- `POST /api/v1/accounts` - Criar conta
- `GET /api/v1/accounts/:id` - Detalhes da conta
- `PUT /api/v1/accounts/:id` - Atualizar conta

### Lançamentos Contábeis
- `GET /api/v1/journals` - Listar lançamentos
- `POST /api/v1/journals` - Criar lançamento
- `GET /api/v1/journals/:id` - Detalhes do lançamento
- `DELETE /api/v1/journals/:id` - Deletar lançamento

### Relatórios
- `GET /api/v1/reports/balance-sheet` - Balanço Patrimonial
- `GET /api/v1/reports/income-statement` - DRE
- `GET /api/v1/reports/cash-flow` - Fluxo de Caixa

### Impostos
- `GET /api/v1/taxes/appraisal` - Apuração de impostos
- `POST /api/v1/taxes/register` - Registrar apuração

### Auditoria
- `GET /api/v1/audit/trails` - Logs de auditoria
- `GET /api/v1/audit/changes/:entityId` - Histórico de mudanças

## 🔐 Configuração de Segurança

### Variáveis de Ambiente Essenciais

```bash
# JWT
JWT_SECRET=sua_chave_muito_secreta_aqui

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
ENABLE_RATE_LIMITING=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

## 🗄️ Database

### Conexão PostgreSQL

O servidor usa Knex.js para gerenciar conexões com PostgreSQL através de um connection pool configurável:

```typescript
// Pool de conexões é inicializado em src/config/database.ts
// Min: 2 conexões
// Max: 10 conexões
// Timeout: 30s
```

### Scripts SQL de Inicialização

Os seguintes scripts SQL são executados automaticamente ao iniciar o Docker:
- `001_create_accounts.sql` - Tabela de contas
- `002_create_journal_tables.sql` - Tabelas de lançamentos
- `003_create_audit_triggers.sql` - Triggers de auditoria
- `004_create_companies_users.sql` - Empresas e usuários
- `005_create_documents_attachments.sql` - Documentos
- `006_create_tax_tables.sql` - Tabelas de impostos

## 📚 Documentação Adicional

- [SETUP.md](./SETUP.md) - Guia detalhado de configuração
- [../ARQUITETURA-TECNICA.md](../ARQUITETURA-TECNICA.md) - Arquitetura geral do sistema
- [../plano-contas-padrao.json](../plano-contas-padrao.json) - Plano de contas padrão

## 🧪 Testing

```bash
# Executar todos os testes
npm test

# Modo watch
npm run test:watch

# Coverage
npm run test:coverage
```

## 🐳 Docker

### Iniciar PostgreSQL

```bash
docker-compose up -d postgres
```

### Parar serviços

```bash
docker-compose down
```

### Ver logs

```bash
docker-compose logs -f postgres
```

## 📦 Dependências Principais

| Pacote | Versão | Propósito |
|--------|--------|----------|
| express | ^4.18.2 | Framework web |
| typescript | ^5.3.3 | Tipagem estática |
| pg | ^8.11.3 | Driver PostgreSQL |
| knex | ^3.1.0 | Query builder |
| jsonwebtoken | ^9.1.2 | JWT authentication |
| bcrypt | ^5.1.1 | Password hashing |
| helmet | ^7.1.0 | Security headers |
| winston | ^3.11.0 | Logging |
| joi | ^17.11.0 | Input validation |

## 🛠️ Desenvolvimento

### Adicionar nova rota

1. Criar arquivo em `src/routes/`
2. Criar controller em `src/controllers/`
3. Importar em `src/routes/index.ts`
4. Registrar em `src/app.ts`

### Adicionar novo service

1. Criar arquivo em `src/services/`
2. Implementar lógica de negócio
3. Usar em controllers

### Adicionar middleware

1. Criar arquivo em `src/middleware/`
2. Registrar em `src/app.ts` (ordem importa!)

## 🚨 Tratamento de Erros

O sistema implementa tratamento global de erros através do middleware `errorHandler.ts`:

- Erros de validação (Joi)
- Erros de autenticação (JWT)
- Erros de banco de dados
- Erros inesperados

Todos retornam response JSON estruturado.

## 📊 Logging

Utiliza Winston para logging estruturado:

```typescript
logger.info('Message', { context: 'value' });
logger.error('Error', { stack: error.stack });
```

Configuração em `.env`:
- `LOG_LEVEL` - Nível mínimo (debug, info, warn, error)
- `LOG_FORMAT` - Formato de output (json, simple)

## 🔗 Integração com Frontend

O backend expõe API RESTful em `http://localhost:3000/api/v1`.

CORS é configurado via `.env` variável `CORS_ORIGIN`.

## 📄 Licença

MIT

## 👥 Contribuição

Siga as convenções de código:
- TypeScript strict mode obrigatório
- ESLint + Prettier antes de commit
- Tipos explícitos em funções
- Async/await (não callbacks)

## 📞 Suporte

Para dúvidas ou problemas, consulte a [Arquitetura Técnica](../ARQUITETURA-TECNICA.md).
