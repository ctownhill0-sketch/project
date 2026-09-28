# Design contract

The rules every screen follows. It comes from brief Part 8 and the approved spec. When the code and this page disagree, the code is the bug. The source of truth for values is `lib/design/tokens.ts`, and `lib/design/*.test.ts` enforces them.

## 1. Direction

- **Mood:** a calm operations console in **Graphite** (neutral graphite surfaces, deep indigo actions), chosen at Checkpoint P on 2026-09-28. Options and evidence are in `docs/palettes/`.
- **The memorable element:** large, tabular numbers in graphite ink.
- **Indigo** marks the one primary action, links, selection and focus. Nothing else competes with it.

## 2. Color tokens (semantic only)

The source of truth is `lib/design/tokens.ts`, generated from `docs/palettes/palettes.mjs`. `lib/design/palette-choice.test.ts` keeps them in sync, and `lib/design/contrast.test.ts` measures every pair below in both themes.

| Token                      | Light   | Ratio               | Dark    | Ratio               | Use                                     |
| -------------------------- | ------- | ------------------- | ------- | ------------------- | --------------------------------------- |
| `background`               | #F6F6F7 |                     | #0E0E12 |                     | Page                                    |
| `surface (card)`           | #FFFFFF |                     | #16161C |                     | Cards, panels, tables                   |
| `surface-raised (popover)` | #FFFFFF |                     | #1D1D25 |                     | Popovers, sheets, dialogs               |
| `subtle (muted)`           | #EDEDF1 |                     | #22222B |                     | Selected rows, quiet fills              |
| `foreground`               | #17171C | 16.54 on background | #ECECF1 | 16.36 on background | Body text, numbers                      |
| `muted-foreground`         | #50505C | 7.36 on background  | #A7A7B4 | 8.10 on background  | Secondary text                          |
| `primary`                  | #4338CA | 7.90 on surface     | #8E92F7 | 6.52 on surface     | The one primary action (UI 3:1)         |
| `primary-foreground`       | #FFFFFF | 7.90 on primary     | #11113A | 6.53 on primary     | Text on primary                         |
| `accent`                   | #5A5CE6 | 5.11 on surface     | #8E92F7 | 6.52 on surface     | Selection, meters, rules (fill)         |
| `link`                     | #4338CA | 7.32 on background  | #A7AAF9 | 8.95 on background  | Links                                   |
| `success`                  | #2D8014 | 4.99 on surface     | #5FD37F | 9.53 on surface     | Status text on surfaces, icons anywhere |
| `warning`                  | #774500 | 7.97 on surface     | #EE921A | 7.52 on surface     | Status                                  |
| `destructive`              | #D74030 | 4.50 on surface     | #F0555B | 5.28 on surface     | Status and icons                        |
| `destructive-text`         | #A8212E | 6.65 on background  | #F47A7F | 7.28 on background  | Inline error text on any background     |
| `info`                     | #3A6FA3 | 5.27 on surface     | #88ABEA | 7.77 on surface     | Status                                  |
| `border`                   | #DBDBE1 |                     | #2E2E39 |                     | Decorative dividers only                |
| `border-strong (input)`    | #737383 | 4.31 on background  | #72727F | 4.06 on background  | Control boundaries (3:1)                |
| `ring`                     | #4338CA | 7.32 on background  | #A7AAF9 | 8.95 on background  | Focus ring (3:1)                        |

Chart lines 1–5: light #697EDA, #89401C, #0D9F66, #916607, #DC428A; dark #596CC6, #9A5426, #2D9570, #976C14, #A15884.

**Rules**

- **Status text** (success, warning, destructive, info) sits only on a surface. `StatusBadge` always carries its own card fill. Status icons and marks may touch the page background (≥ 3:1).
- **Error text** in forms, alerts and destructive buttons uses `destructive-text`, which passes on any background and on its own 10% tint. `destructive` is the status and icon tone. `pnpm ui:normalize` routes shadcn's `text-destructive` to it.
- **Color blindness:** status colors were chosen by searching thousands of combinations for color-blind separation at text contrast. The worst pair is 7.5 in light and 8.5 in dark (OKLab ΔE×100), and every status also has an icon and a label. Chart colors 1–5 pass the dataviz validator in both modes (color-blind separation ≥ 9.4).
- **Focus:** one 2px `ring` outline, 7.32:1 in light and 8.95:1 in dark. The old gold halo is gone.
- Text colors never use opacity (`text-x/80`), because the measured contrast must be what renders. The normalizer strips it.

## 3. Type

- Inter at weights 400, 500 and 600, via `next/font`.
- Scale (px, size/line-height): 48/56 · 36/44 · 28/36 · 22/30 · 16/24 · 14/20 · 12/16.
- `tabular-nums` on every number. Numbers are right-aligned in tables.
- `text-wrap: balance` on headings, and a max line length of 80ch.
- Sentence case everywhere.

## 4. Space, radius and shadow

- **Spacing:** 4px steps, always applied with `gap-*`, never `space-y-*`.
- **Radius:** 8 (controls), 12 (cards), 16 (modals). Nested radius = outer radius − padding.
- **Shadows (exactly three, nothing else):**
  - `shadow-sm` for controls,
  - `shadow-md` for cards and popovers,
  - `shadow-lg` for modals only.
- One shadow per element. Dense lists and dark mode use borders instead. Tailwind's built-in shadows are cleared.

## 5. Motion

| Frequency                                               | Rule                              |
| ------------------------------------------------------- | --------------------------------- |
| 100+ a day (⌘K, hotkeys, dispositions, row moves, tabs) | **No animation**                  |
| Tens a day                                              | Instant, or a ≤100ms color change |
| Dialogs and toasts                                      | Standard animation                |
| Rare (first run, celebrations)                          | Delight allowed                   |

- **Durations:** press 100–160ms, tooltip 125–200ms, dropdown 150–250ms, dialog 200–300ms.
- **Easing:**
  - `--ease-out` = `cubic-bezier(0.23,1,0.32,1)`
  - `--ease-in-out` = `cubic-bezier(0.77,0,0.175,1)`
  - `--ease-drawer` = `cubic-bezier(0.32,0.72,0,1)`
  - Never ease-in.
- **Details:**
  - Pressed controls scale to 0.97.
  - Elements enter from scale(0.95) with fading opacity, never from 0 scale.
  - Popovers grow from their trigger.
  - Toasts enter and leave from the same side.
  - The first tooltip waits 400ms, and later ones open instantly.
- **Never:** `transition: all`, page transitions, scroll reveals, hover lifts or count-up KPIs.
- **Reduced motion:** transforms are removed and short opacity fades (≤150ms) are kept.

## 6. Layout and wireframes

- **Navigation:** a sidebar at ≥1024px, a drawer from 768 to 1023px, and a bottom nav below 768px (44px targets).
- **Actions:** one primary action per view.

```
1440 ─────────────────────────────────────────────────────────────
┌──────────┬───────────────────────────────────────────────────┐
│ Vacancy  │ Dashboard                          [theme] [ ? ]  │
│ Desk     ├───────────────────────────────────────────────────┤
│──────────│                                                   │
│ Dashboard│   (module content, max 1200px wide)               │
│ Leads    │                                                   │
│ Shops  ③ │                                                   │
│ Calls    │                                                   │
│ Pipeline │                                                   │
│ ROI      │                                                   │
│ Audits   │                                                   │
│ Pilots   │                                                   │
│──────────│                                                   │
│ Settings │                                                   │
│ Design   │                                                   │
└──────────┴───────────────────────────────────────────────────┘

768 ───────────────────────────────
┌─────────────────────────────────┐
│ [☰ Menu]  Vacancy Desk  [theme] │
├─────────────────────────────────┤
│  content                        │
└─────────────────────────────────┘
  ☰ opens a drawer (titled "Menu", focus trapped, Esc closes)

320 ───────────────────
┌─────────────────────┐
│ Vacancy Desk [theme]│
├─────────────────────┤
│  content            │
│                     │
├─────────────────────┤
│ Home Shops Calls ⋯  │  ← bottom nav, 44px targets
└─────────────────────┘
```

Dashboard at 1440×900 (must answer "am I on track?" without scrolling):

```
┌───────────────────────────────────────────────────────────────┐
│ MRR $0        WoW  —   ▼ Below 7% target      Day 3 of 90     │
├──────────────────────────────┬────────────────────────────────┤
│ Kill test                    │ MRR vs 7% projection (chart)   │
│ Pilots 0/3  Convos 0/60      │                                │
│ After-hours median 4h12m ✓   │                                │
├──────────────────────────────┼────────────────────────────────┤
│ This week (table)            │ YC readiness  MRR / clients    │
└──────────────────────────────┴────────────────────────────────┘
```

## 7. Allowed components (in this order)

1. shadcn core (Base UI).
2. reui.io: Data Grid, Filters, Kanban, File Upload.
3. coss.com/ui: Number Field, Meter, Segmented Control.
4. kokonutui, on rarely used screens only.
5. reactbits, on first-run or celebration screens only.
6. Custom code, last.

**Icons:** lucide at 2px stroke, imported from `@/components/icons` and marked with `data-icon`.

## 8. The six required states

| State    | Rule                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| Loading  | `Skeleton` placeholders in the final layout's shape                              |
| Empty    | One sentence + one action (`EmptyState`)                                         |
| Error    | What failed + how to fix it + a Retry button (`PageError`). No apologies, no "!" |
| Success  | A toast that repeats the action's verb ("Lead saved")                            |
| Disabled | Says why (`DisabledReason`, via `aria-describedby`)                              |
| Partial  | Labeled "Estimated" (`Estimated`)                                                |

**Status** always shows an icon, a label and a color together (`StatusBadge`).

## 9. Banned patterns

- Serif display type.
- Terracotta accents.
- All-caps eyebrow labels above headings.
- "A · B · C" strings.
- "→" suffixes on links.
- Monospace labels.
- Gradient washes.
- Grids of identical cards.
- 01/02/03 markers on things that aren't sequences.
- Raw hex colors in class names, manual `dark:` overrides, and hand-set z-index on overlays.
- `space-y-*`, `transition-all` and Tailwind's built-in shadows.
- An `isLoading` prop on buttons: use `Spinner` + `disabled` instead.
- Before shipping each phase: remove one decoration.

## 10. Accessibility (WCAG 2.2 AA)

- Landmarks (`header`, `nav`, `main`) and a skip link.
- Visible focus of at least 2px at ≥ 3:1, never covered.
- Targets at least 24×24px (44px on touch nav).
- Every drag has a menu alternative.
- Dialogs have a title and trap focus.
- Live regions announce updates. Charts ship with a text summary or data table.
- Reflow at 320px and 200% zoom.
- The theme toggle is a real button that follows the system setting and never flashes the wrong theme on load.
