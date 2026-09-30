import { withAudit } from "@/lib/audit/audit";
import { requireUser } from "@/lib/auth/require-user";
import { getDb, getDbHandle } from "@/lib/db";
import { canBackUpWholeDatabase } from "@/lib/settings/export";

/** A restorable copy of the whole local database (PGlite data directory, gzip tarball). */
export async function GET() {
  const user = await requireUser();
  const handle = await getDbHandle();
  if (!handle.backup)
    return new Response("Backups are made by the database host on this setup.", { status: 501 });
  // The file holds the whole database, so it's only offered while this is the only workspace.
  if (!(await canBackUpWholeDatabase(await getDb())))
    return new Response("This database holds more than one workspace. Use Export all data instead.", {
      status: 403,
    });
  const blob = await handle.backup();
  const now = new Date();
  await withAudit(await getDb(), user, { action: "export", entity: "workspace" }, async () => ({
    result: null,
    after: { format: "pglite-backup", bytes: blob.size },
  }));
  return new Response(blob, {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="vacancy-desk-backup-${now.toISOString().slice(0, 10)}.tar.gz"`,
      "cache-control": "no-store",
    },
  });
}
