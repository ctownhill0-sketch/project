import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

// Regression guard: `pnpm ui:add table --overwrite` would drop this local change.
describe("Table", () => {
  it("wraps the table in a focusable, labelled scroll region (axe scrollable-region-focusable)", () => {
    render(
      <Table aria-label="Leads">
        <TableBody>
          <TableRow>
            <TableCell>Harborline</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const region = screen.getByRole("region", { name: "Leads" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table", { name: "Leads" })).toBeInTheDocument();
  });
});
