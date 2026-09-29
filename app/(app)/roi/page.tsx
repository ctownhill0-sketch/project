import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { RoiCalculator } from "@/components/roi/roi-calculator";
import { navLabel } from "@/components/shell/nav-items";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { company } from "@/lib/db/schema";
import { parseRoiQuery } from "@/lib/domain/roi";

export const metadata: Metadata = { title: navLabel("/roi") };

export default async function RoiPage({ searchParams }: PageProps<"/roi">) {
  const { workspaceId } = await requireUser();
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  const inputs = parseRoiQuery(query);
  const present = params.present === "1";
  const leadId = typeof params.lead === "string" && /^[0-9a-f-]{36}$/.test(params.lead) ? params.lead : null;
  const [lead] = leadId
    ? await (
        await getDb()
      )
        .select({ id: company.id, name: company.name })
        .from(company)
        .where(and(eq(company.id, leadId), eq(company.workspaceId, workspaceId)))
    : [];
  return (
    <div className="flex flex-col gap-6">
      {present ? null : (
        <PageHeader
          title="ROI calculator"
          context="What an empty unit costs, and what leasing a week faster is worth. Rent × 12 ÷ 365 per vacant day."
        />
      )}
      <RoiCalculator initial={inputs} present={present} lead={lead ?? null} />
    </div>
  );
}
