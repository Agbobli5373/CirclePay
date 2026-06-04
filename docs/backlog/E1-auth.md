# E1 · Authentication (Phone → OTP → PIN → Session)

**Goal:** Implement the PRD onboarding: verify a Ghana MoMo number by SMS OTP (sent via Moolre), set a 4-digit PIN, and issue a cookie session. Returning users log in with phone + PIN.

**Out of scope:** biometric/app-lock (device UX), profile editing (E later). **Depends on:** E0; the OTP SMS needs E2-S1 (MoolreService) — or stub the sender behind an interface and swap in E2.
**References:** `circlepay-stack/references/auth.md`, `backend-conventions.md`; `moolre-integration` (`sendSms`); `circlepay-domain/references/ghana-context.md`.

> Security constants (env): `OTP_TTL_SECONDS=300`, `OTP_MAX_ATTEMPTS=5`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d`. PINs hashed with **argon2id**; OTPs stored **hashed**.

---

### E1-S1 · Request OTP [BE] (M)
**Story:** As a new/returning user, I want to receive an SMS code for my phone so I can prove I own the number.

**Acceptance criteria**
```
Scenario: Send a code
  Given a valid Ghana number "+233XXXXXXXXX" and network
  When I POST /api/auth/request-otp
  Then a 6-digit code is generated, its hash stored with expiresAt = now+OTP_TTL, attempts=0
  And the code is sent via Moolre SMS
  And the response is 200 { ok: true } (always, to avoid number enumeration)
Scenario: Rate limited
  Given more than 3 requests for the same phone within 10 minutes
  When I POST /api/auth/request-otp
  Then I receive 429 and no new SMS is sent
```
**Technical spec**
- `POST /api/auth/request-otp` — body Zod: `{ phone: string (E.164 +233…), network: 'MTN'|'Telecel'|'AirtelTigo' }`.
- Generate 6-digit code; store `OtpRequest { phone, codeHash(argon2), expiresAt, attempts:0 }`.
- Send via `NotificationsService.sendOtp(phone, code)` → Moolre `sendSms` (Sender ID `MOOLRE_SMS_SENDER_ID`). Message in user's language if known (default en).
- Rate-limit per phone+IP (e.g. 3/10min) — Redis or a DB window.
- Always 200 `{ ok: true }` (don't reveal existence). Errors: `429 RATE_LIMITED`.
**Data:** `OtpRequest`.
**Tasks:** [ ] DTO+Zod [ ] generate+hash+store [ ] send SMS [ ] rate limit [ ] tests (success, rate limit)
**DoD:** code arrives in sandbox; hash never logged; repeated calls throttle.

---

### E1-S2 · Verify OTP [BE] (M)
**Story:** As a user, I want to submit the code so I can continue onboarding/login.

**Acceptance criteria**
```
Scenario: Correct code
  Given an unexpired OtpRequest for the phone
  When I POST /api/auth/verify-otp { phone, code } with the right code
  Then it is marked consumed and I receive a short-lived registration token (new user) or a session (existing user)
Scenario: Wrong/expired code
  Given a wrong code or expiry passed or attempts >= OTP_MAX_ATTEMPTS
  Then I receive 400 OTP_INVALID and attempts increments (no session issued)
```
**Technical spec**
- `POST /api/auth/verify-otp` — `{ phone, code }`. Verify argon2 hash + `expiresAt` + `attempts < max`; increment on failure; set `consumedAt` on success.
- If `User` exists for phone → issue session (S4). Else → issue **registration token** (signed JWT, ~10min, claim `phase: 'set-pin'`, phone) returned in an httpOnly cookie or body for step S3.
- Errors: `OTP_INVALID`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`.
**Tasks:** [ ] verify logic [ ] reg-token vs session branch [ ] tests (correct, wrong, expired, lockout)
**DoD:** brute force capped; success path returns the right artifact for new vs existing user.

---

### E1-S3 · Create PIN (register) [BE] (M)
**Story:** As a new user, I want to set a 4-digit PIN so my account is secured.

**Acceptance criteria**
```
Scenario: Set PIN
  Given a valid registration token (phase set-pin) and { pin, confirmPin } that match (4 digits)
  When I POST /api/auth/set-pin
  Then a User is created (phone, network, language, pinHash argon2) with an empty TrustScore (standing "new")
  And a session (access+refresh cookies) is issued
Scenario: Mismatch / weak
  Given pin != confirmPin or pin not 4 digits or trivial (e.g. 0000,1234)
  Then 400 PIN_INVALID and no user created
```
**Technical spec**
- `POST /api/auth/set-pin` — guard: valid registration token. Body `{ pin, confirmPin }` (Zod: 4 digits, equal, blocklist trivial PINs).
- Create `User` + 1:1 `TrustScore { standing: new, segmentsFilled: 0, onTimeRate: 100 }`. Hash PIN argon2id.
- Issue session (S4).
**Data:** `User`, `TrustScore`.
**Tasks:** [ ] guard reg-token [ ] validate PIN [ ] create user+trust [ ] issue session [ ] tests
**DoD:** user persisted with hashed PIN; trivial PINs rejected; session set.

---

### E1-S4 · Sessions: login, refresh, logout [BE] (M)
**Story:** As a returning user, I want to log in with phone + PIN and stay signed in securely.

**Acceptance criteria**
```
Scenario: Login
  Given an existing user and correct PIN
  When I POST /api/auth/login { phone, pin }
  Then access+refresh JWTs are set as httpOnly, Secure (prod), SameSite cookies
Scenario: Wrong PIN lockout
  Given 5 consecutive wrong PINs
  Then further attempts are locked for a cooldown and return 423 LOCKED
Scenario: Refresh & logout
  When I POST /api/auth/refresh with a valid refresh cookie → new access+refresh (rotated)
  When I POST /api/auth/logout → cookies cleared
```
**Technical spec**
- `POST /login` `{ phone, pin }` → verify argon2; issue tokens. Consider an OTP step-up for new devices (optional MVP).
- JWT: access (`JWT_ACCESS_TTL`), refresh (`JWT_REFRESH_TTL`, rotating, reuse-detection). Cookies: `HttpOnly`, `Secure` (prod), `SameSite=Lax` (or `None` if cross-site), `Path=/`.
- `POST /refresh` rotates; `POST /logout` clears. Passport **JwtStrategy** reads access token from cookie.
- Failed-PIN counter + cooldown (Redis/DB). Errors: `AUTH_INVALID`, `LOCKED`.
**Tasks:** [ ] login [ ] JWT issue/verify (Passport) [ ] refresh rotation [ ] logout [ ] lockout [ ] tests
**DoD:** cookies set/cleared correctly; refresh rotates; lockout works; `JwtAuthGuard` protects a sample route.

---

### E1-S5 · `JwtAuthGuard` + `@CurrentUser()` [BE] (S)
**Story:** As a developer, I want a guard + decorator so protected routes get the authenticated user.

**Acceptance criteria**
```
Scenario: Protected route
  Given no/invalid session → 401 on a guarded route
  Given a valid session → the handler receives the current user (id, role flags)
```
**Technical spec** — `JwtAuthGuard` (global or per-route), `@CurrentUser()` param decorator returning `{ id, isOpsAdmin }`. Document usage for later epics.
**DoD:** guard returns 401 without session; injects user with session.

---

### E1-S6 · Onboarding UI wiring [FE] (M)
**Story:** As a user, I want the existing phone→OTP→PIN screens to actually authenticate me.

**Acceptance criteria**
```
Scenario: Full onboarding
  Given the /onboarding screens
  When I enter phone → request OTP → enter the code → set PIN
  Then each step calls the API (credentials: include), errors show inline, and on success I land on Home authenticated
Scenario: Resend + USSD helper
  Then the resend timer matches OTP_TTL and the "*714#" helper is shown
```
**Technical spec**
- Wire `frontend/app/onboarding` (already built) to `request-otp`/`verify-otp`/`set-pin` via a `lib/api.ts` wrapper (`credentials: 'include'`). Zod-validate inputs (shared schemas). Show error envelope messages. Add language picker → send `language`.
- Gate in-app routes: server-side redirect to `/onboarding` when unauthenticated (`JwtAuthGuard` equivalent check via the session cookie).
**UI/UX:** existing onboarding components; keep numeric keypad, PIN dots, resend timer.
**Tasks:** [ ] api wrapper [ ] wire 3 steps [ ] error states [ ] auth route gate [ ] language field
**DoD:** a real phone (sandbox) completes onboarding and reaches Home; refresh keeps the session.
**References:** `circlepay-stack/references/frontend-conventions.md`.

---

**Epic DoD:** new user can onboard (phone→OTP→PIN) and returning user can log in; sessions are httpOnly cookies with refresh rotation + PIN lockout; protected routes enforce auth; OTP/PIN never logged in plaintext; tests cover success + failure paths.
