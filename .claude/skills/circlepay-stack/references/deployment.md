# Deployment & Local Dev

## Local dev
- Monorepo with pnpm workspaces. Root scripts run both apps (e.g. `pnpm --filter frontend dev`, `pnpm --filter backend start:dev`).
- Add a **second `.claude/launch.json` config** for the backend (port 4000) alongside the existing frontend `dev` (port 3000, `cwd: frontend`). Frontend `NEXT_PUBLIC_API_URL` → `http://localhost:4000/api`.
- DB: a Neon dev branch or local Postgres; `pnpm --filter backend prisma migrate dev`.

## Hosting
- **Frontend → Vercel** (Next.js). Set `NEXT_PUBLIC_API_URL` to the deployed API URL.
- **Backend → Render / Railway / Fly.io** (long-running Node; needed for `@nestjs/schedule` jobs and webhooks). Vercel serverless is a poor fit for cron + persistent webhooks.
- **Database → Neon** (managed Postgres). Run `prisma migrate deploy` on release.

## Cross-origin
- Backend `CORS_ORIGIN` = the deployed frontend origin, `credentials: true`.
- Cookies in prod: `Secure`, `HttpOnly`, `SameSite=None` if frontend/api are on different sites (else `Lax`). Serve both over HTTPS.

## Webhooks & jobs
- Register the Moolre callback to the **backend** public URL: `https://api.yourapp.com/api/webhooks/moolre/<MOOLRE_WEBHOOK_SECRET>`.
- `@nestjs/schedule` runs disbursement, reconciliation, and SMS reminders on the always-on backend host.

## Secrets
- Configure env per platform's secret store (never commit `.env`). Keep sandbox vs live Moolre + separate JWT secrets per environment.

## CI (suggested)
- Typecheck + lint + Vitest (frontend) and Jest/Supertest (backend); `prisma validate`; build both apps. Block deploy on red.
