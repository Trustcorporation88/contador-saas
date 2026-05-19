# O Contador

**Sistema de Contabilidade Multi-tenant para o Brasil**

> O único sistema que une a usabilidade do Xero com a conformidade fiscal completa da Lei 6.404/76, SPED Contábil e Simples Nacional — em um único produto.

---

## Por que O Contador supera os concorrentes?

| Recurso | Omie ERP | Contabilizei | QuickBooks | Xero | **O Contador** |
|---|:---:|:---:|:---:|:---:|:---:|
| Partidas dobradas Lei 6.404/76 | ✅ | ❌ | ❌ | ❌ | ✅ |
| SPED Contábil (ECD/ECF) | ✅ | ❌ | ❌ | ❌ | ✅ |
| NF-e / NFS-e integrado | ✅ | ✅ | ❌ | ❌ | ✅ |
| Simples Nacional (DAS) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Multi-tenant SaaS | ❌ | ❌ | ✅ | ✅ | ✅ |
| UI moderna (React SPA) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Desktop offline (Electron) | ❌ | ❌ | ❌ | ❌ | ✅ |
| MFA TOTP | ❌ | ❌ | ✅ | ✅ | ✅ |
| Trilha de auditoria SHA-256 | ❌ | ❌ | ❌ | ❌ | ✅ |
| Open Source / Self-hosted | ❌ | ❌ | ❌ | ❌ | ✅ |

**Referência:** [Xero](https://www.xero.com) é o sistema mais próximo em UX — mas não tem conformidade com a legislação brasileira.

---

## Funcionalidades

### Contabilidade Completa (Lei 6.404/76)
- **Plano de Contas** hierárquico (5 níveis, COSIF)
- **Lançador de Partidas Dobradas** com validação em tempo real
- **Postagem e Estorno** de lançamentos com hash SHA-256 de integridade
- **Balanço Patrimonial**, **DRE**, **Balancete** e **Livro Razão**

### Fiscal Brasileiro
- **Simples Nacional**: cálculo por Anexo I (comércio) e Anexo III (serviços), alíquotas 2025/2026
- **Lucro Presumido**: presunção por atividade (8% / 16% / 32%)
- **Lucro Real**: IRPJ 15% + adicional 10%, CSLL 9%, PIS 1,65%, COFINS 7,6%
- **DAS mensal** calculado automaticamente
- Workflow de apuração: Pendente → Aprovado → Recolhido

### Auditoria & Segurança
- Trilha de auditoria imutável (audit_log + access_audit)
- Hash SHA-256 em cada lançamento postado
- MFA TOTP (Google Authenticator, Authy, 1Password)
- JWT HS256 (access 1h / refresh 7d)
- Multi-tenant com isolamento total por empresa

### Experiência do Usuário
- Interface React 18 SPA — sem recarregamentos de página
- App desktop Electron 31 (Windows .exe, macOS .dmg, Linux .AppImage)
- TanStack Query: dados sempre frescos, cache inteligente
- Formulários com validação Zod em tempo real
- Exportação XLSX + PDF em todos os relatórios

---

## Stack Técnica

```
Backend                  Frontend                  Desktop
─────────────────────    ──────────────────────    ─────────────────
Node.js 18 + Express     React 18 + TypeScript     Electron 31
TypeScript strict        Vite 5 (build < 3s)       electron-builder
PostgreSQL + Knex.js     Tailwind CSS 3            NSIS (.exe)
JWT HS256                TanStack Query v5          DMG (macOS)
bcrypt + TOTP            React Hook Form + Zod      AppImage (Linux)
SHA-256 audit hash       Recharts + date-fns        
OpenAPI 3.0              React Router DOM v6        
```

---

## Início Rápido

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- npm 9+

### Backend

```bash
cd backend
cp .env.example .env          # configure DATABASE_URL, JWT_SECRET
npm install
npm run migrate               # cria tabelas e plano de contas padrão
npm run dev                   # porta 3000
```

### Frontend (web)

```bash
cd frontend
npm install
npm run dev                   # Vite em localhost:5173
```

### Desktop (Electron)

```bash
cd frontend
npm run electron:build        # gera instalador na plataforma atual
# Windows:  npm run build:win  → dist-electron-build/*.exe
# Linux:    npm run build:linux → dist-electron-build/*.AppImage
```

---

## Testes E2E

```bash
cd frontend
npx playwright test           # executa suíte completa
npx playwright test tests/beta-release.spec.ts --project=chromium --config=playwright.release.config.ts
npx playwright test --ui      # modo visual interativo
npx playwright show-report    # relatório HTML
```

---

## Estrutura do Projeto

```
o-contador/
├── backend/
│   ├── src/
│   │   ├── controllers/      # auth, companies, accounts, journals, reports, taxes, audit
│   │   ├── models/dtos/      # TypeScript interfaces + validação
│   │   ├── routes/           # Express routers
│   │   ├── services/         # business logic
│   │   └── middleware/       # auth JWT, multi-tenant, logger
│   └── migrations/           # Knex migrations (PostgreSQL)
├── frontend/
│   ├── src/
│   │   ├── pages/            # 10 módulos funcionais
│   │   │   ├── Dashboard/    # KPIs + gráficos
│   │   │   ├── Empresas/     # CRUD multi-empresa
│   │   │   ├── Contas/       # Plano de contas hierárquico
│   │   │   ├── Lancamentos/  # Lançador + listagem
│   │   │   ├── Relatorios/   # BP, DRE, Balancete, Razão
│   │   │   ├── Impostos/     # Apuração Simples/LP/LR
│   │   │   ├── Auditoria/    # Logs + controle de acesso
│   │   │   └── Configuracoes/# Empresa, perfil, MFA
│   │   ├── services/         # API clients (axios)
│   │   ├── store/            # Zustand (auth + empresa)
│   │   └── components/       # Button, Input, Modal, ...
│   ├── electron/             # main.ts + preload.ts
│   └── tests/                # Playwright E2E specs
└── README.md
```

---

## Segurança (OWASP Top 10)

| Risco | Mitigação |
|---|---|
| Injection | Knex.js parameterized queries, Zod input validation |
| Broken Auth | JWT HS256 + refresh rotation + MFA TOTP |
| Sensitive Data | bcrypt hash, HTTPS enforced, no secrets in code |
| Broken Access Control | Multi-tenant middleware, role-based guards |
| Security Misconfiguration | Helmet.js headers, CORS whitelist |
| Audit Trail | SHA-256 hash em lançamentos, log imutável |

---

## Licença

Privado — © 2026 O Contador. Todos os direitos reservados.
