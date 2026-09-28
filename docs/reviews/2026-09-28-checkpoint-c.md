# Checkpoint C review: tokens, /design and app shell

- **Date:** 2026-09-28
- **Scope:** Free Build Step 1 (Foundation), Tasks 1–42.
- **Evidence:** `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` gives 210 unit tests and 73 end-to-end tests (320/768/1440) passing, with 0 axe violations in both themes. Screenshots are in `docs/screenshots/`.

## Code review (high effort): 10 findings, 10 addressed

| Severity  | Finding                                                                           | Outcome                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical  | Do-not-call could be reset by deleting the row and re-adding it                   | Fixed: a database trigger blocks deleting flagged contacts and companies (`drizzle/0003`). **Carried into Step 2:** the CSV importer must match new rows against existing do-not-call firms. |
| Important | `cn` treated `text-small`/`text-caption` as colors and dropped classes            | Fixed: extended `cn` in `lib/utils.ts`, and the normalizer points shadcn at it                                                                                                               |
| Important | `getDb` cached a failed open forever                                              | Fixed, with a test                                                                                                                                                                           |
| Important | `db:reset` could delete the database under a running app                          | Fixed: it takes the lock first (checked by hand: it refuses while locked)                                                                                                                    |
| Important | Lock check-then-write race                                                        | Fixed: exclusive create (`wx`)                                                                                                                                                               |
| Important | Real personal email committed in the seed                                         | Fixed: fictional default, optional `OWNER_EMAIL`. _It remains in earlier git history._                                                                                                       |
| Important | Audit redaction missed contact names, notes and snake_case keys                   | Fixed, with tests                                                                                                                                                                            |
| Important | `"9:00"` business-hours setting became NaN, so every shop was classed after-hours | Fixed: strict H:MM parsing that throws on anything else                                                                                                                                      |
| Important | `/design` section ids contained spaces, which broke `aria-labelledby`             | Fixed: slugged ids, and e2e checks the named regions                                                                                                                                         |
| Minor     | Some numbers bypassed `<Num>`                                                     | Fixed on `/design`. Placeholder "step N" copy left as is; those pages are replaced module by module.                                                                                         |

## Design review (brief 8.12)

Findings, ranked. None are 🔴.

1. 🟠 **Touch targets were 28–32px on phones.** _What:_ `components/ui/button.tsx:21` (h-8) and the other triggers. _Why:_ brief 8.8 requires 44px touch targets. _Fix (done):_ a `pointer: coarse` minimum of 44px in `app/globals.css`. The e2e test fails without it (28px) and passes with it.
2. 🟠 **Outline buttons had no visible edge.** _What:_ `components/ui/button.tsx:11`, `components/states/empty-state.tsx:22`. _Why:_ the decorative border is 1.36:1, so controls read as plain text. _Fix (done):_ the `border-input` edge (3.99:1) through the normalizer and `cn`, with a regression test.
3. 🟠 **The gold focus ring failed 3:1 on warm white (1.96:1).** _What:_ design tokens. _Why:_ WCAG 2.4.11 / 1.4.11. _Fix (done):_ a navy outline with a gold halo in light mode, gold alone in dark mode.
4. 🟠 **Focus hidden behind the phone bottom bar.** _What:_ `app/(app)/layout.tsx:52`. _Why:_ WCAG 2.4.11. _Fix (done):_ `scroll-padding-bottom` below 768px, covered by a keyboard e2e test.
5. 🟠 **Wide tables weren't keyboard-scrollable at 320px.** _What:_ `components/ui/table.tsx:6`. _Why:_ axe `scrollable-region-focusable`. _Fix (done):_ a focusable, labelled region, with a regression test.
6. 🟡 **Inactive tab labels used translucent text (3.84:1).** _What:_ `components/ui/tabs.tsx`. _Fix (done):_ the normalizer maps them to `muted-foreground` (6.39:1).
7. 🟡 **The theme icon was wrong for a frame before hydration.** _What:_ `components/theme-toggle.tsx`. _Fix (done):_ CSS keyed on `data-theme`, covered by an e2e test.
8. 🟡 **"Mystery shops" wrapped to two lines in the phone bar.** _Fix (done):_ a `shortLabel` of "Shops".
9. 🟡 **Skeletons are very quiet** (`bg-muted` on the background, about 1.07:1). _Why:_ on some screens the loading state could look empty. _Fix:_ revisit in Step 2, where the first real list gets a loading state. Decorative, so there's no WCAG requirement.
10. 🟡 **`main` uses `outline-none` as the skip-link target.** _Why:_ focus moves there but nothing shows it. Programmatic focus on a non-interactive landmark is exempt, and the skip link itself is visible. _Fix:_ no change; recorded for the Step 10 accessibility pass.

**Decoration removed (brief 8.1):** the dashed border around empty states.

**Strengths**

- Every color pair is contrast-tested in both themes, and tokens can't drift from the CSS (sync test).
- Status is always icon + label + color. Numbers are tabular, and missing data shows "unknown".
- Keyboard-only, reduced-motion and axe checks run at three widths in CI, not just once by hand.
- The normalizer brings every future `shadcn add` in line with the design contract automatically.

## Not verifiable in this container (for the founder on the Mac)

- **200% zoom:** reflow is covered by the 320px tests (the same CSS width as 1280px at 400%), but a manual check at 200% is still worth a minute.
- **VoiceOver smoke test:** needs macOS. ⌘F5 turns VoiceOver on. Tab through `/dashboard` and `/design` and listen for the landmarks, "Skip to content" and the nav names.
- **Next.js 16.3.7** (security release due 30 Sept): not published yet (16.3.6 is the latest today). Bump it when it's out.
