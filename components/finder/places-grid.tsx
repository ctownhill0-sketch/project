"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { bulkTriageAction } from "@/app/(app)/finder/actions";
import { DataGrid, type GridColumn } from "@/components/data-grid/data-grid";
import { StatusBadge } from "@/components/states/status-badge";
import { Button } from "@/components/ui/button";
import { softwareLabel, type Software } from "@/lib/domain/scoring";
import { toCsv } from "@/lib/csv";
import type { PlaceRowView } from "@/lib/queries/finder";

const unknown = <span className="text-muted-foreground">unknown</span>;
const TRIAGE: Record<PlaceRowView["triageStatus"], string> = {
  pending: "Pending",
  added: "Added",
  skipped: "Skipped",
  not_a_fit: "Not a fit",
  dnc: "Do not call",
};

function status(p: PlaceRowView) {
  if (p.dedupeStatus === "dnc" || p.triageStatus === "dnc") return <StatusBadge status="do_not_call" />;
  if (p.fitStatus === "excluded") return <StatusBadge status="excluded" />;
  if (p.fitStatus === "not_a_fit" && p.triageStatus === "pending") return "Not a fit?";
  if (p.dedupeStatus === "duplicate") return "Duplicate";
  if (p.dedupeStatus === "possible_duplicate" && p.triageStatus === "pending") return "Possible duplicate";
  return TRIAGE[p.triageStatus];
}

const COLUMNS: GridColumn<PlaceRowView>[] = [
  { id: "name", header: "Firm", width: 220, hideable: false, cell: (p) => p.name, sortValue: (p) => p.name },
  { id: "town", header: "Town", width: 130, cell: (p) => p.town ?? unknown, sortValue: (p) => p.town },
  { id: "score", header: "Score", width: 76, align: "end", cell: (p) => p.score, sortValue: (p) => p.score },
  {
    id: "software",
    header: "Software",
    width: 130,
    cell: (p) =>
      p.software
        ? softwareLabel(p.software as Software)
        : p.enrichmentStatus === "none"
          ? "Not checked"
          : unknown,
    sortValue: (p) => p.software,
  },
  { id: "status", header: "Status", width: 150, cell: status, sortValue: (p) => p.triageStatus },
  {
    id: "units",
    header: "Units",
    width: 84,
    align: "end",
    hiddenByDefault: true,
    cell: (p) => p.units ?? unknown,
    sortValue: (p) => p.units,
  },
  {
    id: "listings",
    header: "Listings",
    width: 90,
    align: "end",
    hiddenByDefault: true,
    cell: (p) => p.listings ?? unknown,
    sortValue: (p) => p.listings,
  },
];

function download(rows: PlaceRowView[]) {
  const csv = toCsv(
    [
      "Firm",
      "Town",
      "State",
      "Score",
      "Software",
      "Units (estimated)",
      "Listings (estimated)",
      "Website",
      "Why",
      "Status",
    ],
    rows.map((p) => [
      p.name,
      p.town,
      p.state,
      p.score,
      p.software,
      p.units,
      p.listings,
      p.websiteUri,
      p.why,
      TRIAGE[p.triageStatus],
    ]),
  );
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "finder-results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PlacesGrid({
  rows,
  selectedId,
  hrefPrefix,
}: {
  rows: PlaceRowView[];
  selectedId: string | null;
  hrefPrefix: string;
}) {
  const [pending, start] = useTransition();
  const bulk = (ids: string[], clear: () => void, decision: "add" | "not_a_fit") =>
    start(async () => {
      const res = await bulkTriageAction(ids, decision);
      if (!res.ok) return void toast.error(res.error);
      const verb = decision === "add" ? "Added" : "Marked not a fit:";
      toast.success(
        `${verb} ${res.data.done}${res.data.skipped ? `, skipped ${res.data.skipped} (${res.data.reasons.join("; ")})` : ""}`,
      );
      clear();
    });
  return (
    <DataGrid
      label="Places"
      rows={rows}
      columns={COLUMNS}
      getRowId={(p) => p.id}
      rowLabel={(p) => p.name}
      selectedId={selectedId}
      hrefPrefix={hrefPrefix}
      storageKey="finder-grid"
      summary={<span>{rows.length} places</span>}
      empty={<p className="text-muted-foreground">No places match this filter.</p>}
      bulkActions={(ids, clear) => (
        <>
          <Button size="sm" disabled={pending} onClick={() => bulk(ids, clear, "add")}>
            Add to leads
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => bulk(ids, clear, "not_a_fit")}
          >
            Not a fit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => download(rows.filter((r) => ids.includes(r.id)))}
          >
            Export CSV
          </Button>
        </>
      )}
    />
  );
}
