import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditEditor } from "@/components/audits/audit-editor";
import { AuditPreview } from "@/components/audits/audit-preview";
import { PageHeader } from "@/components/page-header";
import { getAudit } from "@/lib/audits/service";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import type { Match } from "@/lib/domain/fair-housing";
import { getSetting } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Vacancy audit" };

export default async function AuditPage({ params }: PageProps<"/audits/[id]">) {
  const { workspaceId } = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const audit = await getAudit(db, workspaceId, id).catch(() => null);
  if (!audit) notFound();
  const { wordmark: brand } = await getSetting(db, workspaceId, "brand", { wordmark: "Vacancy Desk" });
  const s = audit.snapshot;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Audit: ${s.firmName}`}
        context="Write three sentences, then check and export. Numbers must match the data, and the page must pass the fair-housing check."
        action={
          <Link href="/audits" className="text-link text-small underline underline-offset-2">
            All audits
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <AuditPreview snapshot={s} summary={audit.summary ?? ""} brand={brand} />
        </div>
        <aside
          aria-label="Summary and export"
          className="border-border bg-card flex h-fit flex-col gap-3 rounded-xl border p-5"
        >
          <AuditEditor
            id={audit.id}
            snapshot={s}
            initialSummary={audit.summary ?? ""}
            initialCheck={
              audit.check
                ? {
                    id: audit.check.id,
                    outcome: audit.check.outcome,
                    matches: audit.check.matches as Match[],
                    overrideReason: audit.check.overrideReason,
                  }
                : null
            }
          />
        </aside>
      </div>
    </div>
  );
}
