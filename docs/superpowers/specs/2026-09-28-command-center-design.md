# Vacancy Desk Command Center: design spec

- **Date:** 2026-09-28 (revision 3: Day 0 set, polite fetcher cut)
- **Status:** APPROVED by founder, 2026-09-28 (Checkpoint A passed). Revision 3 records his answers.
- **Classification:** ARCHITECTURAL
- **Source brief:** "BUILD BRIEF: Vacancy Desk Command Center" (Parts 0–12) plus the founder's "SCOPE CHANGE: $0 BUILD ONLY" message. Where this spec says nothing, the brief applies. The workflow, TDD, design system (Part 8), guardrails (Part 11) and checkpoints all still apply.

---

## 0. Scope change summary

The **Free Build** replaces the phase plan in brief Part 9. The hard rules:

- **Total cost is $0, with no credit card anywhere.** Any service, package or step that would need a card, a paid plan or an API key is a STOP-and-ask.
- **No** Anthropic API calls, Google Places, email sending or GoHighLevel.
- **Runs locally on the founder's Mac** with `pnpm dev`. **No deployment for now.** The code stays deployable later.
- The database needs **no account**, and the schema stays portable to Neon.
- Auth is **local single-user**, and `workspaceId` and `createdById` stay on every table.
- Every AI feature gets a **manual or template version** now, with a clearly marked hook where Claude plugs in later (section 6).

Everything marked **⏸ DEFERRED** below is listed in `docs/ideas.md` and will **not** be built until there's revenue.

---

## 1. Founder answers (Part 3), after the scope change

| #   | Topic                  | Decision                                                                                                                                                                        | Status                           |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Metro and timezone     | `America/New_York`. Starting metro: New York metro (5 boroughs, Long Island, Westchester, North Jersey). Editable list.                                                         | Decided (metro chosen by Claude) |
| 2   | Business hours         | Three buckets: **business** (Mon–Fri 09:00–17:00), **Saturday**, **after-hours** (weeknights, Sunday, US federal holidays), in NY local time and correct across daylight saving | Decided (founder: B)             |
| 3   | Hosting                | **None. Runs locally.** Deployment is deferred.                                                                                                                                 | ⏸ DEFERRED                       |
| 4   | Database               | **PGlite** (local, no account). See 3.2.                                                                                                                                        | Changed by scope                 |
| 5   | Auth                   | **Local single-user, no sign-in.** Google sign-in is deferred.                                                                                                                  | Changed by scope                 |
| 6   | GoHighLevel            | Not used. `CrmAdapter` is not built in the Free Build.                                                                                                                          | ⏸ DEFERRED                       |
| 7   | Google Places          | Not used                                                                                                                                                                        | ⏸ DEFERRED, question skipped     |
| 8   | Anthropic key and cap  | Not used                                                                                                                                                                        | ⏸ DEFERRED, question skipped     |
| 9   | Scraper CSV sample     | Build the importer against a **generic fictional sample** now. Founder sends real (sanitized) rows later, and they become an extra fixture.                                     | Decided (founder)                |
| 10  | Logo                   | Text wordmark "Vacancy Desk", swappable in Settings > Brand. It appears on the audit PDF. "Keyhour" appears nowhere.                                                            | Decided by Claude                |
| 11  | Mailing address        | Only needed for email                                                                                                                                                           | ⏸ DEFERRED, question skipped     |
| 12  | Writing samples        | Only needed for M16                                                                                                                                                             | ⏸ DEFERRED, question skipped     |
| new | Day-90 kill-test dates | **Day 0 = Tue 29 Sept 2026; deadline = Mon 28 Dec 2026.** Both are editable settings.                                                                                           | Decided (founder)                |

---

## 2. Understanding: what was said vs. what was assumed

**Said:**

- $0, no card, no API keys, local Mac only.
- The ten Free Build items, in the order given (section 4).
- The deferred list (section 5).
- Every rule from the brief outside the phase plan still applies.

**Assumed by Claude (correct any of these):**

- One Mac and one user. The app is reached only at `http://localhost:3000`. The dev server binds to `127.0.0.1`, so other devices on the Wi-Fi can't open it.
- Weekly business numbers (MRR, cash, net burn, insurance study hours) are **typed in by hand** once a week. Calls, conversations, audits and pilots are counted from app data.
- "Backups" means a one-click export of the whole database to a file in a folder the founder chooses (for example iCloud Drive), plus JSON/CSV export. There's no cloud backup service.
- The **full schema** (including tables for deferred modules) lands in the Foundation step. Tables for deferred modules stay empty. That way reviving a module later doesn't need a Checkpoint E schema change.
- GitHub Actions CI is kept. It's free for public repos, and private repos get a free monthly minutes allowance on the free plan with no card needed. If the allowance runs out, CI simply stops; nothing is billed. Every check also runs locally.

---

## 3. Options and recommendations

### 3.1 Application architecture

| Option                                                                                   | Pros                                                                        | Cons                                                                                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A. One Next.js app (recommended)**: App Router, RSC, Server Actions, pure `lib/domain` | Simplest for a solo founder. One test setup. Deploys later with no rewrite. | Moving to multi-user later needs authorization checks everywhere, which `requireUser()` and `workspaceId` prepare for |
| B. pnpm monorepo (`apps/web`, `packages/*`)                                              | Hard boundaries                                                             | Tooling overhead, no benefit today                                                                                    |
| C. Local API server + SPA                                                                | Clear split                                                                 | Two processes to run, and it throws away RSC and Server Actions                                                       |

**Pick: A.** Layout as in brief Part 6, **minus** `app/api/inngest`, `app/api/cron/heartbeat` and `app/r/[token]` (all deferred).

### 3.2 Database (local, no account)

| Option                                | One-line trade-off                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. PGlite + Drizzle (recommended)** | Real Postgres compiled to WebAssembly and installed with `pnpm install`, with nothing else to install. Data is a folder on disk. **Same SQL dialect as Neon, so moving later means swapping the Drizzle driver, not the schema.** The catch: one process at a time, so don't run two copies of the app against the same data folder. |
| B. Postgres in Docker                 | Identical to production Postgres, but you need Docker Desktop (a large install that can't be run by `pnpm dev` alone), and it uses RAM in the background.                                                                                                                                                                            |
| C. SQLite + Drizzle                   | Tiny and fast, but a different SQL dialect: moving to Neon later means a second schema and migration rewrite. It also loses Postgres types (`timestamptz`, enums, jsonb).                                                                                                                                                            |

**Pick: A.**

- `DATABASE_DRIVER=pglite` (default) or `neon` later, chosen in one file, `lib/db/client.ts`.
- Migrations come from `drizzle-kit` using the `postgresql` dialect, so they work on both.
- The data folder is `.data/pglite/`, which is git-ignored.
- `pnpm test` uses an **in-memory** PGlite per test file, so tests are fast and isolated.

### 3.3 Auth (local single-user)

| Option                                                | Trade-off                                                                                                                                                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Local owner, no sign-in (recommended)**          | The seed creates one `Workspace`, one `User` (the founder) and a `Membership`. `requireUser()` returns them. The server binds to `127.0.0.1`. Zero setup. Better Auth plugs in later behind the same `requireUser()`. |
| B. Local password (Better Auth with email + password) | Works offline, but it's a password to manage for a tool only you can reach.                                                                                                                                           |
| C. Google sign-in                                     | Needs a Google Cloud project. Free, but out of scope under the "no accounts" spirit.                                                                                                                                  |

**Pick: A.** `requireUser()` is still called at the top of **every** Server Action and Route Handler, and every query is still scoped by `workspaceId`. So adding real auth later changes one function, not the whole app.

### 3.4 Job runner

| Option                                                                    | Trade-off                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. No job runner; compute "due" items when a page loads (recommended)** | Reply-check reminders (1h/4h/24h/72h after `sentAt`) and "call now" lists are **derived on every page load** from timestamps. There's a badge in the nav and a "Due now" list. Nothing runs in the background, so nothing can silently fail. |
| B. `node-cron` inside the dev server                                      | Only runs while `pnpm dev` is open anyway, and adds a failure mode.                                                                                                                                                                          |
| C. Inngest dev server                                                     | Free and local, but it's a second process and a vendor for work option A already covers.                                                                                                                                                     |

**Pick: A.** Background jobs are ⏸ DEFERRED. The `JobRun` table exists but stays unused.

### 3.5 PDF generation

| Option                                                      | Trade-off                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A. @react-pdf/renderer in a Route Handler (recommended)** | Free npm package, no browser, deterministic output, which makes snapshot tests possible. Layout is flexbox only. |
| B. Browser print-to-PDF from print CSS                      | Zero code, but output varies between browsers and there's no automated snapshot test                             |
| C. Headless Chromium (Puppeteer)                            | Pixel-identical to the web view, but a large download, and it blurs the "no headless browser" rule               |

**Pick: A**, with Inter embedded from the free `@fontsource/inter` package (SIL Open Font License). Print CSS still ships for printing screens (call prep, ROI).

### 3.6 Other stack decisions (all free, no account)

| Area    | Decision                                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js | Latest stable 16.3.x, pinned to the patch from the 30 Sept 2026 security release                                                                                                                      |
| UI      | shadcn/ui on **Base UI** (never Radix), plus the brief's component order. Registries are public and free.                                                                                             |
| Font    | Inter via `next/font` (self-hosted at build time, no account)                                                                                                                                         |
| Tests   | Vitest, Testing Library, Playwright + @axe-core/playwright. MSW is kept for the future AI hook tests but unused now. On the Mac, `pnpm exec playwright install chromium` is a free one-time download. |
| Tooling | ESLint (next + jsx-a11y), Prettier, lefthook, gitleaks (free binary; lefthook skips it with a warning if it's not installed, and CI always runs it)                                                   |
| Node    | **Node 24 LTS**. pnpm is pinned via `packageManager` in `package.json`.                                                                                                                               |

---

## 4. Free Build: scope and order (replaces brief Part 9)

Each step ends with its tests green and a Checkpoint D demo on seed data. Checkpoint C (screenshots of the tokens, /design and the shell in both themes) comes after step 1, before any module.

### Step 1: Foundation

- Scaffold, CI, full Drizzle schema (section 7), PGlite client, local `requireUser()`, AuditLog writer.
- App shell (sidebar / drawer / bottom nav), design tokens, `docs/design-contract.md`, the `/design` page, `CLAUDE.md`.
- Seed data per brief Part 10, **adjusted:** 50 fictional Northeast firms (5 AppFolio, 5 duplicates), 40 shops (8 with no reply), 25 calls, 12 deals, 2 pilots (one on track, one at risk on day 7), 12 weeks of metrics. The 20 transcripts are ⏸ DEFERRED with M12.

### Step 2: M1 Leads

- CSV wizard (upload → map → preview 20 rows → commit), saved column mappings, ImportBatch.
- Dedupe: normalized domain, name and phone. Same domain means a duplicate. Jaro-Winkler ≥ 0.9 on name + city means a possible duplicate, shown in a merge screen.
- **Software detection is MANUAL:** a dropdown per firm (appfolio | buildium | doorloop | rent_manager | yardi | none | unknown) plus an optional evidence note. There's a **"Check portal" link** that opens the firm's website in a new tab (`rel="noopener noreferrer"`). AppFolio still means excluded with score 0, which can be overridden. `SoftwarePattern` rows are seeded with the brief's patterns for later, and M18 can edit them.
- Score with editable weights (+30 not AppFolio, +20 no software, +20 3–25 listings, +25 shop median > 2h with no-replies counting as > 2h, +15 50–500 units, +10 local). The +10 review boost is ⏸ DEFERRED with M3. The score is capped at 0–100, with a breakdown popover and score history.
- Tags, statuses, a 5,000-row virtualized table, filters in the URL (nuqs), CSV export.
- **Polite fetcher: CUT** (founder, 2026-09-28). Nothing uses it yet, so it's ⏸ DEFERRED in `docs/ideas.md` and comes back with automatic detection or M2.

### Step 3: M4 Mystery-shop tracker (full)

- 60-second logging form, a "Replied now" button, and a phone layout for quick logging.
- Stats per firm and per metro: median / P75 / P90, no-reply share at 24h and 72h, and the **two medians side by side** (replied-only, and no-reply counted as never answered). Split three ways: business, Saturday and after-hours.
- **In-app reminders only:** a "Reply checks due" list and a nav badge, computed from `sentAt` + 1h/4h/24h/72h.
- Ethics panel (real name, genuine inquiries, no fake tours, at most 1 shop per firm per 30 days, which is **enforced**, and no protected-class personas).

### Step 4: M6 Call workspace

- Today's list: call-now firms first, then callbacks due, then highest score. Call blocks Tue–Thu 9:00–11:30 are highlighted.
- Scripts (gatekeeper, opener with test result, opener without, voicemail, follow-up, pilot close) with `{{variables}}` filled from the lead's data. Missing values render as **"unknown"** and are highlighted.
- Objection library, dispositions on hotkeys 1–9 (no animation), next-step scheduling, `tel:` links only. `do_not_call` is permanent.
- **Call prep panel (replaces M5 AI briefs):** built only from the firm's own data. That covers the snapshot, mystery-shop evidence with dates, ROI at the firm's typical rent if one was entered, detected software, the last 3 calls, and open next steps. `AI-HOOK(M5)` marks where the Claude brief will slot in.

### Step 5: M7 Pipeline

- Kanban + table, with a "Move to…" menu for every drag. A lost reason is required.
- One StageEvent per move, at most one open deal per company.
- Expected MRR = max($400, vacancies × $119) × probability.

### Step 6: M9 ROI calculator (full)

- Daily vacancy cost = rent × 12 ÷ 365 ($1,800 → $59.18). Annual loss, cost, net savings, payback. Every output is labeled "Estimate."
- Present mode (48/36px type).
- **"Shareable link" becomes a copyable local URL** with the inputs in the query string (works on this Mac only). Public sharing is ⏸ DEFERRED with deployment.

### Step 7: M8 Vacancy audit

- A one-page branded PDF from a fill-in template: the firm's shop results vs. the metro median, the renter experience (from the shop log), the ROI numbers, and a method note.
- **Summary: the founder writes the 3 sentences** in a text box (with a sentence counter). The number-grounding check still runs: any number in the text that isn't in the audit's data is flagged before export. `AI-HOOK(M8)` marks the spot.
- It must pass the M14 layer-1 check before export.

### Step 8: M14 Fair-housing checker, layer 1

- An editable regex list, seeded with the brief's examples plus NY/NYC/NJ source-of-income patterns.
- Outcome pass / warn / block. Every check is logged (`FairHousingCheck`), and overrides require a reason. Labeled "Screening aid, not legal advice."
- Runs on **audit text** and **call scripts** (on save). Tests include false positives ("family room" must pass).
- Layer 2 (Claude classifier) is ⏸ DEFERRED; `AI-HOOK(M14-L2)`.

### Step 9: M10 Pilot scorecard

- **Manual daily entry** per vacancy: inquiries, median and P90 reply, tours, applications, escalations, fair-housing flags, human-minutes. This is a fast grid form with keyboard entry.
- Guarantee: "at risk" from day 7 (projected tours = tours × 14 ÷ days elapsed < target, or median reply > 60s), then "met" or "missed" at day 14. Shown with an icon, a label and a color together.

### Step 10: M17 Founder dashboard + M18 Settings

- **Dashboard:**
  - MRR, and week-over-week growth vs. 7% (below target shows red, a down icon and "Below 7% target").
  - The weekly activity from the brief.
  - Kill-test widget: countdown, pilots out of 3, conversations out of 60, after-hours median vs. 10 min.
  - YC-readiness widget.
  - MRR chart with the 7% projection line.
  - It must answer "am I on track?" at 1440×900 without scrolling.
- **Settings:**
  - Scoring weights, the software list and patterns, business hours, thresholds (kill test, tour target, call blocks), brand, fair-housing patterns.
  - A weekly-numbers entry form.
  - CSV/JSON export, a database backup file, and delete demo data.
  - **No API key sections, no model IDs, no AI cap** (⏸ DEFERRED).

---

## 5. Deferred until revenue (do not build)

Tracked in `docs/ideas.md`: M2 listings monitor · polite fetcher (`lib/fetcher`) · M3 review pain finder · M5 AI call briefs · M11 owner report + emails · M12 objection tagger (and its 20 seed transcripts) · M13 Company Brain + AI export · M14 layer 2 · M15 Metro Response Index · M16 content engine · background jobs (Inngest) · deployment (Netlify/Vercel, Neon, Google sign-in) · GoHighLevel sync · the AI wrapper `lib/ai/client.ts` · Google Places · Resend.

The research on hosting and platform limits from revision 1 is kept in section 10 for when deployment comes back.

---

## 6. AI hook pattern

Every AI feature is written against an interface. It has a **manual** implementation now and a **Claude** implementation later.

```ts
// lib/ai/hooks.ts
// AI-HOOK: each provider has a manual implementation now; a Claude one plugs in later.
export interface AuditSummaryProvider {
  draft(input: AuditData): Promise<Draft>;
}
export const auditSummary: AuditSummaryProvider = manualAuditSummary; // returns founder's text
```

- Every hook site carries a `// AI-HOOK(<module>): <what Claude will do>` comment. `pnpm ai-hooks` greps and lists them, and the README links to the list.
- Hooks in the Free Build: `AI-HOOK(M5)` call prep → brief, `AI-HOOK(M8)` audit summary, `AI-HOOK(M14-L2)` fair-housing classifier.
- The UI shows who wrote each piece of text ("Written by you" / later "Draft by Claude").
- The number-grounding and fair-housing checks run **regardless of who wrote the text**. They live in `lib/domain` and are tested now.
- No `@anthropic-ai/sdk` dependency is installed in the Free Build.

---

## 7. Data model

- As in brief Part 6, in Drizzle (`postgresql` dialect) with committed migrations. Every table has `id` (uuid), `workspaceId`, `createdById`, `createdAt` and `updatedAt`.
- The tables for deferred modules are created now and stay empty.
- Additions: `Workspace`, `User` and `Membership` (one row each for now); `ImportMapping` (saved CSV mappings); `MysteryShop.hoursBucket` (`business | saturday | after_hours`, computed in NY time and recomputed when the setting changes).
- **No column anywhere stores a protected characteristic.**
- AuditLog: every create, update and delete writes a row. (AI calls will too once hooks go live.)

---

## 8. Domain logic (`lib/domain`, ≥90% coverage)

- **Scoring:** weights come from Settings, capped to 0–100, with a breakdown.
- **Dedupe:** normalization + Jaro-Winkler.
- **Stats:** percentiles, both medians (no-replies treated as +∞, never dropped), no-reply shares, and hours buckets across daylight-saving changes.
- **ROI**, **guarantee**, **expected MRR**, **kill test**, **WoW growth** and the **7% projection**.
- **Number grounding:** extracts numbers from free text and compares them to the source data.
- **Fair-housing layer 1:** regex engine, outcome resolution, and false-positive fixtures.
- **Reminders:** reply checks due and call-now ordering.

---

## 9. Guardrails (unchanged; brief Part 11 is copied into `CLAUDE.md`)

Added for the Free Build:

- No dependency or step that needs a card, a paid plan or an API key. The founder is asked first.
- No outbound network calls from the app at all in the Free Build. There's no polite fetcher yet, and any future outbound request must go through one (brief Part 6).
- The dev server binds to `127.0.0.1` only.

---

## 10. For later: deployment research (from revision 1; not in scope)

Kept so the work isn't lost. **Re-verify all figures before using them.**

- **Vercel Hobby** is non-commercial only. **Netlify free** allows commercial use: 300 credits a month as a hard cap (a production deploy ≈ 15 credits; previews are free). The site pauses when the credits run out.
- **Neon free:** 0.5 GB storage, 100 CU-hours, 10 branches, scales to zero after 5 minutes, never pauses permanently.
- **Inngest free:** 100k executions a month, 5 concurrent steps.
- **Better Auth** is recommended over Auth.js, which is in maintenance mode since Sept 2025.
- **Places (New):** Place Details Enterprise + Atmosphere (reviews) ≈ 1,000 free a month, and **needs a billing account with a card.**
- **Resend free:** 3,000 emails a month, 100 a day.

---

## 11. Risks

| Risk                                                                          | Mitigation                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PGlite is single-process: a second `pnpm dev` or an open DB tool can conflict | The README warns about it, and a lock file check at startup prints a plain-English error                                                                      |
| Data lives only on one Mac                                                    | One-click backup to a file (suggest iCloud Drive), and a weekly reminder on the dashboard                                                                     |
| Manual detection is slower than automatic                                     | The "Check portal" link + dropdown + hotkeys keep it to about 10s per firm. The 10-minute CSV-to-call-list target is measured **excluding** manual detection. |
| Moving from PGlite to Neon later                                              | Same dialect. A CI job runs migrations against a real Postgres service container too (free on GitHub Actions).                                                |
| CI free minutes run out (private repo)                                        | CI pauses without charge, and every check runs locally via lefthook and `pnpm test`                                                                           |

---

## 12. Success criteria (Free Build version)

- A scraped CSV becomes a scored, deduplicated call list in under 10 minutes, **not counting manual software tagging**.
- Logging a mystery shop takes ≤ 60 seconds.
- Call prep takes 1 click, and the audit PDF takes 2.
- At 1440×900 the dashboard answers "on track for the kill test and 7% WoW?" without scrolling.
- Every audit and script text has passed a logged layer-1 fair-housing check.
- **Running cost: $0.**

---

## 13. Open items

1. The founder will send sanitized scraper CSV rows later. They get added as an extra import fixture when they arrive.
2. The superpowers plugin isn't installed in this session. Workflows are followed by hand from the brief.
3. **Design token conflict (for Checkpoint C):** a gold focus ring on #F7F5F0 is only 1.96:1, below the 3:1 that WCAG 1.4.11/2.4.11 require. The fix is set out in the Phase 1 plan: a navy focus outline with a gold outer ring for decoration.

---

## 14. Self-review (revision 2)

- [x] Every one of the founder's hard rules maps to a section: $0 → sections 3 and 9; no AI/Places/email/GHL → sections 5 and 6; local → sections 3.3 and 9; database → 3.2; auth → 3.3; AI hooks → 6.
- [x] All 10 Free Build items are present, in the founder's order (section 4).
- [x] Every deferred item is listed (section 5) and mirrored in `docs/ideas.md`.
- [x] No step needs a card or an account. GitHub, which already hosts the repo, is the only account involved.
- [x] Part 3 questions for deferred features are skipped (section 1).
- [x] Contradictions resolved: the brief's "shareable ROI link" (now local-only), "+10 review boost" (deferred with M3), "20 transcripts in the seed" (deferred with M12), and the "AI call audit-logging" rule (applies once hooks go live).
- [x] No secrets, PII or real firm names.
