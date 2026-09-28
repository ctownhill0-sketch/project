# Checkpoint P: palette options

Three palettes, each with a full light and dark token set. Every value is checked by `check.mjs`: WCAG pairs, plus the dataviz validator for chart and status colors. Swatch sheets and Direction C mocks are in `shots/`; rebuild them with `node docs/palettes/build.mjs && node docs/palettes/shoot.mjs`.

|                                | Harbor                            | Graphite                                   | Ink                               |
| ------------------------------ | --------------------------------- | ------------------------------------------ | --------------------------------- |
| Idea                           | Deep slate ink, teal action color | Neutral graphite, deep indigo action color | Ink-black actions, emerald accent |
| Primary (light / dark)         | #0D6B67 / #3FC6B8                 | #4338CA / #8E92F7                          | #111815 / #E7EEEA                 |
| Accent                         | teal                              | indigo                                     | emerald                           |
| Feel                           | Calm, clinical, very readable     | Modern SaaS, crisp                         | Editorial, highest contrast       |
| Chart CVD worst (light / dark) | 17.5 / 14.7                       | 9.8 / 9.4                                  | 13.0 / 13.5                       |

## Results

- **All 33 required pairs pass in all 6 themes.** Text is at least 4.5:1; controls, focus ring and chart lines are at least 3:1.
- **Chart colors 1–5** pass the validator in both modes: lightness band, chroma floor, color-blind (CVD) separation ≥ 8, normal-vision ≥ 15, and ≥ 3:1 as lines on the surface.
- **Status colors are shared by all three palettes.** Statuses mean the same thing whichever palette is chosen:
  - light: success #2D8014, warning #774500, destructive #D74030, info #3A6FA3;
  - dark: #5FD37F, #EE921A, #F0555B, #88ABEA.
  - They were found by searching thousands of combinations for the best color-blind separation at text-level contrast. The worst pair is 7.5 in light mode and 8.5 in dark, and the icon and label are always present.
  - **Finding:** the old app's warning and destructive (#8A5A00 and #B42318) were indistinguishable with deuteranopia (ΔE 0.3).
- **New rule:** status _text_ sits only on a surface (StatusBadge always has one). Status icons and marks may touch the page background at 3:1.
- **Ink palette:** emerald is the _accent_, not the primary, so the brand color never competes with the success green.
- The chart-only lightness band and chroma notes in the status report don't apply to text colors. Two readings sit exactly at the chroma floor (0.099–0.1) because of rounding.
