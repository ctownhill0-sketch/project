"use client";

import { GO_KEYS } from "@/lib/hotkeys";
import { DISPOSITIONS } from "@/lib/domain/calls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

type Row = [string[], string];

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Everywhere",
    rows: [
      [["⌘", "K"], "Command menu: jump to a lead, page or action"],
      [["/"], "Search leads"],
      [["J"], "Next record"],
      [["K"], "Previous record"],
      [["Enter"], "Open the selected record"],
      [["E"], "Edit the selected record"],
      [["X"], "Select or clear the current row"],
      ...Object.entries(GO_KEYS).map(([key, v]): Row => [["G", key.toUpperCase()], `Go to ${v.label}`]),
      [["?"], "Show this list"],
    ],
  },
  {
    title: "Call workspace",
    rows: [
      ...DISPOSITIONS.map((d): Row => [
        [d.key],
        d.value === "do_not_call" ? "Do not call (press twice to confirm)" : d.label,
      ]),
      [["Esc"], "Leave call-block mode"],
    ],
  },
  {
    title: "Finder triage",
    rows: [
      [["A"], "Add as a lead"],
      [["S"], "Skip"],
      [["N"], "Not a fit"],
      [["D"], "Do not call (press twice to confirm)"],
      [["O"], "Open the firm's website"],
      [["U"], "Undo the last decision"],
    ],
  },
  {
    title: "Pilot daily entry",
    rows: [
      [["Tab"], "Next number"],
      [["↑", "↓"], "Move up or down a column"],
      [["Enter"], "Save the day"],
    ],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts pause while you type in a field. ⌘K always works.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => (
            <table key={group.title} className="w-full">
              <caption className="text-small pb-1 text-left font-semibold">{group.title}</caption>
              <tbody>
                {group.rows.map(([keys, action]) => (
                  <tr key={`${keys.join("+")}-${action}`} className="border-border border-b last:border-0">
                    <td className="py-1.5 pr-4 whitespace-nowrap">
                      <span className="inline-flex gap-1">
                        {keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    </td>
                    <td className="py-1.5">{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
