# AI Fund Advisor (deferred)

The PRD's hero feature turns plain language ("raise GHS 5,000 for my mother's surgery at Korle Bu") into a ready-to-confirm **fund configuration**. For now this is **deferred** — keep a rules-based stub and build a clean seam so a real LLM (Claude) drops in later.

## Now: rules-based stub
- The current `frontend/app/advisor` screen scripts a response and shows a `FundConfigurationCard`. Keep it, but route the "configure" step through a single backend endpoint so the logic is swappable.
- **Endpoint:** `POST /api/advisor/configure` with `{ prompt: string }` → returns a **fund config** validated by a shared **Zod schema** (same shape the Create form/`circlepay-domain` use): `{ type, beneficiary?, hospital?, target?, contribution?, frequency?, members?, payoutRule, shareable }`.
- Stub implementation: keyword rules (medical/surgery/hospital → Medical; market/group/weekly → Susu; school/fees → Education) producing a sensible default config. Deterministic, no external calls.

## Later: Claude
- Swap the stub's body for an Anthropic SDK call that returns **structured output** (tool use / JSON), then validate with the same Zod schema before returning. Reject/repair on invalid output.
- Add `ANTHROPIC_API_KEY` (backend only). Use the **`claude-api`** skill for SDK setup, structured output, and prompt caching.
- Keep the endpoint contract identical so the frontend doesn't change when the engine is upgraded.

## Why a seam
Isolating the Advisor behind one validated endpoint means: the UI is stable, the output is always a valid fund config, and going live is a localized change (stub → Claude) with no schema drift.
