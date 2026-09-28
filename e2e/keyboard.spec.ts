import { expect, test } from "@playwright/test";

test("keyboard-only: every focus stop shows a visible outline that is not covered", async ({ page }) => {
  await page.goto("/design");
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        outlineWidth: Number.parseFloat(s.outlineWidth),
        outlineStyle: s.outlineStyle,
        // Next's dev-tools badge only exists under `pnpm dev`, never in the real app.
        covered:
          topEl !== null &&
          topEl.tagName !== "NEXTJS-PORTAL" &&
          topEl !== el &&
          !el.contains(topEl) &&
          !topEl.contains(el),
        inView: r.bottom > 0 && r.top < window.innerHeight,
      };
    });
    if (!info || !info.inView) continue;
    expect(info.outlineStyle).not.toBe("none");
    expect(info.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(info.covered).toBe(false);
  }
});
