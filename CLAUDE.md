@AGENTS.md

# Vacancy Desk Command Center

A single-user internal tool (built so it can go multi-user later) that helps the founder find property
managers, prove their slow replies with mystery shops, run calls, close 14-day pilots and track the
Day-90 kill test. Current scope: the **$0 Free Build**. The spec is
`docs/superpowers/specs/2026-09-28-command-center-design.md`, and the current plan is in `docs/superpowers/plans/`.

## Free Build rules (hard)

- **$0 total.** No credit card, paid plan or API key. If a step needs one, STOP and ask the founder.
- No Anthropic API, Google Places, email sending, GoHighLevel, deployment, background jobs or polite fetcher.
  Deferred work lives in `docs/ideas.md`. Never build it without the founder's go-ahead.
- Local only: `pnpm dev` binds to 127.0.0.1, and `proxy.ts` rejects non-localhost Host headers.
- Keep it deployable: Postgres dialect, `requireUser()` everywhere, `workspaceId` on every query.

## Stack

- Next.js 16 (App Router, RSC by default, Server Actions for mutations, Route Handlers for downloads).
  **This Next.js has breaking changes: read `node_modules/next/dist/docs/` before using an API.**
  `middleware.ts` is now `proxy.ts`.
- TypeScript strict, pnpm, Tailwind v4 with CSS-variable tokens, shadcn/ui on **Base UI** (never Radix).
- PGlite (Postgres in WASM) + Drizzle. The same migrations run on real Postgres/Neon (CI parity job).
- zod, Vitest + Testing Library, Playwright + @axe-core/playwright, ESLint (next + jsx-a11y), Prettier,
  lefthook, gitleaks (CI).

## Commands

| Command                     | What it does                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm dev`                  | Run the app at http://localhost:3000                                                             |
| `pnpm db:setup`             | Migrate + seed fictional demo data (first run)                                                   |
| `pnpm db:reset`             | Delete `.data/pglite` and set up again                                                           |
| `pnpm db:generate`          | Generate a migration after editing `lib/db/schema/*` (commit it)                                 |
| `pnpm typecheck`            | `next typegen && tsc --noEmit`                                                                   |
| `pnpm lint` / `pnpm format` | ESLint + Prettier check / write                                                                  |
| `pnpm test`                 | Vitest (node + jsdom projects, in-memory PGlite)                                                 |
| `pnpm e2e`                  | Playwright at 1440/768/320. In the cloud container: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` |

## Layout

- `app/`: routes. `proxy.ts`: localhost guard.
- `lib/domain/`: **pure** business logic (scoring, stats, hours buckets, ROI, guarantee, pricing). ≥90% coverage.
- `lib/db/`: `client.ts` (driver switch), `index.ts` (`getDb()` + single-process lock), `schema/*`,
  `migrate.ts`, `test-db.ts` (fresh migrated in-memory DB), `test-fixtures.ts`.
- `lib/auth/require-user.ts`: `requireUser()` returns `{ userId, workspaceId }` (AUTH-HOOK).
- `lib/audit/audit.ts`: `withAudit()` runs a change + its AuditLog row in one transaction, with PII redacted.
- `lib/design/`: tokens (source of truth), contrast math, and design-rule tests.
- `lib/seed/`: the fictional demo dataset. `scripts/`: migrate, seed, reset.
- `drizzle/`: committed migrations (includes the hand-written `0002_dnc_permanent.sql`).

## Conventions

- **TDD:** write the test, watch it fail for the right reason, write the minimum code, refactor. No code
  before its test. Config-only changes are verified by a command.
- Conventional Commits (`feat(leads): …`). Commit after each passing task. The lefthook pre-commit runs
  typecheck, lint and tests.
- **Every create, update and delete goes through `withAudit()`.** Every Server Action starts with
  `await requireUser()` and validates input with zod.
- Every table: `...baseColumns()` (id, workspace_id, created_by_id, created_at, updated_at). Column names
  are written in snake_case. `lib/db/schema/invariants.test.ts` enforces this and bans protected-class columns.
- Every number renders through `<Num>` (tabular figures; `null` shows "unknown"). Estimates are labeled "Estimated".
- AI hooks: each future AI feature is an interface with a manual implementation now, marked
  `// AI-HOOK(<module>): …`. No `@anthropic-ai/sdk` (lint-banned).
- Seed and test data are fictional only: `.example` domains, `+1…55501xx` phones, invented names.
- Anything unexpected: reproduce → root cause → hypothesis → fix → regression test. Never guess.

## Design tokens (summary; details in `docs/design-contract.md`)

- Palette **Graphite** (Checkpoint P). Light: bg #F6F6F7, fg #17171C, card #FFF, muted text #50505C,
  primary/link/ring indigo #4338CA, input border #737383. Dark: bg #0E0E12, fg #ECECF1, primary #8E92F7.
- Status (shared): success #2D8014, warning #774500, destructive #D74030, info #3A6FA3 (dark: #5FD37F,
  #EE921A, #F0555B, #88ABEA). Status text only on surfaces; inline error text uses `destructive-text`.
- Focus: one 2px indigo ring. Never text opacity. Values live in `lib/design/tokens.ts` (tests keep CSS in sync).
- Inter 400/500/600. Scale 48/56 · 36/44 · 28/36 · 22/30 · 16/24 · 14/20 · 12/16. Radius 8/12/16.
- Exactly three shadows: `shadow-sm` (controls), `shadow-md` (cards, popovers), `shadow-lg` (modals).
- Motion: none on 100+/day actions. Easing out `cubic-bezier(0.23,1,0.32,1)`. Never ease-in or `transition: all`.
- Status = icon + label + color. One primary action per view. Sentence case. `gap-*`, never `space-y-*`.
- `lib/design/class-rules.test.ts` bans raw hex classes, `dark:`, hand-set z-index, uppercase, serif/mono,
  gradients, and Tailwind's built-in shadows.

## Guardrails (brief Part 11, verbatim)

**Data collection**

- Public business data only.
- Respect robots.txt and each site's terms. Rate-limit and back off.
- NEVER scrape anything behind a login, a portal or a CAPTCHA.
- Use official APIs where they exist (Google Places).
- Mystery shops use your real name and never book fake tours.

**Outreach (TCPA)**

- NEVER an auto-dialer, predictive dialing, robocalls, prerecorded or AI-voice calls, ringless voicemail, or SMS.
- Calls go through `tel:` links only.
- Do-not-call flags are permanent. (Enforced by a database trigger.)

**Email (CAN-SPAM)**

- An accurate sender and an honest subject line.
- A physical postal address in the footer.
- An unsubscribe link that keeps working for at least 30 days.
- Opt-outs honored immediately (the legal maximum is 10 business days).
- A suppression list, and addresses are never sold.

**Fair housing**

- NEVER store, infer, score or tag protected characteristics. That covers federal classes plus state and
  local ones such as source of income.
- Tags come from a fixed list.
- Every text that renters or owners see is checked and logged, and labeled "Screening aid, not legal advice."

**Antitrust**

- NEVER pool, benchmark or recommend rents across clients or competitors.
- This follows the DOJ's 2025 RealPage settlement, which bars using competitors' nonpublic data to recommend rents.
- The Metro Response Index covers response behavior only.

**Security and privacy**

- Secrets are never committed, sent to the client, or logged.
- Personal data is kept to a minimum.
- Actions are audit-logged.
- No firm names in anonymized outputs.

**AI**

- Everything AI writes is a draft until the founder approves it.
- Outputs are grounded in the data provided, and missing data shows as "unknown."
- The monthly spending cap is enforced.

## Never do

- Build Avery's renter-facing responder.
- Auto-post, or auto-send reports without the client opting in.
- Show "Keyhour".
- Add paid services, accounts or tracking pixels without approval.
- Disable, skip or weaken tests. Skip test-first development.
- Claim something is done without pasting evidence (`pnpm typecheck && pnpm lint && pnpm test && pnpm e2e`).
- Commit `.env*` files, keys, real personal data or real firm data.
- Widen scope. Ideas go in `docs/ideas.md`.
- Change the schema after Phase 1, add a service or integration, or change a guardrail without founder
  approval (Checkpoint E).
