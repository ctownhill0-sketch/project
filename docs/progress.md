# Progress

A short note after every step, newest first. Evidence (test output) is pasted in each entry.

## 2026-09-29: Step 1, Lead Finder: done

**Built**

- The Checkpoint F spec, with Google pricing and terms (`docs/superpowers/specs/2026-09-29-lead-finder.md`).
- Migrations 0004–0006: 12 finder tables, including a permanent do-not-call list.
- **Places client:** exact field masks, pagination, typed errors, and caps checked before every request.
- **Polite fetcher:**
  - robots.txt, 5s per host, Retry-After, a 10s timeout and a 2 MB cap;
  - HTML only;
  - private-network and Google hosts refused on every redirect hop.
- **Enrichment:** software with evidence and confidence, size quotes, listing counts, generic contacts only, and service types.
- **Filtering and scoring:** chain and not-a-fit rules; dedupe in 4 ways with do-not-call protection; +10 review signals and −30 not a fit.
- **Reviews:** fetched on demand, with author attribution.
- **Triage:** keyboard triage (A/S/N/D/O/U) with undo; D needs a second press and is permanent.
- **Results and bulk actions:** a results grid with multi-select and a bulk bar (add, not a fit, CSV export).
- **Tracking:** territory tracker, saved searches, and a usage page.
- **Settings:** Google Places key status (last 4 characters), Test key (free request) and caps.
- **Google content:** expires after 30 days; place IDs are kept (D-F3).
- **Key-safety scan:** a canary key plus a self-test, and a new CI job.

**Evidence**

- `pnpm typecheck`: passes.
- `pnpm lint`: 0 errors. The one warning is the React Compiler skipping TanStack Virtual (a known incompatibility).
- `pnpm test`: 60 files, 461 tests passed.
- `pnpm e2e`: all passed, with the rest skipped by viewport or screenshot flag. Finder spec: 14/14 at 1440, 768 and 320, with axe at 0 in both themes.
- `pnpm scan:key`: "the canary key is in none of 1757 build files".

**Screenshots:** `docs/screenshots/pages/` covers dashboard, leads, finder, results, triage, usage and settings × 1440/768/320 × light/dark (42 files).

**Fixed along the way**

- Pages were prerendered at build time and touched the database; `requireUser()` now calls `connection()`.
- The split view laid out at content width before hydration; it now server-renders a static CSS-grid split.
- Screen-reader-only labels escaped scroll regions and widened the page; scroll regions are now `relative`.
- A place found to be a duplicate at add time is now moved to Duplicates.

**Open issues**

- Pricing and terms were read through Google's search snippets because developers.google.com is blocked here. The founder should confirm (spec §1.5, D-F1, D-F3).

## 2026-09-29: Checkpoint S approved; autonomous mode begins

- Checkpoint S approved with defaults. The Checkpoint F spec is written and self-approved: `docs/superpowers/specs/2026-09-29-lead-finder.md`.
- Baseline before Step 1: 311 unit tests, 83 e2e passed (25 skipped by viewport), 0 axe violations.
