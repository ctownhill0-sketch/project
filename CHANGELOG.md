# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow the Free Build steps.

## [Unreleased]: UI upgrade

### Added

- **Shell (Direction C):**
  - grouped sidebar with counts and a top bar (breadcrumb, notification bell, theme);
  - a ⌘K command menu for pages, leads by name, town or phone, and actions;
  - a keyboard map: G then D/L/C/P, `/`, `?`, and J/K in lists.
- **Page header** on every built page: title, one line of context, 2–4 key numbers and one primary action.
- **Dashboard:**
  - a Next up card;
  - a Today split view (list + lead detail, linkable with `?lead=`);
  - the Day-90 kill test;
  - MRR vs a dashed, labeled 7% weekly projection, with a table view.
- **Leads:**
  - filter chips and search kept in the URL;
  - a virtualized DataGrid (TanStack Table + Virtual behind a `GridColumn` interface, so reui can replace it) with a sticky header, sorting, column visibility and a density toggle;
  - a split view with J/K and arrow keys. Below 1280px the detail opens as a sheet.
- Phone numbers display as `(917) 555-0125` and dial through `tel:+1…` links.

### Fixed

- The skip link was hidden under the sticky sidebar when focused.
- Selecting a list row no longer scrolls the page or moves the Tab starting point, which had skipped the skip link.
- The MRR chart no longer overflows a 320px screen before it measures.
- The resize handle no longer renders before hydration, when it had no value to announce.

### Changed

- **Palette: Graphite** (graphite + indigo) replaces navy + gold, chosen at Checkpoint P. The tokens are generated from `docs/palettes/palettes.mjs` and kept in sync by tests.
- Status colors re-chosen for color-blind separation. The old warning and destructive were indistinguishable with deuteranopia.
- New `destructive-text` token for inline error text. The focus ring is simplified to one indigo outline.
- The normalizer now routes library error text to `destructive-text` and strips opacity from colored text.

## [Unreleased]: Step 1 Foundation (complete, awaiting Checkpoint C)

### Added

- Next.js 16.3 app with strict TypeScript, pnpm, and the dev server bound to localhost only.
- Tooling: Vitest, Playwright + axe, ESLint (jsx-a11y, Radix and AI-SDK import bans), Prettier, lefthook pre-commit, and GitHub Actions CI (typecheck, lint, unit, e2e, gitleaks, real-Postgres migration parity).
- Database: PGlite + Drizzle with the full 46-table schema, committed migrations, and a friendly error if two copies of the app open the database.
- Guarantees enforced by tests or the database:
  - every table has workspace, creator and timestamp columns;
  - no column can store a protected characteristic;
  - one open deal per company;
  - do-not-call flags are permanent.
- Local single-owner `requireUser()`, a transactional audit log with personal-data redaction, and a localhost-only `proxy.ts`.
- Design contract, semantic color tokens with WCAG contrast tests (all pairs pass), the type, radius, shadow and motion tokens, self-hosted Inter, and a `<Num>` component.
- Domain logic: business/Saturday/after-hours bucketing across daylight saving and US federal holidays, pricing and expected MRR.
- Fictional seed data: 50 NYC-metro firms (5 on AppFolio, 5 duplicates), 40 mystery shops (8 with no reply), 25 calls, 12 deals, 2 pilots on day 7 (one on track, one at risk), 12 weeks of metrics, and default settings (Day 0 29 Sept 2026, deadline 28 Dec 2026).

- shadcn/ui on Base UI (21 components), with a tested normalizer (`pnpm ui:normalize`) that enforces the design contract on every added component.
- Status badge, six-state components, icon set, theme toggle (no flash) and a responsive shell (sidebar, drawer, phone bar).
- `/design` page and 12 screenshots (3 widths × 2 themes × shell/design).
- End-to-end tests: axe in both themes, keyboard-only focus visibility, reduced motion, 44px touch targets and theme persistence.

### Fixed (code and design review)

- Do-not-call rows can no longer be deleted (the delete-and-re-add bypass).
- `cn` now knows the type-scale utilities. getDb retries after a failed open. The lock is atomic. `db:reset` respects the lock.
- Seed owner email is fictional. Audit redaction covers names, notes and snake_case keys.
- Strict H:MM business-hours parsing. Valid section ids on `/design`.
- Accessibility: focusable table scroll regions, focus kept clear of the phone bar, visible outline-button edges, readable inactive tabs.

### Changed (from the plan)

- Execution mode: executing-plans (sequential tasks) instead of subagent-driven.

- Next 16 renamed `middleware.ts` to `proxy.ts`.
- Inter is self-hosted, so builds work offline.
- Software patterns: the brief's 7 patterns (the plan said 9).
- The seed's daylight-saving test data uses the 8 Mar 2026 change, because 1 Nov 2026 is in the future.
