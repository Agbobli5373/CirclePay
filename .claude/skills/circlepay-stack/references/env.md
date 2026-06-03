# Environment Variables

Two sets — frontend (public-safe) and backend (secrets). Starters: `assets/frontend.env.example`, `assets/backend.env.example`.

## Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api   # Nest.js API base
```
Only `NEXT_PUBLIC_*` vars are exposed to the browser. **No secrets here.**

## Backend (`backend/.env`)
```
# Server
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database (Neon Postgres)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Auth / sessions
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5

# Moolre (see moolre-integration skill)
MOOLRE_BASE_URL=https://sandbox.moolre.com
MOOLRE_API_USER=...
MOOLRE_API_KEY=
MOOLRE_PUBKEY=
MOOLRE_VASKEY=
MOOLRE_ACCOUNT_NUMBER=...
MOOLRE_WEBHOOK_SECRET=...
MOOLRE_SMS_SENDER_ID=CirclePay   # must be approved at app.moolre.com

# Jobs / locks / queue (concurrency — see operations.md)
REDIS_URL=                 # optional: distributed locks / BullMQ queue
WORKER=false               # set true on the single instance that runs jobs (if not using locks/queue)

# Observability
SENTRY_DSN=

# AI Advisor (deferred — when going live)
# ANTHROPIC_API_KEY=...
```

## Rules
- Secrets live **only** in the backend. Never prefix a secret with `NEXT_PUBLIC_`.
- Use separate sandbox vs live Moolre values per environment.
- Rotate `JWT_*` and Moolre private key if leaked.
