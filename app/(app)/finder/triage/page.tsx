import type { Metadata } from "next";
import Link from "next/link";
import { PlacePanel } from "@/components/finder/place-panel";
import { TriageView } from "@/components/finder/triage-view";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { purgeExpiredGoogleContent } from "@/lib/finder/service";
import { placeCounts, placeDetail, triageQueue } from "@/lib/queries/finder";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Triage" };

export default async function TriagePage({ searchParams }: PageProps<"/finder/triage">) {
  const user = await requireUser();
  const { workspaceId } = user;
  const db = await getDb();
  await purgeExpiredGoogleContent(db, user, new Date());
  const params = await searchParams;
  const runId = typeof params.run === "string" && /^[0-9a-f-]{36}$/.test(params.run) ? params.run : null;
  const requested = typeof params.place === "string" ? params.place : null;
  const [queue, counts] = await Promise.all([
    triageQueue(db, workspaceId, runId),
    placeCounts(db, workspaceId, runId),
  ]);
  const decided = counts.all - counts.pending; // places that already have a decision
  const total = decided + queue.length;
  const currentId = requested ?? queue[0]?.id ?? null;
  const detail = currentId ? await placeDetail(db, workspaceId, currentId) : null;
  const baseHref = `/finder/triage?${runId ? `run=${runId}` : "all=1"}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Triage"
        context={
          runId
            ? "One place at a time from this search, best score first."
            : "One place at a time from every search, best score first."
        }
        numbers={[
          { label: "Left to triage", value: <Num value={queue.length} /> },
          { label: "Added", value: <Num value={counts.added} /> },
          { label: "Not a fit", value: <Num value={counts.not_a_fit} /> },
        ]}
        action={
          <Link
            href={runId ? `/finder/results?run=${runId}` : "/finder/results"}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Table view
          </Link>
        }
      />
      {!detail ? (
        <EmptyState
          title="All triaged"
          sentence="Every place from this search has a decision. New leads are waiting in Leads."
          action={{ label: "Open leads", href: "/leads?status=new" }}
        />
      ) : (
        <TriageView
          key={detail.place.id}
          placeId={detail.place.id}
          name={detail.name}
          websiteUri={detail.place.websiteUri}
          position={Math.min(decided + 1, total)}
          total={total}
          baseHref={baseHref}
          canAdd={
            detail.place.triageStatus === "pending" &&
            detail.place.dedupeStatus !== "dnc" &&
            detail.place.dedupeStatus !== "duplicate"
          }
        >
          <PlacePanel detail={detail} />
        </TriageView>
      )}
    </div>
  );
}
