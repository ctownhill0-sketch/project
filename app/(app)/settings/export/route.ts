import { withAudit } from "@/lib/audit/audit";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { exportWorkspace } from "@/lib/settings/export";

/** Every workspace table as one JSON file. Logged as an export. */
export async function GET() {
  const user = await requireUser();
  const db = await getDb();
  const now = new Date();
  const data = await exportWorkspace(db, user.workspaceId, now);
  await withAudit(db, user, { action: "export", entity: "workspace" }, async () => ({
    result: null,
    after: { tables: Object.keys(data.tables).length, format: "json" },
  }));
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="vacancy-desk-export-${now.toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
