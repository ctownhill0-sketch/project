import { renderAuditPdf } from "@/lib/audits/pdf";
import { exportAudit } from "@/lib/audits/service";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/queries/settings";

export async function GET(_request: Request, ctx: RouteContext<"/audits/[id]/pdf">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Audit not found.", { status: 404 });
  const db = await getDb();
  const now = new Date();
  let released;
  try {
    released = await exportAudit(db, user, id, now);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Can't export this audit.", { status: 409 });
  }
  const { wordmark: brand } = await getSetting(db, user.workspaceId, "brand", { wordmark: "Vacancy Desk" });
  const bytes = await renderAuditPdf({
    brand,
    snapshot: released.snapshot,
    summary: released.summary,
    exportedAt: now,
  });
  const slug =
    released.firmName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "firm";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vacancy-audit-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
