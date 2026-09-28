# Checkpoint S: shell, Dashboard and Leads (Direction C, Graphite)

Screenshots are taken with `SHOTS=1 pnpm e2e e2e/screenshots.spec.ts`. Each one shows what fits the window. At 320 there is also a `-scrolled` shot of the list.

| Page      | 1440                                                                | 768                                                               | 320                                                                                                          |
| --------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Dashboard | [light](dashboard-1440-light.png) · [dark](dashboard-1440-dark.png) | [light](dashboard-768-light.png) · [dark](dashboard-768-dark.png) | [light](dashboard-320-light.png) · [dark](dashboard-320-dark.png) · [list](dashboard-320-light-scrolled.png) |
| Leads     | [light](leads-1440-light.png) · [dark](leads-1440-dark.png)         | [light](leads-768-light.png) · [dark](leads-768-dark.png)         | [light](leads-320-light.png) · [dark](leads-320-dark.png) · [grid](leads-320-light-scrolled.png)             |

## What to check

- **At 1280px and wider:** list and detail sit side by side and the split can be dragged. The URL carries `?lead=`, so a record can be linked. J/K move the selection from anywhere on the page.
- **Below 1280px:** the list fills the width and a row opens the detail as a sheet. Escape closes it and removes `?lead=` from the URL.
- **Leads grid:**
  - Firm, Town, Score, Software and First reply show by default. Listings, Units, Status and Phone are under "Columns".
  - The density toggle and column choices are remembered in this browser.
- **Not in this checkpoint:**
  - saved views, the bulk bar and call block mode (after Checkpoint F);
  - Lead Finder (Checkpoint F spec first).
