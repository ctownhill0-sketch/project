# Progress

A short note after every step, newest first. Evidence (test output) is pasted in each entry.

## 2026-09-29: Step 5, Pipeline (M7): done

- **Kanban board:**
  - cards can be dragged between columns, and every card also has a "Move to…" menu (the keyboard equivalent of dragging);
  - moving a deal to Lost opens a dialog that requires a reason;
  - each card shows its stage history, days in stage and expected MRR, and vacancies can be edited (expected MRR recomputes).
- **Table view** at `?view=table`.
- **Page header:** open deals, expected MRR (Estimated), won and lost this month.
- **"Add to pipeline"** in the lead panel. Deals also open and advance automatically from calls.
- **Evidence:** `pnpm test` passes 71 files and 514 tests. The pipeline e2e spec passes 5/5 at desktop, and axe is at 0 on the board and table in both themes at all widths.

## 2026-09-29: Step 4, Call workspace (M6) and call-block mode: done

**Built**

- **Today's call list:**
  - order: callbacks due (oldest first), then "call now" firms (a fresh slow or no-reply shop since the last call), then highest score;
  - skips do-not-call, excluded and archived firms, firms without a phone, firms called in the last 2 days, and finished ones (not interested, wrong number, audit booked).
- **Call workspace:**
  - a big `tel:` link (the app never dials);
  - scripts with `{{variables}}` filled from the firm's own data, and missing values highlighted as "unknown";
  - the objection library with a "heard it" count;
  - dispositions on keys 1–9 (9 = do not call, press twice);
  - notes, a decision-maker flag, and next-step scheduling (suggested as the next business day(s) in NY time if left blank).
- **Call prep** from the lead, shops, the finder's website evidence, ROI and recent calls. `AI-HOOK(M5)` marks where the Claude brief goes.
- **Call-block mode** (`/calls?mode=block`, also from the Dashboard): a focus view with "call N of M", the next firm loaded automatically after each disposition, and Esc to exit.
- **Do not call** sets the firm's permanent flag, closes its open deal as lost, and blocks further calls.
- **Pipeline core (for Step 5):** one open deal per company, a stage event for every move, a required lost reason, expected MRR recomputed on each change. Calls move the deal forward only, never back.

**Evidence**

- `pnpm test`: 70 files, 513 tests passed.
- `pnpm e2e`: 113 passed, 0 failed. The calls spec covers hotkey logging, block-mode auto-advance and Esc, the do-not-call double press, and axe in both themes.

**Fixed**

- React key warnings for JSX passed in props arrays from Server Components (Calls and Dashboard lists).

## 2026-09-29: Step 3, Mystery-shop tracker (M4): done

**Built**

- **Log a shop in under a minute:** search for the firm, pick the channel, "Just now" or an earlier time, with optional listing and notes. The hours bucket (business, Saturday or after hours) is computed in New York time, correct across daylight saving.
- **Replies:** "Replied now" in one tap (with reply type: a person, an auto-reply or an AI assistant), or an earlier reply time. Reply times are validated.
- **Stats:** two medians side by side (replies only, and no reply counted as never), P75/P90, and no-reply share at 24h and 72h, for all shops and split into business, Saturday and after hours.
- **In-app reply checks** at 1h, 4h, 24h and 72h, on the Shops page, the dashboard and the bell.
- **Ethics:** a panel on the page, and enforced rules: the founder's real name (Settings `shopperName`, falling back to the user's name), one shop per firm per 30 days, and never a do-not-call firm (D-S1).
- **"Plan mystery shops" checklist:** from the Leads bulk bar, the finder's triage finish, or your top new leads. It shows each rentals page link and a done state derived from logged shops.

**Evidence**

- `pnpm test`: 66 files, 495 tests passed. The shops spec passes 8/8, axe at 0 on /shops and /shops/plan in both themes at all widths.

**Fixed**

- One full e2e run showed a transient axe failure on /finder/results that didn't reproduce in 3 repeats or a full rerun.
- Root cause (most likely): the resize handle exists for a moment after hydration before the panel library sets its `aria-valuenow`.
- The handle is now hidden by CSS until it has a value, and a new test checks that it then appears.

## 2026-09-29: Step 2, Leads completion: done

**Built**

- **CSV import wizard:** upload, match columns (guessed, plus saved mappings), preview the first 20 rows, then import.
  - Rows are checked against existing leads (website, phone, similar name + town), the do-not-call list and earlier rows of the same file.
  - Do-not-call matches and duplicates are never imported. Similar names are imported and flagged for the merge screen.
  - The chain and not-a-fit rules apply, scores are computed, and every import has an ImportBatch plus audit rows.
- **CSV export:** the current filtered list, audit-logged as an export. Cells that would run as spreadsheet formulas are neutralized.
- **Merge screen:** possible-duplicate pairs shown side by side; keep either one.
  - Calls, shops, contacts, deals and other attached records move over, and blank fields are filled in.
  - Do-not-call carries over, and it refuses if both firms have an open deal.
- **Software:** a manual override (with an evidence note) in the lead panel, plus a software review queue for low-confidence or unknown firms.
- **Saved views** for Leads filters.
- **Bulk bar:** Researching, Ready, Archive, Plan mystery shops and Export CSV. Excluded and do-not-call firms are never bulk-changed.
- **Lead panel:** now shows the finder's website evidence with sources, and Google data and reviews under attribution.

**Evidence**

- `pnpm test`: 63 files, 481 tests passed.
- The import and manage tests were written after the code (a TDD slip). Mutation checks confirm they fail when the merge do-not-call carry-over or the bulk do-not-call exclusion is removed.
- `pnpm e2e`: the leads-tools spec passes 13/13, axe at 0 on the import, duplicates and review pages in both themes. The full run was green after the fix below.

**Fixed along the way**

- A similar-name repeat inside one CSV was skipped instead of flagged.
- The Leads spec now targets the name cell, since the grid has a checkbox column.

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
