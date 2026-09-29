import type { Metadata } from "next";
import Link from "next/link";
import { SoftwareOverrideForm } from "@/components/leads/lead-actions";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { softwareLabel, type Software } from "@/lib/domain/scoring";
import { softwareReviewQueue } from "@/lib/leads/manage";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Software review" };

export default async function SoftwareReviewPage() {
  const { workspaceId } = await requireUser();
  const queue = await softwareReviewQueue(await getDb(), workspaceId);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Software review"
        context="Firms where the website check was unsure, or never ran. Open the portal link, then set the software yourself."
        numbers={[{ label: "To review", value: <Num value={queue.length} /> }]}
        action={
          <Link href="/leads" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Back to leads
          </Link>
        }
      />
      {queue.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          sentence="Every lead's software is known or set by you."
          action={{ label: "Open leads", href: "/leads" }}
        />
      ) : (
        <ul className="border-border bg-card divide-border divide-y rounded-xl border">
          {queue.map((firm) => (
            <li key={firm.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/leads?lead=${firm.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {firm.name}
                </Link>
                <span className="text-small text-muted-foreground">
                  Detected: {softwareLabel(firm.detectedSoftware as Software)}
                  {firm.softwareConfidence ? ` (${firm.softwareConfidence} confidence)` : ""}
                </span>
              </div>
              {firm.softwareEvidence ? (
                <p className="text-caption text-muted-foreground break-all">{firm.softwareEvidence}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                {firm.websiteUrl ? (
                  <a
                    href={firm.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link text-small underline underline-offset-2"
                  >
                    Check portal
                    <span className="sr-only"> for {firm.name} (opens in a new tab)</span>
                  </a>
                ) : null}
                <SoftwareOverrideForm companyId={firm.id} current={firm.softwareOverride} compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
