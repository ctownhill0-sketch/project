"use client";

import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { bulkStatusAction } from "@/app/(app)/leads/actions";
import { DataGrid, type GridColumn } from "@/components/data-grid/data-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/states/status-badge";
import { formatMinutes, softwareLabel } from "@/lib/domain/scoring";
import { formatPhone } from "@/lib/format";
import type { LeadRow } from "@/lib/queries/leads";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  researching: "Researching",
  ready: "Ready to call",
  contacted: "Contacted",
  excluded: "Excluded",
  archived: "Archived",
};

const unknown = <span className="text-muted-foreground">unknown</span>;

function reply(l: LeadRow) {
  if (l.shopCount === 0) return <span className="text-muted-foreground">Not shopped</span>;
  if (l.shopNoReply) return "No reply";
  return l.shopMedianMinutes === null ? unknown : formatMinutes(l.shopMedianMinutes);
}

const COLUMNS: GridColumn<LeadRow>[] = [
  { id: "name", header: "Firm", width: 212, hideable: false, cell: (l) => l.name, sortValue: (l) => l.name },
  {
    id: "town",
    header: "Town",
    width: 140,
    cell: (l) => [l.city, l.state].filter(Boolean).join(", ") || unknown,
    sortValue: (l) => l.city,
  },
  { id: "score", header: "Score", width: 76, align: "end", cell: (l) => l.score, sortValue: (l) => l.score },
  {
    id: "software",
    header: "Software",
    width: 128,
    cell: (l) => softwareLabel(l.software),
    sortValue: (l) => softwareLabel(l.software),
  },
  {
    id: "reply",
    header: "First reply",
    width: 124,
    align: "end",
    cell: reply,
    // No reply sorts as slowest; not shopped sorts last.
    sortValue: (l) =>
      l.shopCount === 0 ? null : l.shopNoReply ? Number.MAX_SAFE_INTEGER : l.shopMedianMinutes,
  },
  {
    id: "listings",
    header: "Listings",
    hiddenByDefault: true,
    width: 96,
    align: "end",
    cell: (l) => l.listings ?? unknown,
    sortValue: (l) => l.listings,
  },
  {
    id: "units",
    header: "Units",
    hiddenByDefault: true,
    width: 88,
    align: "end",
    cell: (l) => l.units ?? unknown,
    sortValue: (l) => l.units,
  },
  {
    id: "status",
    header: "Status",
    hiddenByDefault: true,
    width: 140,
    cell: (l) =>
      l.dnc ? (
        <StatusBadge status="do_not_call" />
      ) : l.status === "excluded" ? (
        <StatusBadge status="excluded" />
      ) : (
        (STATUS_LABEL[l.status] ?? l.status)
      ),
    sortValue: (l) => STATUS_LABEL[l.status] ?? l.status,
  },
  {
    id: "phone",
    header: "Phone",
    width: 150,
    hiddenByDefault: true,
    cell: (l) => (l.phone ? formatPhone(l.phone) : unknown),
  },
];

export function LeadsGrid({
  rows,
  selectedId,
  hrefPrefix,
  summary,
}: {
  rows: LeadRow[];
  selectedId: string | null;
  hrefPrefix: string;
  summary: ReactNode;
}) {
  const [pending, start] = useTransition();
  const setStatus = (ids: string[], clear: () => void, status: "researching" | "ready" | "archived") =>
    start(async () => {
      const res = await bulkStatusAction(ids, status);
      if (!res.ok) return void toast.error(res.error);
      const skipped = ids.length - res.data.updated;
      toast.success(
        `Updated ${res.data.updated}${skipped ? ` (${skipped} excluded or do-not-call left as they are)` : ""}`,
      );
      clear();
    });
  const exportSelected = (ids: string[]) => {
    const picked = rows.filter((r) => ids.includes(r.id));
    const csv = toCsv(
      ["Firm", "Town", "State", "Phone", "Score", "Software", "Status", "Why this lead"],
      picked.map((l) => [
        l.name,
        l.city,
        l.state,
        l.phone,
        l.score,
        softwareLabel(l.software),
        STATUS_LABEL[l.status] ?? l.status,
        l.why,
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-selected.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <DataGrid
      rowLabel={(l) => l.name}
      bulkActions={(ids, clear) => (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setStatus(ids, clear, "researching")}
          >
            Researching
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setStatus(ids, clear, "ready")}
          >
            Ready to call
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setStatus(ids, clear, "archived")}
          >
            Archive
          </Button>
          <Link
            href={`/shops/plan?ids=${ids.slice(0, 50).join(",")}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Plan mystery shops
          </Link>
          <Button size="sm" variant="ghost" onClick={() => exportSelected(ids)}>
            Export CSV
          </Button>
        </>
      )}
      label="Leads"
      rows={rows}
      columns={COLUMNS}
      getRowId={(l) => l.id}
      selectedId={selectedId}
      hrefPrefix={hrefPrefix}
      storageKey="leads-grid"
      summary={summary}
      empty={<p className="text-muted-foreground">No leads match these filters.</p>}
    />
  );
}
