# AGENTS.md

## Cursor Cloud specific instructions

### Overview

"O Contador" is a multi-tenant Brazilian accounting SaaS. The two services that must
run for local development are:

| Service  | Path        | Dev command   | URL                     | Notes |
|----------|-------------|---------------|-------------------------|-------|
| Backend  | `backend/`  | `npm run dev` | http://localhost:3000   | Node/Express + TypeScript (ts-node). Health: `/health`. API base: `/api/v1`. Needs PostgreSQL + Redis. |
| Frontend | `frontend/` | `npm run dev` | http://localhost:5173   | React 18 + Vite. Reads `VITE_API_URL` from `frontend/.env`. |

Standard scripts are documented in `README.md`, `backend/README.md`, and the
`scripts` blocks of `backend/package.json` / `frontend/package.json`:
- Lint: `npm run lint` (both; reports warnings only, exits 0).
- Backend tests: `npm test` (Jest; run from `backend/`).
- Build: `npm run build` (both).
- Frontend E2E: `npm run test:e2e` (Playwright; requires `npx playwright install` for browsers, not run during setup).

### Required backing services (NOT installed by the update script)

PostgreSQL 16 and Redis 7 are installed at the system level and captured in the VM
snapshot, but they are **not running on boot**. Start them at the beginning of each
session before starting the backend:

```
sudo pg_ctlcluster 16 main start
sudo redis-server --daemonize yes
```

- Postgres role/db already exist in the snapshot: user `contador_user` / password
  `contador_password` / database `contador_db` (owner `contador_user`).
- Verify with `sudo -u postgres psql -c "\l"` and `redis-cli ping`.

### Environment files (gitignored)

`backend/.env` and `frontend/.env` are gitignored and were created during setup from
their `.env.example` templates. They persist in the VM snapshot. If either is missing,
recreate it from the matching `.env.example`. The only values that must point at the
local services are:
- `backend/.env`: `DATABASE_URL=postgresql://contador_user:contador_password@localhost:5432/contador_db`,
  `REDIS_URL=redis://localhost:6379`, `REDIS_HOST=localhost`, and any non-empty `JWT_SECRET`.
- `frontend/.env`: `VITE_API_URL=http://localhost:3000`.

### Database migrations & bootstrap

- The backend runs migrations automatically on startup (`initializeDatabase`), and also
  bootstraps demo companies/users. You normally do NOT need to run migrations manually,
  but `npm run migrate` (from `backend/`) is available.
- Demo login accounts (created automatically on startup) — useful for testing:
  - `simplesnacional@procontador.com.br` / `SimplesNacional@2026`
  - `lucropresumido@procontador.com.br` / `LucroPresumido@2026`
  - `lucroreal@procontador.com.br` / `LucroReal@2026`
  - `mei@procontador.com.br` / `Mei@2026`
- Gotcha: `npm run seed:dev-user` currently fails with a Postgres "column does not exist"
  error (pre-existing bug, unrelated to environment setup). It is not needed — use the
  demo accounts above instead.

### Schema note

The `companies` table uses column `legal_name` (not `razao_social`/`name`) and stores
`tax_regime` values like `simples_nacional`. Keep this in mind when querying directly.
