import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavList } from "@/components/shell/nav-list";
import { NAV_ITEMS } from "@/components/shell/nav-items";

vi.mock("next/navigation", () => ({ usePathname: () => "/shops" }));

describe("NavList", () => {
  it("lists every Free Build module in order", () => {
    render(<NavList items={NAV_ITEMS} />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Dashboard",
      "Lead finder",
      "Leads",
      "Mystery shops",
      "Calls",
      "Pipeline",
      "ROI",
      "Audits",
      "Pilots",
      "Settings",
      "Design system",
    ]);
  });

  it("marks only the current page with aria-current", () => {
    render(<NavList items={NAV_ITEMS} />);
    expect(screen.getByRole("link", { name: "Mystery shops" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Leads" })).not.toHaveAttribute("aria-current");
  });

  it("gives every link a decorative icon and a visible text label", () => {
    const { container } = render(<NavList items={NAV_ITEMS} />);
    expect(container.querySelectorAll("a svg[aria-hidden='true'][data-icon]")).toHaveLength(NAV_ITEMS.length);
  });
});

describe("NavList bar layout", () => {
  it("uses short labels where space is tight, keeping the full name elsewhere", () => {
    render(<NavList items={NAV_ITEMS.filter((i) => i.onPhoneBar)} layout="bar" />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Dashboard", "Shops", "Calls"]);
  });
});

describe("NavList grouped", () => {
  it("shows the Find, Sell and Prove groups with headings", () => {
    render(<NavList items={NAV_ITEMS} grouped />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Find",
      "Sell",
      "Prove",
      "Setup",
    ]);
    expect(screen.getAllByRole("link")).toHaveLength(NAV_ITEMS.length);
  });

  it("can show a count next to an item", () => {
    render(<NavList items={NAV_ITEMS} grouped counts={{ "/leads": 412 }} />);
    expect(screen.getByRole("link", { name: /Leads/ })).toHaveTextContent("412");
  });
});
