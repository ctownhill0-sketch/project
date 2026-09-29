import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DataGrid, type GridColumn } from "@/components/data-grid/data-grid";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

interface Firm {
  id: string;
  name: string;
  score: number;
}

const columns: GridColumn<Firm>[] = [
  { id: "name", header: "Firm", width: 240, hideable: false, cell: (f) => f.name, sortValue: (f) => f.name },
  { id: "score", header: "Score", width: 80, align: "end", cell: (f) => f.score, sortValue: (f) => f.score },
];

const firms: Firm[] = [
  { id: "a", name: "Alder", score: 40 },
  { id: "b", name: "Birch", score: 90 },
  { id: "c", name: "Cedar", score: 65 },
];

function renderGrid(rows = firms, selectedId: string | null = "a") {
  return render(
    <DataGrid
      label="Leads"
      rows={rows}
      columns={columns}
      getRowId={(f) => f.id}
      selectedId={selectedId}
      hrefPrefix="/leads?lead="
      storageKey="test-grid"
    />,
  );
}

const bodyRowNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("gridcell")[0]?.textContent);

// jsdom has no layout; give the scroll container a size so the virtualizer renders a window.
const sizes = { offsetHeight: 600, offsetWidth: 1000 } as const;
const originals = new Map<string, PropertyDescriptor | undefined>();
beforeAll(() => {
  for (const [prop, value] of Object.entries(sizes)) {
    originals.set(prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop));
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => value });
  }
});
afterAll(() => {
  for (const [prop, desc] of originals) if (desc) Object.defineProperty(HTMLElement.prototype, prop, desc);
});

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  try {
    localStorage.clear();
  } catch {}
});

describe("DataGrid", () => {
  it("is a labelled grid with headers, a row count and the selected row marked", () => {
    renderGrid();
    const grid = screen.getByRole("grid", { name: "Leads" });
    expect(grid).toHaveAttribute("aria-rowcount", "4");
    expect(screen.getByRole("columnheader", { name: /Firm/ })).toBeInTheDocument();
    const selected = screen.getByRole("row", { selected: true });
    expect(selected).toHaveTextContent("Alder");
    expect(grid).toHaveAttribute("aria-activedescendant", selected.id);
  });

  it("renders only a window of rows for large lists", () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({ id: `f${i}`, name: `Firm ${i}`, score: i % 100 }));
    renderGrid(many, null);
    expect(screen.getByRole("grid")).toHaveAttribute("aria-rowcount", "5001");
    const rendered = screen.getAllByRole("row").length - 1;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(100);
  });

  it("moves with J/K and arrows, opens with Enter and a click", () => {
    renderGrid();
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "j" });
    expect(replace).toHaveBeenLastCalledWith("/leads?lead=b", { scroll: false });
    fireEvent.keyDown(grid, { key: "ArrowUp" });
    expect(replace).toHaveBeenLastCalledWith("/leads?lead=a", { scroll: false });
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith("/leads?lead=a", { scroll: false });
    fireEvent.click(screen.getByText("Cedar"));
    expect(push).toHaveBeenLastCalledWith("/leads?lead=c", { scroll: false });
  });

  it("sorts by a column header and J/K follow the sorted order", () => {
    renderGrid(firms, "c");
    const score = screen.getByRole("button", { name: /Score/ });
    fireEvent.click(score);
    const header = screen.getByRole("columnheader", { name: /Score/ });
    const direction = header.getAttribute("aria-sort");
    expect(["ascending", "descending"]).toContain(direction);
    const expected = direction === "ascending" ? ["Alder", "Cedar", "Birch"] : ["Birch", "Cedar", "Alder"];
    expect(bodyRowNames()).toEqual(expected);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "j" });
    // Cedar sits in the middle either way; J moves to the row after it in the sorted order.
    const next = direction === "ascending" ? "b" : "a";
    expect(replace).toHaveBeenLastCalledWith(`/leads?lead=${next}`, { scroll: false });
  });

  it("leaves hidden-by-default columns out until turned on", () => {
    render(
      <DataGrid
        label="Leads"
        rows={firms}
        columns={[
          ...columns,
          { id: "phone", header: "Phone", width: 120, hiddenByDefault: true, cell: () => "x" },
        ]}
        getRowId={(f) => f.id}
        selectedId={null}
        hrefPrefix="/leads?lead="
        storageKey="test-grid-hidden"
      />,
    );
    expect(screen.queryByRole("columnheader", { name: "Phone" })).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("switches density", () => {
    renderGrid();
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("data-density", "comfortable");
    fireEvent.click(screen.getByRole("button", { name: "Compact rows" }));
    expect(screen.getByRole("grid")).toHaveAttribute("data-density", "compact");
  });

  it("shows the empty state when there are no rows", () => {
    render(
      <DataGrid
        label="Leads"
        rows={[]}
        columns={columns}
        getRowId={(f) => f.id}
        selectedId={null}
        hrefPrefix="/leads?lead="
        storageKey="test-grid"
        empty={<p>No leads match.</p>}
      />,
    );
    expect(screen.getByText("No leads match.")).toBeInTheDocument();
  });
});

describe("DataGrid selection", () => {
  function renderSelectable() {
    const bulk = vi.fn();
    render(
      <DataGrid
        label="Places"
        rows={firms}
        columns={columns}
        getRowId={(f) => f.id}
        rowLabel={(f) => f.name}
        selectedId="a"
        hrefPrefix="/finder/results?place="
        storageKey="test-grid-select"
        bulkActions={(ids, clear) => (
          <button type="button" onClick={() => (bulk(ids), clear())}>
            Add {ids.length}
          </button>
        )}
      />,
    );
    return bulk;
  }

  it("selects rows with checkboxes and shows the bulk bar with a count", () => {
    const bulk = renderSelectable();
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Birch" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Cedar" }));
    const bar = screen.getByRole("toolbar", { name: "Bulk actions" });
    expect(bar).toHaveTextContent("2 selected");
    fireEvent.click(within(bar).getByRole("button", { name: "Add 2" }));
    expect(bulk).toHaveBeenCalledWith(["b", "c"]);
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).toBeNull();
  });

  it("selects all and clears", () => {
    renderSelectable();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toHaveTextContent("3 selected");
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).toBeNull();
  });

  it("toggles the current row with X", () => {
    renderSelectable();
    fireEvent.keyDown(screen.getByRole("grid"), { key: "x" });
    expect(screen.getByRole("checkbox", { name: "Select Alder" })).toBeChecked();
    expect(push).not.toHaveBeenCalled();
  });

  it("clicking a checkbox doesn't open the row", () => {
    renderSelectable();
    push.mockClear();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Cedar" }));
    expect(push).not.toHaveBeenCalled();
  });
});
