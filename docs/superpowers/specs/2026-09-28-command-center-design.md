# Vacancy Desk Command Center: design spec

- **Date:** 2026-09-28
- **Status:** DRAFT, waiting for founder approval (Checkpoint A)
- **Classification:** ARCHITECTURAL
- **Source brief:** "BUILD BRIEF: Vacancy Desk Command Center" (Parts 0–12). This spec records the decisions and changes on top of that brief. Where it says nothing, the brief applies.

---

## 1. Founder answers (Part 3)

The founder answered questions 1–6 himself. For questions 1 and 7–12 he said "you choose," so Claude picked. Every pick below can be changed in Settings or an environment variable unless it's marked otherwise.

| # | Topic | Decision | Who decided |
|---|---|---|---|
| 1 | Metro and timezone | Timezone `America/New_York`. Starting metro: **New York metro** (5 boroughs, Long Island, Westchester, North Jersey). Metros are an editable list. | Timezone: founder. Metro: Claude, reading "new york" |
| 2 | Business hours | **Three buckets:** business (Mon–Fri 09:00–17:00), **Saturday**, and after-hours (weeknights, Sunday, US federal holidays). All in NY local time, correct across daylight saving. | Founder (B) |
| 3 | Hosting | **Netlify free plan** (commercial use allowed). Vercel Hobby rejected: its terms are non-commercial only. | Founder (A) |
| 4 | Database | **Neon free plan** + Drizzle | Founder (A) |
| 5 | Auth | **Google sign-in**. `ALLOWED_EMAILS=ctownhill0@gmail.com` | Method: founder. Email: Claude, from the account on file |
| 6 | GoHighLevel | **Not used.** The app is the CRM. `CrmAdapter` interface ships with the no-op adapter only. GHL sync moved to `docs/ideas.md`. | Founder ("don't have GHL") |
| 7 | Google Places | **Turn billing on before Phase 3**, on the same Google Cloud project used for sign-in. $1 budget alert, plus an in-app daily request cap (default 25 Place Details calls a day). Nothing in Phases 1–2 needs it. | Claude |
| 8 | Anthropic | **The key is needed by Phase 2**, not Phase 1. Monthly AI cap **$20**, enforced in the app. Also set the same limit in the Anthropic Console as a backstop. Default models (editable): classifier `claude-haiku-4-5-20251001`, writer `claude-sonnet-5-5`. | Claude |
| 9 | Scraper CSV | No sample given yet. The import wizard maps **any** header, and saved mappings are reused. Test fixtures use an invented, fictional header. The founder can share 5 sanitized rows any time before M1 is finished, to add a real-shape fixture. | Claude |
| 10 | Logo | No SVG. Use the text wordmark "Vacancy Desk" (Inter 600, navy) with a thin gold rule. It's swappable in Settings > Brand. "Keyhour" appears nowhere. | Claude |
| 11 | Mailing address | **Can't be chosen for the founder.** It's a required setting. Until it's filled in, every "Send email" control stays disabled and says why. It's only needed in Phase 3 (owner report email). A PO box or virtual mailbox is fine. | Open, founder must supply |
| 12 | Writing samples | **Deferred to Phase 4.** The content engine (M16) is disabled until 3 samples are pasted into Settings > Voice. | Claude |

---

## 2. Understanding: what was said vs. what was assumed

**Said (in the brief or in answers):**
- A single-user internal tool, built so it can become multi-user later (`workspaceId` and `createdById` on every table).
- The goal is to pass the Day-90 kill test and then grow MRR 7% week over week.
- $0 running cost apart from Claude API usage.
- All 18 modules, the design system and the guardrails as written in Parts 7, 8 and 11.
- Hosting on Netlify free, Neon, and Google sign-in. No GHL.

**Assumed by Claude (the founder should correct any of these):**
- There's one user today: `ctownhill0@gmail.com`.
- The New York metro includes North Jersey. So the fair-housing pattern list ships with NY State, NYC **and** NJ protections, including lawful source of income and NYC's broader classes.
- The app is the system of record for leads, calls and the pipeline. There's no outside CRM to reconcile.
- Deploys to production can be batched, because of the Netlify deploy budget (see 4.1).
- The founder is fine with the app being unreachable in the rare case the free-plan credit cap is hit before month end. The mitigation is to monitor usage in Settings > Usage (see 4.1).

---

## 3. Options and recommendations

### 3.1 Application architecture

| Option | Summary | Pros | Cons |
|---|---|---|---|
| **A. One Next.js app (recommended)** | App Router, RSC by default, Server Actions for mutations, Route Handlers for webhooks, cron and downloads. `lib/domain` holds pure logic. | Simplest thing for a solo founder. One deploy, one test setup. Domain logic stays pure and fully unit-testable. | Big-bang deploys. Moving to multi-user later means adding authorization checks everywhere, which `requireUser()` and `workspaceId` already prepare for. |
| B. pnpm monorepo (`apps/web`, `packages/domain`, `packages/db`) | Same code, split into packages. | Hard boundaries between packages. | More tooling and build config, and it slows a solo dev down for no benefit today. |
| C. Separate API (Hono/Fastify) + SPA | Classic split. | Frontend and backend deploy separately. | Twice the hosting, auth across two apps, and it throws away RSC. Not justified. |

**Pick: A.** Layout as in Part 6: `app/(app)/[module]`, `app/api/inngest`, `app/api/cron/heartbeat`, `app/r/[token]`, `lib/domain`, `lib/ai`, `lib/db`, `lib/fetcher`.

### 3.2 Database and auth

| Option | Summary | Pros | Cons |
|---|---|---|---|
| **A. Neon + Drizzle + Better Auth (Google) (recommended)** | Better Auth with its Drizzle adapter stores its user, session and account tables in Neon. | Better Auth is actively developed. Auth.js went into maintenance mode after joining Better Auth in Sept 2025 [1]. Sessions live in our own database, and there's no vendor lock-in. | We own the auth tables and must migrate them carefully. |
| B. Neon + Drizzle + Auth.js v5 | The classic NextAuth. | Well known. | Maintenance mode: security fixes only [1]. Not a good choice for a new project. |
| C. Supabase (DB + Auth) | All in one. | Auth is included. | It pauses after 7 idle days. The founder already chose Neon. |

**Pick: A.** Allowlist enforcement:
1. The Better Auth sign-in hook rejects any email not in `ALLOWED_EMAILS`.
2. Next.js middleware redirects visitors without a session.
3. `requireUser()` runs at the top of every Server Action and Route Handler. It returns `{ userId, workspaceId }`, and every query is scoped by `workspaceId`.

### 3.3 Job runner

| Option | Summary | Pros | Cons |
|---|---|---|---|
| **A. Inngest free plan (recommended)** | Durable functions with steps, retries with backoff, built-in cron triggers, and idempotency keys. Served from `app/api/inngest`. | Retries, steps, throttling (1 request per domain every 5s) and concurrency are built in. Current free plan: 100k executions a month, 5 concurrent steps [3]. The brief's "50k" figure is out of date. | Another vendor. Each step runs as a Netlify function call, which uses a little compute credit. |
| B. Trigger.dev free | Similar durable jobs. | Good developer experience. | Smaller free allowance, and its own runtime to learn. |
| C. Home-made Postgres queue + Netlify scheduled functions | Jobs table polled every N minutes. | No extra vendor. | We'd rebuild retries, backoff, throttling and concurrency ourselves. More code, more bugs. |

**Pick: A.** How it changes the brief:
- The brief used Vercel Cron as a daily heartbeat because Hobby cron is so limited. **On Netlify, Inngest's own cron triggers do the scheduling.**
- `app/api/cron/heartbeat` stays. It checks `CRON_SECRET`, sends an `app/heartbeat` event, and records a JobRun, so we can see the schedule is alive. A **Netlify scheduled function** calls it once a day.
- Every job takes an idempotency key (for example `listings.daily:{companyId}:{date}`), retries with exponential backoff (3 tries), and writes a `JobRun` row.

### 3.4 PDF generation

| Option | Summary | Pros | Cons |
|---|---|---|---|
| **A. @react-pdf/renderer on the server (recommended)** | Renders PDFs from React components in a Route Handler, with Inter embedded. | No browser needed, so it fits inside serverless function limits. Output is deterministic, which makes snapshot tests possible. | Layout is flexbox only, not full CSS, so the PDF and the screen view are separate components that share data. |
| B. Headless Chromium (Puppeteer + @sparticuz/chromium) printing HTML | Screen and PDF share one design. | Pixel-identical to the web view. | A ~50 MB binary that pushes function size limits, cold starts of several seconds, and more compute credits. It also blurs the "no headless browser" rule. |
| C. pdf-lib, drawn by hand | Low-level drawing. | Tiny. | Every layout is hand-positioned, which is slow to build and change. |

**Pick: A.** Print CSS also ships for browser printing of screens (call briefs, ROI).

### 3.5 Other stack decisions

| Area | Decision | Why |
|---|---|---|
| Next.js | Latest stable **16.3.x**. Pin to the patched release after the 30 Sept 2026 security release (16.3.7) [2]. | Latest stable at the time of writing. |
| UI primitives | **shadcn/ui on Base UI** (never mixed with Radix) | Base UI became shadcn's default in July 2026 [6]. It also unlocks coss.com/ui (Number Field, Meter, Segmented Control), which the brief allows only on Base UI. |
| Email (Phase 3) | **Resend free plan**: 3,000 a month, 100 a day [5] | Plenty for weekly owner reports. Sending pauses at the cap; it never bills overage. |
| File storage | **Netlify Blobs** for PDFs, CSV uploads and weekly backups | Included in the platform, so no extra vendor. Uses credits. |
| Rate limiting | Postgres-backed fixed-window limiter on `/r/[token]` and the auth routes | $0 and no Redis vendor. |
| AI | `@anthropic-ai/sdk`, `client.messages.parse()` + `zodOutputFormat(schema)` [7]. Prompt caching on system prompts. One `lib/ai/client.ts` handles retries, timeouts, cost logging (`AiCall`), the spending cap and PII redaction. `PROMPT_VERSION` goes on every prompt. | As in the brief. |
| Long AI calls | Call briefs and audit summaries can take longer than a synchronous function's timeout. **To verify in Phase 2:** Netlify's current sync function timeout. If it's too short, we run the call as an Inngest step and the UI polls for the result. | Protects against timeouts. |

---

## 4. Platform limits (checked 2026-09-28; recheck before launch)

Official pages couldn't be fetched directly from the build container because of network policy. The figures below come from official documentation, as quoted in search results, and are marked for re-checking in the founder's browser before launch.

### 4.1 Netlify free plan [4]
- **300 credits a month, as a hard cap.** When they run out, **every site pauses until the next cycle**. There's no overage billing.
- Costs: production deploy ≈ 15 credits, compute ≈ 10 credits per GB-hour, bandwidth ≈ 20 credits per GB, web requests ≈ 2 credits per 10k.
- **Deploy Previews and branch deploys are free.** Only production deploys cost credits.
- **Consequence:** at most about 15–20 production deploys a month. We therefore **turn off auto-publish on `main`** and deploy to production on purpose, about 1–3 times a week. Settings > Usage shows the credits we can estimate, with a warning at 70%.
- **Commercial use: allowed** on the free plan.

### 4.2 Neon free plan [8]
- 0.5 GB storage per project, 100 CU-hours a month per project, 10 branches per project, 5 GB transfer a month.
- Scales to zero after 5 idle minutes and **never pauses permanently**.
- **Preview databases:** a GitHub Action resets one shared `preview` Neon branch from `main` for each deploy preview. This stays within the 10-branch limit and needs no Vercel integration.

### 4.3 Inngest free plan [3]
- 100k executions a month and 5 concurrent steps. Our expected load is well under 10k a month.

### 4.4 Google Places API (New) [9]
- Place Details **Enterprise + Atmosphere** is the SKU that includes reviews. Free allowance ≈ 1,000 requests a month, then ≈ $25 per 1,000.
- The Text Search SKU and its free allowance will be confirmed at Checkpoint E before Phase 3.
- Attribution and caching rules will be read then too. Reviews are labeled "Sample of up to 5 Google reviews."

### 4.5 Resend free plan [5]
- 3,000 emails a month, 100 a day, 1 domain, 30-day logs.

### 4.6 Anthropic
- Pay as you go. Hard monthly cap enforced by `lib/ai/client.ts` (default $20) and shown in Settings > Usage.

**Estimated monthly cost: $0** plus Claude API usage (capped at $20). A domain name (about $12 a year) is optional; the app runs on `*.netlify.app`.

---

## 5. Changes to the brief

| Brief said | Spec says | Reason |
|---|---|---|
| Vercel hosting, Vercel Cron heartbeat, Neon preview branches via Vercel | Netlify free, Inngest cron, a Netlify scheduled function for the heartbeat, one shared Neon `preview` branch reset by a GitHub Action | Vercel Hobby prohibits commercial use (Part 0: platform terms override the brief) |
| Inngest free "50k runs" | 100k executions a month | Current pricing |
| Better Auth or Auth.js | Better Auth | Auth.js is in maintenance mode |
| shadcn: pick Radix or Base UI | Base UI | shadcn's default, and it enables coss.com/ui |
| GHL adapter in Phase 4; README covers rotating the GHL token every 90 days | Removed. `CrmAdapter` with the no-op adapter only. The idea is logged in `docs/ideas.md` | Founder has no GHL |
| Phase 4: "GHL contract fixtures, rate-limiter test" | The rate-limiter test stays (polite fetcher + public routes). GHL fixtures are dropped. | Same |
| Deploy on every push | Deliberate production deploys | Netlify credit budget |

Nothing in Part 11 (guardrails) changes.

---

## 6. System design

### 6.1 Request flow
```
Browser ──> Netlify Edge ──> Next.js (RSC + Server Actions)
                               │   requireUser() ─> Better Auth session (Neon)
                               ├── lib/domain (pure)  scoring, stats, ROI, guarantee, dedupe, detector
                               ├── lib/db (Drizzle)    every query scoped by workspaceId
                               ├── lib/audit           AuditLog on every C/U/D and AI call
                               ├── lib/ai/client.ts    redact → cap check → parse() → AiCall log
                               └── lib/fetcher         the polite fetcher (robots, rate limit, 10s, 2MB)
Inngest ──> /api/inngest ──> job functions ──> same lib/* ──> JobRun rows
Netlify scheduled fn (daily) ──> /api/cron/heartbeat (CRON_SECRET) ──> Inngest event
Public: /r/[token] (noindex, rate-limited, hashed UA view log)
```

### 6.2 Data model
- Exactly as in brief Part 6, in Drizzle, with committed migrations. Every table has `id` (uuid v7), `workspaceId`, `createdById`, `createdAt` and `updatedAt`.
- Better Auth tables (`user`, `session`, `account`, `verification`) are added and linked to a `Workspace` and `Membership` table (one row each today).
- `MysteryShop` gets an `hoursBucket` field: `business | saturday | after_hours`. It's computed from `sentAt` in the NY timezone and stored, but recomputed if the business-hours setting changes.
- Protected characteristics have **no column anywhere**. `sensitiveContentPresent` (M12) is a boolean plus a review record, never a class label.
- The whole schema lands in Phase 1. Any change after that goes through Checkpoint E.

### 6.3 Domain logic (`lib/domain`, ≥90% coverage)
- **Scoring:** weights come from Settings. The result is capped to 0–100 and returns a breakdown.
- **Dedupe:** normalized domain, name and E.164 phone. Same domain means a duplicate. Jaro-Winkler on name + city ≥ 0.9 means a possible duplicate.
- **Detector:** patterns from the `SoftwarePattern` table, returning evidence and a confidence. Manual overrides survive re-runs.
- **Stats:** median, P75 and P90 over `firstReplyAt - sentAt`. Two medians: replied-only, and with no-replies counted as never answered (treated as +∞ so they push the median up). No-reply shares at 24h and 72h. All bucketed by hours bucket.
- **ROI:** daily cost = rent × 12 ÷ 365. $1,800 → $59.18.
- **Guarantee:** "at risk" from day 7 if projected tours (tours × 14 ÷ days elapsed) < target or median reply > 60s. "Met" or "Missed" at day 14.
- **Expected MRR:** max(400, vacancies × 119) × probability.
- **Kill test:** pilots out of 3, conversations out of 60, and after-hours median vs. 10 min. The thresholds are settings.

### 6.4 Guardrails, as enforced in code
- The fetcher is the only module allowed to import `fetch` for outbound web requests. A lint rule enforces this.
- It has no form-posting API and no browser dependency.
- No SMS, dialer or voicemail code exists. Calls are `tel:` links only. `do_not_call` is permanent: there's a database constraint, and the UI has no "undo" path.
- The fair-housing check is required before any renter- or owner-facing export or send. There's a minimum version in Phase 2 and the full version in Phase 3.
- The anonymization scanner blocks firm names, domains and phone numbers, and hides groups of fewer than 5 shops (Phase 4).
- No rent pooling or benchmarking across firms, anywhere.

---

## 7. Design system
As in brief Part 8. `docs/design-contract.md` is written before any UI, in Phase 1 right after the scaffold. Checkpoint C (tokens, /design and app shell, with screenshots in both themes) comes before any module.

---

## 8. Phase plan (summary)

| Phase | Build | Needs from founder |
|---|---|---|
| 1. Foundation and prospecting | Scaffold, CI, full schema, Better Auth (Google), shell, tokens, /design, polite fetcher, M1, M4, M17 v1, M18 v1, seed data | A Google OAuth client, a Neon project and a Netlify account (walkthroughs in the README) |
| 2. Selling | AI wrapper, M5–M9, minimum M14 | Anthropic API key |
| 3. Delivery and proof | M2, M3, M10, M11, M13, full M14, M12 | Google billing + $1 alert, mailing address, Resend account + domain |
| 4. Leverage and polish | M15, M16, performance pass, design review, backup-restore drill | 3 writing samples |

Checkpoints B–E apply as in the brief.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Netlify credits run out mid-month and the app pauses | Deliberate deploys, a usage widget with a 70% warning, cached RSC, and small bundles. If it happens often, bring the Netlify Personal ($9) or Vercel Pro ($20) decision back to Checkpoint E. |
| AI calls longer than the function timeout | Run them as Inngest steps plus polling (verify in Phase 2) |
| Many NYC firms are on AppFolio, so few leads survive the filter | Detector + scoring show the funnel. Add a second metro through Settings. |
| Neon cold start (about 1s) | Acceptable for a single user. Skeletons cover it. |
| Auth tables owned by us | Better Auth migrations are committed and tested in CI |

---

## 10. Open items
1. **Mailing address** (question 11): needed before Phase 3 email.
2. **Scraper CSV sample** (question 9): optional, wanted before M1 is finished.
3. **Writing samples** (question 12): Phase 4.
4. Confirm or correct the assumptions in section 2.
5. The superpowers plugin isn't installed in this session. Workflows are being followed by hand from the brief. `/plugin install superpowers@claude-plugins-official` is recommended.

---

## 11. Self-review (done 2026-09-28)
- [x] Every Part 3 question has a decision or is an open item.
- [x] Each of the four required areas has 2–3 options with trade-offs.
- [x] Every change to the brief is listed with a reason (section 5). Guardrails are unchanged.
- [x] $0 running cost holds: every paid path is behind founder approval.
- [x] No secrets, PII or real firm names in this document.
- [ ] Platform figures were re-checked on official pages in a browser. **Not possible from the container** (network policy). Marked for re-check before launch.
- Consistency check: the brief's "Vercel Cron heartbeat" and "Neon preview branches" were both reworked for Netlify (sections 3.3 and 4.2). The Phase 4 GHL test item was removed (section 5). No other contradictions found.

---

## Sources
1. Auth.js is now part of Better Auth: https://better-auth.com/blog/authjs-joins-better-auth
2. Next.js 16.3 release: https://nextjs.org/blog/next-16-3
3. Inngest pricing and usage limits: https://www.inngest.com/pricing, https://www.inngest.com/docs/usage-limits/inngest
4. Netlify credits: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/, https://www.netlify.com/pricing/
5. Resend quotas: https://resend.com/docs/knowledge-base/account-quotas-and-limits
6. shadcn Base UI default: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
7. Anthropic TS SDK helpers: https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md
8. Neon free plan: https://neon.com/docs/introduction/plans
9. Places API usage and billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
