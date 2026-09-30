import type { Metadata } from "next";
import Link from "next/link";
import { CallPrep } from "@/components/calls/call-prep";
import { CallWorkspace } from "@/components/calls/call-workspace";
import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { navLabel } from "@/components/shell/nav-items";
import { RecordList } from "@/components/split/record-list";
import { SplitView } from "@/components/split/split-view";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { callList, callPrep, callStats } from "@/lib/queries/calls";
import { getSetting } from "@/lib/queries/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: navLabel("/calls") };

const KIND = { callback: "Callback", call_now: "Call now", top_score: "Top score" } as const;

type Blocks = { days: number[]; start: string; end: string };

function inCallBlock(now: Date, b: Blocks) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(String(parts.weekday)) + 1;
  const hm = `${parts.hour}:${parts.minute}`;
  return b.days.includes(day) && hm >= b.start && hm < b.end;
}

export default async function CallsPage({ searchParams }: PageProps<"/calls">) {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const now = new Date();
  const params = await searchParams;
  const block = params.mode === "block";
  const [list, stats, blocks, kill] = await Promise.all([
    callList(db, workspaceId, now),
    callStats(db, workspaceId, now),
    getSetting<Blocks>(db, workspaceId, "callBlocks", DEFAULT_SETTINGS.callBlocks as Blocks),
    getSetting<{ conversationsTarget: number }>(
      db,
      workspaceId,
      "killTest",
      DEFAULT_SETTINGS.killTest as { conversationsTarget: number },
    ),
  ]);
  const requested =
    typeof params.lead === "string" && /^[0-9a-f-]{36}$/.test(params.lead) ? params.lead : null;
  const selectedId = requested ?? list[0]?.companyId ?? null;
  const index = list.findIndex((i) => i.companyId === selectedId);
  const prep = selectedId ? await callPrep(db, workspaceId, selectedId, now) : null;
  const next =
    list.find((i, n) => n > index && i.companyId !== selectedId) ??
    list.find((i) => i.companyId !== selectedId) ??
    null;
  const live = inCallBlock(now, blocks);
  const dayNames = blocks.days
    .map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d - 1])
    .join(", ");

  const workspace = prep ? (
    <div className="flex flex-col gap-6 p-5">
      <header className="flex flex-col gap-1">
        <span className="text-caption text-muted-foreground">
          {index >= 0 ? KIND[list[index]!.kind] : "Lead"}
        </span>
        <h2 className="text-h3 font-semibold">{prep.lead.name}</h2>
      </header>
      <CallWorkspace
        key={prep.lead.id}
        companyId={prep.lead.id}
        name={prep.lead.name}
        phone={prep.lead.phone}
        dnc={prep.lead.dncFlag}
        scripts={prep.scripts}
        objections={prep.objections}
        nextHref={
          block
            ? next
              ? `/calls?mode=block&lead=${next.companyId}`
              : "/calls"
            : next
              ? `/calls?lead=${next.companyId}`
              : null
        }
        {...(block ? { exitHref: "/calls" } : {})}
      />
      <CallPrep prep={prep} />
    </div>
  ) : null;

  if (block) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          role="status"
        >
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="font-semibold">Call block</h1>
            <p>
              call <Num value={Math.max(index + 1, 1)} /> of <Num value={list.length} />
              {next ? <span className="text-muted-foreground"> · next: {next.name}</span> : null}
            </p>
          </div>
          <Link href="/calls" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Exit (Esc)
          </Link>
        </div>
        {workspace ? (
          <div className="border-border bg-card mx-auto w-full max-w-3xl rounded-xl border">{workspace}</div>
        ) : (
          <EmptyState
            title="Call list is empty"
            sentence="Everyone due today has been called."
            action={{ label: "Back to calls", href: "/calls" }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Calls"
        context={`Call blocks run ${dayNames}, ${blocks.start}–${blocks.end}. Calls go through your phone (tel: links); the app never dials.`}
        numbers={[
          { label: "Calls today", value: <Num value={stats.today} /> },
          {
            label: "Decision-maker conversations",
            value: (
              <>
                <Num value={stats.conversationsThisWeek} />
              </>
            ),
            note: `This week · kill test needs ${kill.conversationsTarget}`,
          },
          { label: "Callbacks due", value: <Num value={stats.callbacksDue} /> },
          { label: "To call", value: <Num value={list.length} /> },
        ]}
        action={
          <Link
            href={selectedId ? `/calls?mode=block&lead=${selectedId}` : "/calls?mode=block"}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            <Icons.calls data-icon="inline-start" />
            Start call block
          </Link>
        }
      />
      {live ? (
        <p role="note" className="border-primary bg-card text-small rounded-lg border px-4 py-2 font-medium">
          Call block is on now ({blocks.start}–{blocks.end}).
        </p>
      ) : null}
      {list.length === 0 ? (
        <EmptyState
          title="Nobody to call"
          sentence="Find or import leads with a phone number to fill the call list."
          action={{ label: "Find leads", href: "/finder" }}
        />
      ) : (
        <div className="flex h-[75dvh] min-h-[480px]">
          <SplitView
            id="calls"
            listSize={36}
            detailLabel={prep ? `Call: ${prep.lead.name}` : "Call"}
            openOnNarrow={requested !== null}
            closeHref="/calls"
            list={
              <RecordList
                label="Call list"
                selectedId={selectedId}
                hrefPrefix="/calls?lead="
                items={list.map((i) => ({
                  id: i.companyId,
                  title: i.name,
                  subtitle: i.kind === "top_score" ? i.why : i.reason,
                  meta: i.score,
                  badge: (
                    <span key={i.companyId} className="text-caption text-muted-foreground">
                      {KIND[i.kind]}
                    </span>
                  ),
                }))}
              />
            }
            detail={workspace}
          />
        </div>
      )}
    </div>
  );
}
