import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShortcutsDialog } from "@/components/shell/shortcuts-dialog";

describe("ShortcutsDialog", () => {
  it("lists global, call-workspace, triage and pilot-entry keys in labeled tables", () => {
    render(<ShortcutsDialog open onOpenChange={() => {}} />);
    const everywhere = screen.getByRole("table", { name: "Everywhere" });
    expect(within(everywhere).getByText("Command menu: jump to a lead, page or action")).toBeTruthy();
    const calls = screen.getByRole("table", { name: "Call workspace" });
    expect(within(calls).getByText("No answer")).toBeTruthy();
    expect(within(calls).getByText("Do not call (press twice to confirm)")).toBeTruthy();
    expect(within(calls).getByText("Leave call-block mode")).toBeTruthy();
    const triage = screen.getByRole("table", { name: "Finder triage" });
    expect(within(triage).getByText("Undo the last decision")).toBeTruthy();
    const pilots = screen.getByRole("table", { name: "Pilot daily entry" });
    expect(within(pilots).getByText("Move up or down a column")).toBeTruthy();
  });
});
