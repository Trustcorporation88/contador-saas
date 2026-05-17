# Setup Detalhado - Contador App Backend

Guia passo a passo para configurar o ambiente de desenvolvimento do backend.

## 📋 Pré-requisitos

### Sistema
- Windows 10/11 ou MacOS/Linux
- 4GB RAM mínimo
- 5GB espaço em disco

### Softwares
- **Node.js**: v18 LTS ou superior ([Download](https://nodejs.org/))
- **npm**: v9+ (incluído com Node.js)
- **Git**: ([Download](https://git-scm.com/))
- **PostgreSQL Client** (opcional, para ferramentas de BD)
- **Docker Desktop**: ([Download](https://www.docker.com/products/docker-desktop/))

### Verificar instalação

```bash
node --version    # v18.0.0+
npm --version     # 9.0.0+
docker --version  # 20.0.0+
```

## 🚀 Setup Inicial (15 minutos)

### 1. Clonar/Abrir o repositório

```bash
cd c:\jpg
# ou git clone ... se for repositório
```

### 2. Navegar para o backend

```bash
cd backend
```

### 3. Instalar dependências

```bash
npm install
```

Isso instalará todas as 25+ dependências listadas em `package.json`.

**Tempo esperado**: 3-5 minutos (primeira vez)

### 4. Configurar variáveis de ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar conforme necessário (a maioria dos valores já está correta)
code .env
```

**Variáveis críticas para desenvolvimento**:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://contador_user:contador_password@localhost:5432/contador_db
JWT_SECRET=desenvolvimento_secret_key_change_in_production
```

### 5. Iniciar PostgreSQL com Docker

```bash
# Inicia PostgreSQL + Redis
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs (opcional)
docker-compose logs -f postgres
```

**Esperado**: Duas linhas mostrando `postgres` e `redis` com status `Up`

### 6. Iniciar servidor de desenvolvimento

```bash
npm run dev
```

**Esperado na saída**:
```
Servidor rodando em http://localhost:3000
Conectado ao banco de dados
```

**Pronto!** O backend está rodando.

## 🔧 Configuração Avançada

### PostgreSQL

#### Conexão Local

```bash
# Conectar ao banco via psql (se PostgreSQL estiver instalado)
psql -U contador_user -d contador_db -h localhost

# Ou via Docker
docker exec -it contador_postgres psql -U contador_user -d contador_db
```

#### Verificar inicialização dos scripts SQL

```bash
# Listar tabelas criadas
docker exec -it contador_postgres psql -U contador_user -d contador_db -c "\dt"
```

**Scripts executados automaticamente**:
- `001_create_accounts.sql` → Tabela `accounts`
- `002_create_journal_tables.sql` → Tabelas `journals`, `journal_items`
- `003_create_audit_triggers.sql` → Triggers de auditoria
- `004_create_companies_users.sql` → Tabelas `companies`, `users`
- `005_create_documents_attachments.sql` → Tabelas de documentos
- `006_create_tax_tables.sql` → Tabelas de impostos

#### Resetar banco (desenvolvimento apenas)

```bash
# Parar containers
docker-compose down

# Remover dados persistidos
docker volume rm backend_postgres_data

# Reiniciar
docker-compose up -d
```

### Redis (Cache)

```bash
# Conectar ao Redis
docker exec -it contador_redis redis-cli

# Verificar conexão
> ping
# Resposta: PONG

# Listar chaves
> KEYS *

# Sair
> exit
```

### TypeScript

#### Compilar para JavaScript

```bash
npm run build

# Ou watch mode (recompila ao salvar)
npm run build:watch
```

Output em `dist/` (Git ignored)

#### Verificar tipos

```bash
# TSC sem emitir arquivo
npx tsc --noEmit
```

### Linting e Formatting

#### ESLint

```bash
# Verificar erros
npm run lint

# Corrigir automaticamente
npm run lint:fix
```

#### Prettier

```bash
# Formatar código
npm run format
```

**Integração com VS Code**:
1. Instalar extensões:
   - ESLint (Microsoft)
   - Prettier (Prettier)
2. Configurar formato no save:

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## ✅ Testes

### Executar testes

```bash
npm test
```

### Modo watch

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

Output em `coverage/` (Git ignored)

## 🐛 Troubleshooting

### Erro: "Port 3000 is already in use"

```bash
# Mudar em .env
PORT=3001

# Ou matar processo
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Erro: "Cannot connect to database"

```bash
# Verificar Docker está rodando
docker-compose ps

# Verificar logs
docker-compose logs postgres

# Reiniciar PostgreSQL
docker-compose restart postgres

# Aguardar healthcheck (até 1 minuto)
sleep 30
npm run dev
```

### Erro: "ENOENT: no such file or directory, open '.env'"

```bash
# Arquivo .env não existe
cp .env.example .env
```

### Erro de dependências no npm install

```bash
# Limpar cache
npm cache clean --force

# Remover node_modules
rm -rf node_modules package-lock.json

# Reinstalar
npm install
```

### TypeScript erros na compilação

```bash
# Verificar todos os erros
npx tsc --noEmit

# Forçar recompilação limpa
npm run clean
npm run build
```

## 📦 Dependências Principais

### Explicação rápida

| Pacote | Para quê |
|--------|----------|
| `express` | Framework web (rotas, middleware) |
| `pg` | Driver para conectar ao PostgreSQL |
| `knex` | Query builder para SQL |
| `jsonwebtoken` | Gerar e validar tokens JWT |
| `bcrypt` | Criptografar senhas |
| `helmet` | Headers de segurança HTTP |
| `cors` | Permitir requisições cross-origin |
| `winston` | Sistema de logging estruturado |
| `joi` | Validar inputs |
| `speakeasy` | 2FA com TOTP |
| `node-cache` | Cache em memória |
| `axios` | Cliente HTTP |
| `dotenv` | Carregar variáveis de ambiente |
| `typescript` | Tipagem estática |
| `jest` | Framework de testes |
| `eslint` | Linter (erros de estilo) |
| `prettier` | Formatação de código |

### Atualizar dependências

```bash
# Ver updates disponíveis
npm outdated

# Atualizar todas
npm update

# Atualizar específica
npm install express@latest
```

## 🔐 Segurança

### Antes de colocar em produção

1. **Alterar JWT_SECRET**
   ```env
   JWT_SECRET=gere_uma_chave_criptografica_segura_com_32_caracteres
   ```

2. **Alterar DATABASE_PASSWORD**
   ```env
   DATABASE_PASSWORD=senha_segura_aqui
   ```

3. **Configurar CORS corretamente**
   ```env
   CORS_ORIGIN=https://seu-frontend.com
   ```

4. **Ativar HTTPS** (produção)
   ```env
   NODE_ENV=production
   ```

5. **Secrets Management**
   - Usar serviço como AWS Secrets Manager
   - Ou HashiCorp Vault
   - Nunca colocar .env em Git

## 📁 Estrutura de Arquivos Criados

```
backend/
├── src/
│   ├── app.ts              # Express app (stub)
│   ├── server.ts           # Entry point (stub)
│   ├── config/
│   │   ├── database.ts     # Conexão PostgreSQL (stub)
│   │   ├── env.ts          # Validação de env vars (stub)
│   │   └── constants.ts
│   ├── middleware/
│   │   ├── auth.ts         # JWT middleware (stub)
│   │   ├── errorHandler.ts # Global error handler (stub)
│   │   └── requestLogger.ts # Winston logger (stub)
│   ├── routes/
│   │   ├── index.ts        # Main router
│   │   ├── auth.ts
│   │   ├── companies.ts
│   │   ├── accounts.ts
│   │   ├── journals.ts
│   │   ├── reports.ts
│   │   ├── taxes.ts
│   │   └── audit.ts
│   ├── controllers/        # (vazio - será populado)
│   ├── services/           # (vazio - será populado)
│   ├── models/             # (vazio - será populado)
│   ├── utils/              # (vazio - será populado)
│   └── types/              # (vazio - será populado)
├── tests/                  # (vazio - será populado)
├── dist/                   # (vazio - gerado ao compilar)
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .env.example
├── .env                    # Seu arquivo de configuração
├── .gitignore
├── docker-compose.yml
├── README.md
└── SETUP.md                # Este arquivo
```

## 🚀 Próximos Passos

1. **Implementar Controllers** (Tarefa 2.2)
   - Autenticação
   - Gestão de empresas
   - Plano de contas

2. **Implementar Services** (Tarefa 2.3)
   - Lógica de negócio
   - Integração com banco de dados

3. **Implementar Models** (Tarefa 2.4)
   - Queries SQL
   - ORM mappings

4. **Testes** (Tarefa 2.5)
   - Unit tests com Jest
   - Integration tests
   - E2E tests

5. **Documentação API** (Tarefa 2.6)
   - OpenAPI/Swagger

## 📚 Recursos Adicionais

- [Express.js Docs](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Knex.js Docs](http://knexjs.org/)
- [Jest Docs](https://jestjs.io/)

## 💬 Suporte

Dúvidas?
- Verificar arquivo `.env` e variáveis de ambiente
- Verificar logs com `npm run dev`
- Verificar Docker está rodando
- Consultar [../ARQUITETURA-TECNICA.md](../ARQUITETURA-TECNICA.md)

---

**Versão**: 1.0.0  
**Data**: 2026-05-17  
**Status**: Ready for development ✅
