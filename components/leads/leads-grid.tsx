"use client";

import type { ReactNode } from "react";
import { DataGrid, type GridColumn } from "@/components/data-grid/data-grid";
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
  return (
    <DataGrid
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
