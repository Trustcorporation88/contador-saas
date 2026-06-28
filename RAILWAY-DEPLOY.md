# Migração Render → Railway — O Contador

Guia para tirar o backend e o PostgreSQL do Render e rodar no Railway.

## Arquitetura final

| Componente | Onde |
|------------|------|
| Frontend (React/Vite) | Vercel — `contador-saas.vercel.app` |
| Backend (Node/Express) | Railway — serviço `contador-api` |
| PostgreSQL | Railway — plugin Postgres |
| Redis (opcional) | Railway — plugin Redis (recomendado para logout/rate limit) |

---

## Passo 1 — Criar projeto no Railway

1. Acesse https://railway.app → **New Project**
2. **Add PostgreSQL** (plugin)
3. **Add Service** → **GitHub Repo** → `Trustcorporation88/contador-saas`
4. No serviço do backend:
   - **Root Directory:** vazio (raiz do repo — inclui `automacao-xml/` e `backend/`)
   - **Builder:** Dockerfile via `railway.toml` na raiz

---

## Passo 2 — Variáveis de ambiente (backend)

No serviço **contador-api**, em **Variables**:

| Variável | Valor |
|----------|--------|
| `DATABASE_URL` | Referência `${{Postgres.DATABASE_URL}}` (linkar o plugin) |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `JWT_SECRET` | string longa aleatória (32+ chars) |
| `JWT_REFRESH_SECRET` | outra string longa |
| `CORS_ORIGIN` | `https://contador-saas.vercel.app,https://contador-saas-ashy.vercel.app,https://procontador.com.br,https://www.procontador.com.br,http://localhost:5173` |
| `ADMIN_BOOTSTRAP_EMAIL` | `admin@procontador.com.br` |
| `ADMIN_BOOTSTRAP_PASSWORD` | senha forte do admin |
| `ADMIN_BOOTSTRAP_FORCE_RESET` | `true` (só no 1º deploy) |
| `BCRYPT_ROUNDS` | `10` |
| `ENABLE_RATE_LIMITING` | `true` |
| `CACHE_ENABLED` | `false` (se não tiver Redis ainda) |
| `DEEPSEEK_API_KEY` | (opcional) |

**Não defina `PORT`** — o Railway injeta automaticamente.

### Redis (opcional, recomendado)

1. **Add Redis** no mesmo projeto
2. Variáveis:
   - `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - `CACHE_ENABLED` = `true`

---

## Passo 3 — Deploy do backend

### Autodeploy via GitHub (recomendado)

1. Serviço **contador-api** → **Settings** → **Root Directory** = vazio (`/`, raiz do repo)
2. Repo conectado: `Trustcorporation88/contador-saas` branch `master`
3. Cada `git push` em `master` dispara build via `railway.toml` + `backend/Dockerfile`

### Deploy manual (CLI)

```bash
cd backend
npm run deploy:railway
```

Ou na raiz do repo:

```bash
railway link    # projeto contador-saas → serviço contador-api
railway up --detach --service contador-api
```

**Importante:** não rode `railway up` na raiz sem `--service contador-api` (existe outro serviço `contador-saas` sem Postgres).

Após o deploy, copie a URL pública, ex.:
`https://contador-api-production.up.railway.app`

Teste:
```bash
curl https://SEU-BACKEND.up.railway.app/health
curl https://SEU-BACKEND.up.railway.app/api/v1/health
```

---

## Passo 4 — Atualizar Vercel (frontend)

No projeto **contador-saas** no Vercel → **Settings → Environment Variables**:

| Nome | Valor |
|------|--------|
| `BACKEND_URL` | `https://SEU-BACKEND.up.railway.app` (sem barra no final) |

O proxy `/api/*` usa `frontend/api/[...path].js` com essa variável.

Redeploy do frontend:
```bash
cd frontend
vercel deploy --prod --scope trustcorporation88s-projects
```

---

## Passo 5 — Desligar Render

Quando Railway estiver OK:

1. Render → **contador-backend** → suspend/delete
2. Render → **contador-db** → export backup se precisar dos dados antigos
3. Remover secrets de Render do GitHub Actions (se houver)

---

## Migração de dados (se já tinha dados no Render)

1. No Render: **contador-db** → backup / `pg_dump`
2. No Railway Postgres: `psql $DATABASE_URL < backup.sql`
3. Ou começar do zero — o backend roda migrations no boot

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `DATABASE_URL` inválida | Usar `${{Postgres.DATABASE_URL}}` do plugin, não URL do Render |
| Login 502 no Vercel | Conferir `BACKEND_URL` no Vercel e redeploy |
| CORS error | Incluir domínio Vercel em `CORS_ORIGIN` |
| Redis fail no health | `CACHE_ENABLED=false` ou adicionar Redis no Railway |
| Migrations | Automáticas no startup — ver logs `Running migrations...` |
