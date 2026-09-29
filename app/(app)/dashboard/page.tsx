import type { Metadata } from "next";
import Link from "next/link";
import { KillTest } from "@/components/dashboard/kill-test";
import { MrrChart, type MrrPoint } from "@/components/dashboard/mrr-chart";
import { NextUp } from "@/components/dashboard/next-up";
import { Icons } from "@/components/icons";
import { LeadPanel } from "@/components/leads/lead-panel";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { navLabel } from "@/components/shell/nav-items";
import { RecordList } from "@/components/split/record-list";
import { SplitView } from "@/components/split/split-view";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { getDashboard } from "@/lib/queries/dashboard";
import { getLeadDetail } from "@/lib/queries/leads";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: navLabel("/dashboard") };

const KIND_BADGE = { callback: "Callback", reply_check: "Reply check", top_score: "Top score" } as const;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const now = new Date();
  const d = await getDashboard(db, workspaceId, now);
  const params = await searchParams;
  const requested = typeof params.lead === "string" ? params.lead : null;
  const selectedId = requested ?? d.today.items[0]?.companyId ?? null;
  const lead = selectedId ? await getLeadDetail(db, workspaceId, selectedId, now) : null;

  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(now);
  const below = d.wow === null || d.wow < 0.07;
  const chart: MrrPoint[] = [
    ...d.mrrSeries.map((p) => ({ weekStart: p.weekStart, mrr: p.mrr })),
    ...d.projection.slice(1).map((p) => ({ weekStart: p.weekStart, projection: p.mrr })),
  ];
  const joinAt = chart.findIndex((p) => p.weekStart === d.projection[0]?.weekStart);
  if (joinAt >= 0 && d.projection[0]) chart[joinAt] = { ...chart[joinAt]!, projection: d.projection[0].mrr };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        context={`${date}. Call blocks run Tue–Thu, 9:00–11:30.`}
        numbers={[
          {
            label: "MRR",
            value:
              d.mrr === null ? (
                <span className="text-muted-foreground">unknown</span>
              ) : (
                <Num value={d.mrr} format="money" />
              ),
            note: below ? (
              <span className="text-destructive-text inline-flex items-center gap-1">
                <Icons.down className="size-3.5" />
                Below 7% target
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Icons.up className="text-success size-3.5" />
                On 7% target
              </span>
            ),
          },
          {
            label: "Week over week",
            value: <Num value={d.wow} format="percent" />,
            note: d.wow === null ? "Needs two weeks of MRR" : "Target 7.0%",
          },
          {
            label: "Kill test",
            value: d.killTest.started ? (
              <>
                Day <Num value={d.killTest.day} />
              </>
            ) : (
              <>
                In <Num value={d.killTest.startsInDays} /> day{d.killTest.startsInDays === 1 ? "" : "s"}
              </>
            ),
            note: (
              <>
                <Num value={d.killTest.daysLeft} /> days to the deadline
              </>
            ),
          },
          {
            label: "Calls this week",
            value: <Num value={d.callsThisWeek} />,
            note: (
              <>
                <Num value={d.conversationsThisWeek} /> conversations
              </>
            ),
          },
        ]}
        action={
          <Link href="/calls?mode=block" className={cn(buttonVariants({ size: "lg" }))}>
            <Icons.calls data-icon="inline-start" />
            Start call block
          </Link>
        }
      />

      {d.nextUp ? <NextUp next={d.nextUp} /> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="today" className="flex min-w-0 flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h2 id="today" className="font-semibold">
              Today
            </h2>
            <span className="text-small text-muted-foreground">
              <Num value={d.today.totalDue} /> to work through
            </span>
          </div>
          {d.today.items.length === 0 ? (
            <EmptyState
              title="Nothing due"
              sentence="Import or find leads to build today's list."
              action={{ label: "Find leads", href: "/finder" }}
            />
          ) : (
            <div className="flex h-[520px] min-h-0">
              <SplitView
                id="dashboard-today"
                detailLabel={lead ? `Lead: ${lead.name}` : "Lead"}
                openOnNarrow={requested !== null}
                closeHref="/dashboard"
                list={
                  <RecordList
                    label="Today"
                    selectedId={selectedId}
                    hrefPrefix="/dashboard?lead="
                    items={d.today.items.map((i) => ({
                      id: i.companyId,
                      title: i.name,
                      subtitle: i.reason,
                      meta: i.score,
                      badge: (
                        <span key={i.companyId} className="text-caption text-muted-foreground">
                          {KIND_BADGE[i.kind]}
                        </span>
                      ),
                    }))}
                  />
                }
                detail={lead ? <LeadPanel lead={lead} /> : null}
              />
            </div>
          )}
        </section>

        <aside aria-label="Progress" className="flex flex-col gap-6">
          <KillTest kill={d.killTest} />
          <section aria-labelledby="mrr-growth" className="flex flex-col gap-2">
            <h2 id="mrr-growth" className="font-semibold">
              MRR vs 7% a week
            </h2>
            <MrrChart data={chart} />
          </section>
        </aside>
      </div>
    </div>
  );
}
