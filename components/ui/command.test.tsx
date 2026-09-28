import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Command, CommandDialog, CommandInput, CommandList } from "@/components/ui/command";

// Regression guard for a local fix: shadcn renders the title outside the dialog,
// leaving it unnamed. `pnpm ui:add command` must not undo this.
describe("CommandDialog", () => {
  it("is a dialog named by its title", async () => {
    render(
      <CommandDialog open title="Command menu" description="Jump anywhere">
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList />
        </Command>
      </CommandDialog>,
    );
    expect(await screen.findByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
  });
});
