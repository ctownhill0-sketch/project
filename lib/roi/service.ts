// Saved ROI scenarios (brief M9): one firm's numbers, quoted later in call prep.
import { and, eq } from "drizzle-orm";
import { withAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { company, roiScenario } from "@/lib/db/schema";
import { parseRoiQuery, roi } from "@/lib/domain/roi";

export async function saveRoiScenario(db: Db, ctx: AuditContext, companyId: string, query: string) {
  const inputs = parseRoiQuery(new URLSearchParams(query));
  const results = roi(inputs);
  const [firm] = await db
    .select({ id: company.id, name: company.name })
    .from(company)
    .where(and(eq(company.id, companyId), eq(company.workspaceId, ctx.workspaceId)));
  if (!firm) throw new Error("Lead not found.");
  await withAudit(db, ctx, { action: "create", entity: "roi_scenario" }, async (tx) => {
    const [row] = await tx
      .insert(roiScenario)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        companyId: firm.id,
        name: `ROI for ${firm.name}`,
        inputs: { ...inputs },
        // "Never pays back" is stored as a missing key, not a fake number.
        results: Object.fromEntries(
          Object.entries(results).filter((e): e is [string, number] => typeof e[1] === "number"),
        ),
      })
      .returning();
    return { result: row!.id, entityId: row!.id, after: { inputs } };
  });
  return { name: firm.name };
}
