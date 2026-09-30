import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { createAuditAction } from "@/app/(app)/audits/actions";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { navLabel } from "@/components/shell/nav-items";
import { EmptyState } from "@/components/states/empty-state";
import { StatusBadge } from "@/components/states/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listAudits } from "@/lib/audits/service";
import { requireUser } from "@/lib/auth/require-user";
import { checkStatus } from "@/lib/compliance/labels";
import { getDb } from "@/lib/db";
import { company, mysteryShop } from "@/lib/db/schema";

export const metadata: Metadata = { title: navLabel("/audits") };

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(
    d,
  );

export default async function AuditsPage({ searchParams }: PageProps<"/audits">) {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const params = await searchParams;
  const preset = typeof params.lead === "string" ? params.lead : undefined;
  const [audits, shopped] = await Promise.all([
    listAudits(db, workspaceId),
    // Firms that have been shopped, never do-not-call: an audit is sent to the firm.
    db
      .selectDistinct({ id: company.id, name: company.name })
      .from(company)
      .innerJoin(mysteryShop, eq(mysteryShop.companyId, company.id))
      .where(
        and(eq(company.workspaceId, workspaceId), eq(company.dncFlag, false), isNull(company.mergedIntoId)),
      )
      .orderBy(asc(company.name)),
  ]);
  const exported = audits.filter((a) => a.pdfGeneratedAt).length;
  const now = new Date();
  const thisWeek = audits.filter(
    (a) => a.pdfGeneratedAt && now.getTime() - a.pdfGeneratedAt.getTime() < 7 * 86_400_000,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vacancy audits"
        context="A one-page PDF: the firm's reply times against the metro, what a renter experienced, and what slow replies cost."
        numbers={[
          { label: "Audits", value: <Num value={audits.length} /> },
          { label: "Exported", value: <Num value={exported} /> },
          { label: "Exported this week", value: <Num value={thisWeek} /> },
        ]}
      />

      <section
        aria-labelledby="new-audit"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
      >
        <h2 id="new-audit" className="font-semibold">
          Start an audit
        </h2>
        {shopped.length === 0 ? (
          <p className="text-muted-foreground">
            Audits need mystery-shop results.{" "}
            <Link href="/shops/plan" className="text-link underline underline-offset-2">
              Plan mystery shops
            </Link>{" "}
            first.
          </p>
        ) : (
          <form action={createAuditAction} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="audit-firm">Firm (shopped firms only)</Label>
              <select
                id="audit-firm"
                name="companyId"
                defaultValue={shopped.some((f) => f.id === preset) ? preset : undefined}
                className="border-input bg-card h-9 max-w-full rounded-lg border px-3"
              >
                {shopped.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="lg">
              Start audit
            </Button>
          </form>
        )}
      </section>

      <section aria-labelledby="all-audits" className="flex flex-col gap-3">
        <h2 id="all-audits" className="font-semibold">
          All audits
        </h2>
        {audits.length === 0 ? (
          <EmptyState
            title="No audits yet"
            sentence="Pick a shopped firm above to start one."
            action={{ label: "Start an audit", href: "#new-audit" }}
          />
        ) : (
          <ul className="border-border bg-card divide-border divide-y rounded-xl border">
            {audits.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/audits/${a.id}`} className="font-medium underline-offset-2 hover:underline">
                    {a.firmName}
                  </Link>
                  <span className="text-small text-muted-foreground">
                    Started {day(a.createdAt)}
                    {a.pdfGeneratedAt
                      ? ` · PDF exported ${day(a.pdfGeneratedAt)}`
                      : a.summary
                        ? " · Draft"
                        : " · No summary yet"}
                  </span>
                </div>
                {a.checkOutcome ? (
                  <StatusBadge
                    status={checkStatus({ outcome: a.checkOutcome, overrideReason: a.overrideReason })}
                  />
                ) : (
                  <span className="text-small text-muted-foreground">Not checked yet</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
