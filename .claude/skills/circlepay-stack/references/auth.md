# Auth — Phone → OTP → PIN

Matches the PRD onboarding (`frontend/app/onboarding`). Custom, because OTP is delivered through **Moolre SMS** and the credential is a 4-digit PIN.

> **State lives in Redis (TTL-based), not Postgres:** `otp:{phone}` (code hash + attempts), `otp:rl:{phone}` (rate-limit), `pin:fail:{userId}` / `pin:lock:{userId}` (lockout), `sess:{userId}:{jti}` (refresh-session for rotation + reuse-detection). Durable identity (`User`, `TrustScore`) stays in Postgres. Implemented in `backend/src/{redis,auth,notifications}`.

## Flow

1. **Request OTP** — user enters phone (+233, network). Server generates a 6-digit OTP, stores a **hash** with a short TTL, rate-limits per phone/IP, and sends it via Moolre SMS (`moolre-integration` `sendSms`).
2. **Verify OTP** — user submits code; server checks hash + TTL + attempt count. On success, marks the phone verified and issues a short-lived **registration token** (or session if returning user).
3. **Set/Confirm PIN** — new user creates a 4-digit PIN (entered twice). Server hashes with **argon2id** and stores it. Returning users **log in** with phone + PIN (after an OTP step or directly, per risk).
4. **Session** — issue **JWT access (short, ~15m)** + **refresh (longer, rotating)**; set both as **httpOnly, Secure, SameSite cookies**. `/auth/refresh` rotates; `/auth/logout` clears.

## Endpoints (`/api/auth`)

| Endpoint | Body | Result |
|---|---|---|
| `POST /request-otp` | `{ phone, network }` | sends OTP (always 200 to avoid enumeration) |
| `POST /verify-otp` | `{ phone, code }` | verified → reg/session token |
| `POST /set-pin` | `{ pin, confirmPin }` (auth: reg token) | creates account, issues session |
| `POST /login` | `{ phone, pin }` | session (consider OTP step-up) |
| `POST /refresh` | — (refresh cookie) | rotates tokens |
| `POST /logout` | — | clears cookies |
| `GET /me` | — (access cookie) | current user + `trust` summary (`standing`, `onTimeRate`, `fundsCompleted`) |
| `PATCH /me` | `{ name }` | update profile (name); returns the `me` shape |

## Rules & hardening

- **OTP:** 6 digits, ~5-min TTL, max ~5 attempts, then re-request with backoff. Store only the hash. Resend timer mirrors the UI ("Resend in 4:32").
- **PIN:** argon2id hashed; never logged; lockout after repeated failures. **Never ask for the PIN by call/SMS** — state this in UI (already in onboarding copy).
- **Tokens:** access ~15m, refresh rotating with reuse detection; both httpOnly. Frontend calls API with `credentials: 'include'`.
- **KYC:** phone is the Ghana Card-verified MoMo number (per PRD); store `network`.
- **Enumeration:** `request-otp` returns 200 regardless of whether the phone exists.

## Frontend

The onboarding screens already exist; wire each step to the endpoints above and store nothing sensitive client-side (the cookie carries the session). Biometric/App-lock toggles (profile) are device-side UX, layered on top of the PIN session.
