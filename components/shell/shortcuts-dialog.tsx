"use client";

import { GO_KEYS } from "@/lib/hotkeys";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

const ROWS: [string[], string][] = [
  [["⌘", "K"], "Command menu: jump to a lead, page or action"],
  [["/"], "Search leads"],
  [["J"], "Next record"],
  [["K"], "Previous record"],
  [["Enter"], "Open the selected record"],
  [["E"], "Edit the selected record"],
  ...Object.entries(GO_KEYS).map(([key, v]): [string[], string] => [
    ["G", key.toUpperCase()],
    `Go to ${v.label}`,
  ]),
  [["?"], "Show this list"],
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts pause while you type in a field. ⌘K always works.</DialogDescription>
        </DialogHeader>
        <table className="w-full">
          <caption className="sr-only">Keyboard shortcuts</caption>
          <tbody>
            {ROWS.map(([keys, action]) => (
              <tr key={action} className="border-border border-b last:border-0">
                <td className="py-2 pr-4 whitespace-nowrap">
                  <span className="inline-flex gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </td>
                <td className="py-2">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
