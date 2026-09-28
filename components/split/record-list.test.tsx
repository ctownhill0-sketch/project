import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecordList } from "@/components/split/record-list";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

const items = ["a", "b", "c"].map((id) => ({ id, title: `Firm ${id.toUpperCase()}` }));

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
});

describe("RecordList", () => {
  it("is a labelled listbox with the selected option marked", () => {
    render(<RecordList items={items} selectedId="b" hrefPrefix="/leads?lead=" label="Leads" />);
    const list = screen.getByRole("listbox", { name: "Leads" });
    expect(screen.getByRole("option", { name: "Firm B" })).toHaveAttribute("aria-selected", "true");
    expect(list).toHaveAttribute("aria-activedescendant", "record-b");
  });

  it("moves with J/K and arrows, and stays in bounds", () => {
    render(<RecordList items={items} selectedId="b" hrefPrefix="/leads?lead=" label="Leads" />);
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "j" });
    expect(replace).toHaveBeenLastCalledWith("/leads?lead=c", { scroll: false });
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(replace).toHaveBeenLastCalledWith("/leads?lead=a", { scroll: false });
  });

  it("clamps at the ends and opens with Enter or a click", () => {
    render(<RecordList items={items} selectedId="c" hrefPrefix="/leads?lead=" label="Leads" />);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(replace).toHaveBeenLastCalledWith("/leads?lead=c", { scroll: false });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith("/leads?lead=c", { scroll: false });
    fireEvent.click(screen.getByRole("option", { name: "Firm A" }));
    expect(push).toHaveBeenLastCalledWith("/leads?lead=a", { scroll: false });
  });
});
