# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow the Free Build steps.

## [Unreleased]: Step 1 Foundation (in progress)

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

### Changed (from the plan)

- Next 16 renamed `middleware.ts` to `proxy.ts`.
- Inter is self-hosted, so builds work offline.
- Software patterns: the brief's 7 patterns (the plan said 9).
- The seed's daylight-saving test data uses the 8 Mar 2026 change, because 1 Nov 2026 is in the future.
