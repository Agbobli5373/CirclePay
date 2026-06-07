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
APP_BASE_URL=http://localhost:3000   # public app URL used in invite SMS join links

# Database (Neon Postgres)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Auth / sessions
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5

# Susu economics & lifecycle
PLATFORM_FEE_FLAT=0    # pesewas; fee = FLAT + amount*BPS/10000
PLATFORM_FEE_BPS=0
GRACE_HOURS=48         # hours after due date before an overdue member defaults + is locked

# Moolre (see moolre-integration skill)
MOOLRE_BASE_URL=https://sandbox.moolre.com
MOOLRE_API_USER=...
MOOLRE_API_KEY=
MOOLRE_PUBKEY=
MOOLRE_VASKEY=
MOOLRE_ACCOUNT_NUMBER=...
MOOLRE_WEBHOOK_SECRET=...
MOOLRE_SMS_SENDER_ID=CirclePay   # must be approved at app.moolre.com
MOOLRE_SUBLIST_ID=               # beneficiary sublist for disbursements/payouts
MOOLRE_TIMEOUT_MS=15000          # per-request HTTP timeout so a payment call never hangs the worker
MOOLRE_MOCK_ENABLED=false        # DEV ONLY: in-process Moolre mock (self-settles via webhook); ignored in production
MOOLRE_MOCK_SETTLE_MS=2500       # delay before the mock's settlement webhook fires
USSD_GATEWAY_SECRET=change-me    # E10: guards POST /api/ussd/<secret> (like the Moolre webhook secret)
USSD_SESSION_TTL_SECONDS=120     # how long an idle USSD session's Redis state is kept

# Jobs / locks / queue (concurrency — see operations.md)
REDIS_URL=redis://localhost:6380   # REQUIRED: ephemeral auth state (OTP, lockout, sessions)
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
