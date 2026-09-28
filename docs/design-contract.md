# Design contract

The rules every screen follows. It comes from brief Part 8 and the approved spec. When the code and this page disagree, the code is the bug. The source of truth for values is `lib/design/tokens.ts`, and `lib/design/*.test.ts` enforces them.

## 1. Direction

- **Mood:** a calm operations console.
- **The memorable element:** large, navy, tabular numbers.
- **Gold:** only as thin rules, fills or (in dark mode) focus rings. **Never as text on a light background.**

## 2. Color tokens (semantic only)

Every text pair must reach at least 4.5:1, and every UI boundary at least 3:1. The measured ratios are checked by `lib/design/contrast.test.ts`.

| Token                | Light                    | Ratio (light)             | Dark         | Ratio (dark)              | Use                                                 |
| -------------------- | ------------------------ | ------------------------- | ------------ | ------------------------- | --------------------------------------------------- |
| `background`         | #F7F5F0                  |                           | #0B1B2E      |                           | Page                                                |
| `foreground`         | #0F2A44                  | 13.43 on bg               | #E8EDF3      | 14.74 on bg               | Body text, numbers                                  |
| `card`               | #FFFFFF                  |                           | #12263D      |                           | Cards, popovers                                     |
| `card-foreground`    | #0F2A44                  | 14.63                     | #E8EDF3      | 13.02                     |                                                     |
| `muted`              | #EFECE4                  |                           | #1A3150      |                           | Quiet fills                                         |
| `muted-foreground`   | #4A5566                  | 6.93 on bg, 6.39 on muted | #A9B4C2      | 8.26 on bg, 6.25 on muted | Secondary text                                      |
| `primary`            | #0F2A44                  |                           | #E3A72F      |                           | The one primary action                              |
| `primary-foreground` | #FFFFFF                  | 14.63                     | #0B1B2E      | 8.12                      |                                                     |
| `accent` (gold)      | #E3A72F                  | fills only                | #E3A72F      |                           | Rules, meters, selected fills                       |
| `link`               | #8C5F0A                  | 5.13 on bg, 4.74 on muted | #E3A72F      | 8.12                      | Links (Gold Deep)                                   |
| `success`            | #1E7A4C                  | 4.89 on bg                | #4CC38A      | 7.83 on bg                | Status (always with icon + label)                   |
| `warning`            | #8A5A00                  | 5.44 on bg                | #F0B44C      | 9.37 on bg                | Status (always with icon + label)                   |
| `destructive`        | #B42318                  | 6.03 on bg                | #F97066      | 6.23 on bg                | Errors, destructive actions                         |
| `border`             | #D9D4C7                  | decorative (1.36)         | #24395A      | decorative                | Dividers only, never the only boundary of a control |
| `input`              | **#6F7A8A**              | 3.99 on bg, 4.35 on card  | **#6B7B91**  | 3.55 on card              | Control borders (must be ≥ 3:1)                     |
| `ring`               | navy #0F2A44 + gold halo | 13.43                     | gold #E3A72F | 8.12                      | Focus                                               |

**Findings from planning, now fixed:**

- **Focus ring:** gold on #F7F5F0 is only 1.96:1. Light theme uses a 2px navy outline (13.43:1) with a 2px gold halo outside it as decoration. Dark theme uses a 2px gold outline (8.12:1).
- **Input border:** the first candidate #8A94A3 was only 2.82:1, so it's now #6F7A8A. The dark theme's #5B6B80 was 2.82:1 on cards, so it's now #6B7B91.

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
