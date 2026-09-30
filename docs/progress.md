# Progress

A short note after every step, newest first. Evidence (test output) is pasted in each entry.

## 2026-09-30: Step 11, Final polish: done

- **Code review (high):** 10 findings, all fixed with tests (`docs/reviews/2026-09-30-final.md`).
- **Design review:** none 🔴. Three 🟠 fixed: an h1 in call-block and Present modes (plus a test that every page has exactly one), one primary action on Pilots, and Edit buttons sized to their label. Four 🟡 recorded.
- **Performance:** every page server-renders in 23–103 ms on a production build. `pdf-lib` and the fixtures stay server-side.
- **Screenshots:** every page at 1440/768/320 in both themes, 138 files in `docs/screenshots/pages/`.
- **README:** a "Start here" section covering install, the Google key (restricted to Places API (New), with a $1 budget alert), wiping the demo data, and the daily routine.
- **Evidence:**
  - Typecheck is clean, and lint has 0 errors.
  - Unit tests: 86 files, 593 passed.
  - e2e: 139 passed, 143 skipped (viewport flows and the on-demand screenshots), with axe at 0.
  - `pnpm build` passes, and `pnpm scan:key` passes.
  - Domain coverage: 97.5% statements, 92.5% branches, 98.7% lines.

## 2026-09-30: Step 10, Dashboard and Settings completion (M17, M18): done

- **Dashboard:** a "Getting started" checklist (7 steps, collapsed to one line, so the dashboard still fits 1440×900). It counts only real data: demo firms are recognized by reserved `.example` domains and 555-01xx phones.
- **Notification bell:** callbacks, reply checks, call-now leads (a shop unanswered for 24h and not called since; links to the call workspace), finder places waiting for triage, and pilots at risk.
- **⌘K:** 20 actions, covering finder, triage, import, duplicates, software review, shops, call block, pipeline, ROI and Present, audit, pilot, fair-housing, scripts, weekly numbers, backup and the Places key. The broken "New audit" link is fixed.
- **Shortcut sheet (?):** grouped tables for Everywhere, Call workspace (1–9 and Esc), Finder triage (A/S/N/D/O/U) and Pilot daily entry.
- **Settings:**
  - Weekly numbers, stored per Monday as an upsert.
  - Scoring weights; saving rescores every lead with a history row.
  - Software patterns and the exclusion list: add, and turn off or on.
  - Business hours; saving re-buckets every shop.
  - Thresholds: kill test, guarantee and call blocks, validated.
  - Brand wordmark (used on the audit PDF) and the shopper's real name.
  - Google Places.
  - Data:
    - JSON export of every workspace table and a PGlite backup (`.tar.gz`), both audit-logged.
    - Leads CSV.
    - "Delete demo data", which only runs after typing DELETE DEMO DATA. A catalog test proves every table that points at a firm is handled.
- **Evidence:** typecheck is clean, and lint has 0 errors (1 known warning). `pnpm test` passes 86 files and 584 tests. Full `pnpm e2e`: 138 passed, 93 skipped by viewport, with axe at 0.

## 2026-09-30: Step 9, Pilot scorecard (M10): done

- **Guarantee** (`lib/domain/guarantee.ts`): tours, projected tours (tours × 14 ÷ days elapsed) and an inquiry-weighted median reply.
  - Status is on track before day 7 ("too early to judge"), then on track or at risk, then met or missed from day 14. Each status comes with its reasons.
  - Rules come from the `guarantee` setting; the tour target is per pilot.
- **Daily entry:** a grid per pilot with 8 numbers per vacancy. Tab moves across, the arrow keys move up and down, and Enter saves. It's an upsert per vacancy per day through `withAudit`. Future days, days outside the pilot and other pilots' vacancies are refused.
- **Pilots page:** start a pilot (firm, day 0, up to 3 vacancies with their usual days on market). "Close pilot" appears from day 14 and records met (every vacancy met) or missed. Status always shows icon + label + color.
- **Evidence:** `pnpm test` passes 80 files and 566 tests. Full `pnpm e2e`: 132 passed, 87 skipped by viewport, with axe at 0. Domain coverage: guarantee.ts 97% lines, and audit.ts branches went from 74% to 95% with new tests.

## 2026-09-29: Step 8, Fair-housing checker layer 1 (M14): done

- **Checker:** `lib/domain/fair-housing.ts` runs an editable regex list with pass / warn / block; block wins over warn.
  - It's seeded with the brief's examples plus NY/NYC/NJ source-of-income rules: vouchers, Section 8, CityFHEPS, HRA, HASA, SEPS, LINC, SRAP/RAP, public assistance, and "income must be from employment".
  - False-positive tests pass: "family room", "walk to church", "Section 8 welcome", "Kids' playroom" and "no pets; assistance animals welcome" are all clean.
- **Logging:** every check is logged in `fair_housing_check` (a hash of the text plus the flagged phrases, never the text) and audited.
- **Overrides:** a warning can be overridden with a reason of 10+ characters. A block can't be overridden (D-C1).
- **Rule edits:** a rule is refused if it's broken, catastrophic (nested repeats) or matches everything. Rules are turned off, never deleted (D-C3).
- **Page:** `/settings/fair-housing` has a text tester, a call-script editor (each save is checked: blocked wording isn't saved, and a warning needs a reason), the rule editor and the check log. Everything is labeled "Screening aid, not legal advice."

## 2026-09-29: Step 7, Vacancy audit PDF (M8): done

- **Snapshot:** starting an audit freezes the firm's shops and stats, the metro median (anonymous, and only with 3+ firms shopped in the metro; otherwise "unknown") and the ROI (the latest saved scenario, or defaults, labeled as such).
- **Summary:** the founder writes the 3-sentence summary, with a live sentence counter and number check. Every number must match a figure on the page (rounding allowed). `AI-HOOK(M8)` marks the spot.
- **Export:** "Check and export PDF" saves the summary, runs the number check, then the fair-housing check on the whole page. The PDF route (`/audits/[id]/pdf`) serves the file only when the linked check is cleared _and_ its hash matches the current text, so an edit after the check needs a new check. The export is audit-logged.
- **PDF:** one Letter page drawn with `pdf-lib` (MIT, no service): wordmark, summary box, response-time table vs the metro median, the renter's experience (up to 8 shops), the ROI marked Estimated, the method note, and a footer ("response behavior only; screening aid, not legal advice").
- **Links:** the lead panel links to "ROI for this firm" and "Start a vacancy audit" (shopped, non-do-not-call firms).
- **Evidence:** typecheck is clean, and lint has 0 errors (1 known TanStack warning). `pnpm test` passes 78 files and 551 tests. Full `pnpm e2e`: 129 passed, 81 skipped by viewport, with axe at 0. Mutation checks: breaking the number check fails 2 tests, and dropping the hash check fails 1.

## 2026-09-29: Step 6, ROI calculator (M9): done

- **Formulas** in `lib/domain/roi.ts`: rent × 12 ÷ 365 per vacant day ($1,800 → $59.18), annual vacancy loss, savings from leasing N days faster, fee (price by vacancies + $300 setup), net savings and payback. Every result is labeled "Estimated".
- **The URL holds the inputs**, so "Copy link" gives a local shareable link. Out-of-range or invalid values fall back to defaults, and the screen shows the same clamped numbers the link restores.
- **Present mode** (`?present=1`): big type, no form, "Exit present mode".
- **"Save for {firm}"** (opened with `?lead=`) stores a `roi_scenario` through `withAudit`. Call prep quotes it; with no scenario, it shows "unknown · Work it out", linking to the calculator.
- **Evidence:** `pnpm test` passes 73 files and 522 tests. The ROI e2e passes 3/3, with axe at 0 at 1440/768/320, including Present mode. Routes, calls and ROI together: 18 passed.

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
