# Free Build: final report

- **Date:** 2026-09-30
- **Branch:** `claude/confident-brahmagupta-d3r1c1`, final commit `e36d299`.
- **Screenshots:** every page at 1440 / 768 / 320 in light and dark, named `<page>-<width>-<theme>.png`, in `docs/screenshots/pages/`.

## Modules

| Module                | What it does                                                                                                                                                                                                                                                | Screenshots                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Lead finder           | Territories and saved searches through the official Places API (New), within daily and monthly caps, with a usage page. The polite fetcher checks websites for leasing software. Keyboard triage (A/S/N/D/O/U).                                             | `finder`, `finder-results`, `finder-triage`, `finder-usage` |
| Leads                 | A virtualized grid with saved views, bulk status, CSV export, CSV import with column mapping, duplicate merge and a software review queue. The lead panel links to shops, ROI and audits.                                                                   | `leads`, `leads-import`, `leads-duplicates`, `leads-review` |
| Mystery shops (M4)    | A shop plan, logging under the founder's real name, reply checks at 1/4/24/72h, and New York business-hours buckets. Medians count no reply as never.                                                                                                       | `shops`, `shops-plan`                                       |
| Calls (M6)            | Call prep (the firm's own shop result, the ROI and scripts). Calls go through `tel:` links only. Dispositions use keys 1–9, and do-not-call needs a double press and is permanent. Call-block mode.                                                         | `calls`, `calls-block`                                      |
| Pipeline (M7)         | A kanban with drag and a "Move to…" menu, lost reasons, expected MRR and a table view. Deals open and advance from calls.                                                                                                                                   | `pipeline`, `pipeline-table`                                |
| ROI (M9)              | The formulas ($1,800 → $59.18 a day), all marked Estimated. The URL holds the inputs (a local shareable link). Present mode, and save for a firm (call prep quotes it). Out-of-range inputs are flagged.                                                    | `roi`, `roi-present`                                        |
| Vacancy audit (M8)    | A frozen snapshot, and the founder's 3-sentence summary with a sentence counter and number grounding. The fair-housing check runs before export. A one-page PDF includes the metro median (anonymous, 3+ firms) and a method note.                          | `audits`, `audit-detail`                                    |
| Fair-housing (M14 L1) | An editable regex list including NY/NYC/NJ source-of-income rules; pass / warn / block. Every check is logged by hash. Warnings need a written reason to override; blocks can't be overridden. It runs on scripts and audits.                               | `fair-housing`                                              |
| Pilots (M10)          | A daily grid per vacancy, driven by keyboard. The guarantee is on track or at risk from day 7, then met or missed at day 14, shown with icon + label + color. Rules are frozen at start.                                                                    | `pilots`                                                    |
| Dashboard (M17)       | The Next up card, Today (a split view), the kill test, MRR vs 7%, and the Getting started checklist. The bell covers callbacks, reply checks, call-now leads, finder results and pilots at risk. ⌘K has 20 actions, and ? shows the grouped shortcut sheet. | `dashboard`                                                 |
| Settings (M18)        | Weekly numbers, scoring weights (with a rescore), software patterns, the exclusion list, business hours (shops re-bucket), thresholds, brand, the Places key (✓/✗, last 4, Test key), usage and caps, JSON export, database backup and demo-data deletion.  | `settings`                                                  |
| Design system         | The Graphite tokens and the component reference.                                                                                                                                                                                                            | `design`                                                    |

## Test results (final run)

| Check                     | Result                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm typecheck`          | Clean                                                                                     |
| `pnpm lint`               | 0 errors. 1 warning: the known React Compiler skip on TanStack Virtual.                   |
| `pnpm test`               | 86 files, 593 tests passed                                                                |
| `pnpm e2e`                | 139 passed, 143 skipped (viewport-only flows and the on-demand screenshot spec), 0 failed |
| axe                       | 0 violations on every page, in both themes, at 1440, 768 and 320                          |
| Domain coverage           | 97.5% statements, 92.5% branches, 98.4% functions, 98.7% lines (goal: 90% or more)        |
| `pnpm build` + `scan:key` | Pass. The canary key is in none of 2,355 build files.                                     |

## Decisions made on your behalf

The full list, with reasons, is in `docs/decisions.md`. The ones worth a look:

- **Places (D-F1 to D-F4):**
  - Pricing was read from Google's own pages through search snippets, because the developer site is blocked in the build container. **Please confirm.**
  - Google display data is cached for 30 days, while place IDs are kept forever. **Please confirm.** You can set the cache to 0 days.
  - The caps are 100 searches a day and 900 a month, and 20 review lookups a day and 200 a month.
- **Fair housing (D-C1 to D-C3):** warnings can be overridden with a reason, but blocks can't. Only a hash of the checked text is logged. Rules are turned off, never deleted, and risky patterns are refused.
- **Audits (D-A1 to D-A3):**
  - The metro median needs 3 or more firms.
  - The summary must be exactly 3 sentences, and ungrounded numbers block export.
  - The PDF uses pdf-lib with Helvetica.
- **Pilots (D-P1 to D-P3):** the median reply is an inquiry-weighted median of the daily medians. You close a pilot by hand from day 14. Rules and vacancies are fixed per pilot.
- **Settings (D-M1 to D-M3):** "demo data" means only reserved `.example` domains and 555-01xx phones, and deleting it needs a typed phrase. The backup is PGlite's own tarball. Call-now items cover shops from 1 to 30 days old.

## Open issues and deferred work

- **Your Google key:** follow README → _Start here → Add your Google Places key_. Google needs a billing account (a card) to turn on Places API (New). The app's caps keep usage in the free tier, and the steps set a $1 budget alert. Everything is built and tested against recorded fixtures. The first live run will confirm the real response shapes.
- **To confirm:** the Places pricing and the 30-day cache window (D-F1, D-F3).
- **🟡 design notes** (none block use): Present mode keeps the sidebar, so use the browser's full screen. On phones the ROI results sit below the form. The pilot figures are tight at 320px.
- **Git history:** it still contains the personal email committed before Checkpoint C. Removing it would mean rewriting git history, which needs your go-ahead.
- **Deferred until revenue** (see `docs/ideas.md`): Claude features (call briefs, drafted audit summaries, the layer-2 fair-housing classifier; the AI-HOOK markers show where each plugs in), email sending, GoHighLevel, owner reports, the Company Brain, the content engine, deployment and background jobs.
