# Frontend Conventions (Next.js)

Use **`senior-frontend`** for general React/Next patterns. CirclePay specifics:

## Rendering
- **Server Components** for initial reads where possible (fetch from the API server-side).
- **Client Components** (`'use client'`) only for interactivity (forms, toggles, the Advisor chat, payment flow).
- Existing `AppShell` wraps in-app pages; public pages (`/f/*`, `/onboarding`, `/landing`, `/pay`) render without it.

## Calling the API
- Base URL from `NEXT_PUBLIC_API_URL`. Always `credentials: 'include'` so the session cookie rides along.
- **TanStack Query** for client-side reads/mutations + polling (e.g. poll contribution status after pay). Keep query keys stable per resource.
- A thin `lib/api.ts` wrapper centralizes base URL, credentials, and error-envelope parsing (`{ error: { code, message } }`).

## Forms & validation
- **react-hook-form + Zod** (schemas from `packages/shared`). Validate on the client AND trust the API to re-validate.
- The Create-fund form, onboarding, and pay flows already exist — wire them to the endpoints, keep the Zod schema shared.

## Money
- Receive **pesewas** (Int) from the API; format with `formatGhs` (from `circlepay-domain`). Never do currency math with floats in the UI.

## Design system
- Use the `.cp-*` classes in `app/globals.css` (`cp-card`, `cp-btn-primary`, `cp-btn-ghost`, `cp-pill`, `cp-input`, `cp-textarea`) and the green brand. White sidebar + flat cards (no shadows), per the agreed design.

## Auth UX
- Session is the httpOnly cookie; the client doesn't store tokens. Gate in-app routes by checking the session (server-side redirect to `/onboarding` when unauthenticated).

## Localization
- Support **English / Twi / Ga** (`next-intl`); externalize all copy, persist `User.language`, restore the onboarding language picker. Don't translate amounts — labels only. See `circlepay-domain/references/ghana-context.md`.

## Authorization (client)
- The client reflects roles for UX (hide admin/ops actions), but the **backend enforces** RBAC. See `circlepay-domain/references/roles-and-permissions.md`.
