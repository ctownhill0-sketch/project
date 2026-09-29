import { withAudit } from "@/lib/audit/audit";
import { requireUser } from "@/lib/auth/require-user";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { softwareLabel } from "@/lib/domain/scoring";
import { parseLeadFilters } from "@/lib/queries/lead-filters";
import { listLeads } from "@/lib/queries/leads";

/** CSV of the leads matching the current filters (same URL params as /leads). Logged as an export. */
export async function GET(request: Request) {
  const user = await requireUser();
  const db = await getDb();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseLeadFilters(params);
  const rows = await listLeads(db, user.workspaceId, filters);
  const csv = toCsv(
    [
      "Firm",
      "Town",
      "State",
      "Phone",
      "Score",
      "Software",
      "Units (estimated)",
      "Listings (estimated)",
      "Status",
      "Do not call",
      "Why this lead",
    ],
    rows.map((l) => [
      l.name,
      l.city,
      l.state,
      l.phone,
      l.score,
      softwareLabel(l.software),
      l.units,
      l.listings,
      l.status,
      l.dnc ? "yes" : "no",
      l.why,
    ]),
  );
  await withAudit(db, user, { action: "export", entity: "company" }, async () => ({
    result: null,
    after: { rows: rows.length, filters },
  }));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
