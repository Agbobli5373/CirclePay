# Roles & Permissions (RBAC)

Two scopes: **fund-scoped** roles (your relationship to a specific fund) and a **platform** role (CirclePay ops). Authorization is checked server-side on every mutation.

## Roles

| Role | Scope | Who |
|---|---|---|
| `member` | fund | A user with a seat in a Susu |
| `fund_admin` | fund | The member who created/manages a Susu pool (`Member.role = admin`) |
| `contributor` | fundraiser | A donor to a Medical/Education/Business fund (may be anonymous) |
| `beneficiary` | fundraiser | The person the fundraiser is for (not necessarily a user) |
| `ops` | platform | CirclePay staff: appeals, hospital verification, AML review (`User.isOpsAdmin`) |

## Permission matrix (representative)

| Action | member | fund_admin | ops |
|---|---|---|---|
| View fund details / payout order | ✅ | ✅ | ✅ |
| Contribute / pay own cycle | ✅ | ✅ | — |
| Invite members | — | ✅ | — |
| Remove a member *before* the Susu starts | — | ✅ | ✅ |
| Change payout order | — | ✅ (before start only) | ✅ |
| Mark a member defaulted | ❌ (system-only) | ❌ (system-only) | review only |
| Approve/reject a defaulter **appeal** | — | — | ✅ |
| Verify a hospital | — | — | ✅ |
| Trigger a payout | ❌ (system-only) | ❌ | override only |
| Cancel a fund | — | ✅ (rules apply) | ✅ |

## Hard rules

- **Defaults are system-driven**, never admin discretion — a member is only `defaulted` when the ledger shows missed contributions past grace. This stops an admin from seizing deposits unfairly (see `compliance.md`).
- **Payouts are system-driven** (on `CycleFunded`), not a button an admin presses; `ops` may override only with an audit reason.
- **Appeals and hospital verification are `ops`-only** — kept separate from fund admins to avoid conflicts of interest.
- Once a Susu **starts**, the member list and payout order are **locked** (changing them mid-cycle breaks fairness).

## Modeling

- `Member.role` (`member` | `admin`) gives fund-scoped admin.
- `User.isOpsAdmin` gives the platform `ops` capability.
- Enforce with backend guards (see `circlepay-stack/references/backend-conventions.md`); never trust the client.
