# Plan: Checkpoint S (Direction C shell, Dashboard, Leads)

- **Scope:** founder decisions of 2026-09-28: Direction C (split view), B's "Next up" card on the Dashboard, and the Graphite palette.
- **Stop:** at Checkpoint S, with screenshots at 320/768/1440 in both themes.
- **Global constraints:** the same as the Phase 1 plan header (TDD, $0, guardrails, design rules). reui.io is not reachable yet, so the data grid sits behind `components/data-grid/` so reui can replace it later.

## Tasks (test first, each)

1. **Scoring (`lib/domain/scoring.ts`).** Editable weights, a 0–100 cap, AppFolio → 0, a breakdown, and `whyThisLead()` that never invents missing values. The seed applies scores and writes `score_history`.
2. **Shop stats (`lib/domain/shop-stats.ts`).** Median, P75 and P90. Two medians: replied-only, and with no-reply counted as never answered. No-reply share at 24h and 72h.
3. **Queries (`lib/queries/*`).** Dashboard (key numbers, kill test, today list, next up, MRR series) and Leads (list, counts, detail). Tested against a seeded in-memory DB.
4. **Shell.** Grouped sidebar (Sell / Prove) with counts, a top bar (breadcrumb, notification bell, theme), a ⌘K command menu (pages, lead search through a Route Handler, actions), and the keyboard map (G+D/L/C/P, /, ?).
5. **Page header component.** Title, context, 2–4 key numbers, one primary action, identical on every page.
6. **Dashboard.** Header, the Next up card, then a split: the Today list + detail panel, with the kill test and MRR vs 7% chart (Recharts, one solid line + dashed labelled projection, with a table view).
7. **Leads.** Header, filter chips, a virtualized table (TanStack Table + Virtual behind a DataGrid interface), a sticky header and a detail panel. The URL `?lead=<id>` makes a record linkable, J/K and arrow keys move between rows, and below 1280px the detail becomes a Sheet.
8. **e2e + screenshots.** Axe in both themes, keyboard (J/K, ⌘K, Esc), URL sync, and screenshots at 320/768/1440 in light and dark.
