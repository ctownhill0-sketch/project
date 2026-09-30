import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { DayEntry } from "@/components/pilots/day-entry";
import { ClosePilotButton, StartPilotForm } from "@/components/pilots/pilot-forms";
import { navLabel } from "@/components/shell/nav-items";
import { EmptyState } from "@/components/states/empty-state";
import { StatusBadge } from "@/components/states/status-badge";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { company } from "@/lib/db/schema";
import { addDays } from "@/lib/domain/guarantee";
import { nyDateKey } from "@/lib/domain/ny-time";
import { listPilots, type PilotView } from "@/lib/pilots/service";

export const metadata: Metadata = { title: navLabel("/pilots") };

function PilotCard({ p, today }: { p: PilotView; today: string }) {
  const running = p.status === "running";
  const lastEntryDay = p.lastDay < today ? p.lastDay : today;
  const days = Array.from({ length: p.rules.pilotDays }, (_, i) => addDays(p.day0, i)).filter(
    (d) => d <= today,
  );
  return (
    <section
      aria-labelledby={`pilot-${p.id}`}
      className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`pilot-${p.id}`} className="text-h3 font-semibold">
            <Link href={`/leads?lead=${p.companyId}`} className="underline-offset-2 hover:underline">
              {p.firmName}
            </Link>
          </h2>
          <p className="text-small text-muted-foreground">
            {running ? (
              <>
                Day <Num value={p.day} /> of <Num value={p.rules.pilotDays} /> · {p.day0} to {p.lastDay}
              </>
            ) : (
              `Closed · ${p.day0} to ${p.lastDay}`
            )}
          </p>
        </div>
        {running ? (
          p.elapsed >= p.rules.pilotDays ? (
            <ClosePilotButton pilotId={p.id} firmName={p.firmName} />
          ) : null
        ) : (
          <StatusBadge status={p.status === "met" ? "met" : "missed"} />
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label={`${p.firmName} guarantee by vacancy`}>
        {p.vacancies.map((v) => (
          <li key={v.id} className="border-border flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{v.label}</span>
              <StatusBadge status={v.guarantee.status} />
            </div>
            <dl className="text-small grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <dt className="text-muted-foreground">Tours</dt>
                <dd>
                  <Num value={v.guarantee.tours} /> of <Num value={p.rules.tourTarget} />
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-muted-foreground">Projected at day {p.rules.pilotDays}</dt>
                <dd>
                  <Num value={v.guarantee.projectedTours} />
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-muted-foreground">Median reply</dt>
                <dd>
                  {v.guarantee.medianReplySeconds === null ? (
                    <Num value={null} />
                  ) : (
                    <>
                      <Num value={v.guarantee.medianReplySeconds} />s
                    </>
                  )}
                </dd>
              </div>
            </dl>
            {v.guarantee.reasons.length ? (
              <ul className="text-small text-muted-foreground flex list-disc flex-col gap-0.5 pl-5">
                {v.guarantee.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {running && days.length ? (
        <DayEntry
          pilotId={p.id}
          firmName={p.firmName}
          days={days}
          defaultDay={lastEntryDay}
          vacancies={p.vacancies.map((v) => ({ id: v.id, label: v.label, metrics: v.metrics }))}
        />
      ) : running ? (
        <p className="text-small text-muted-foreground">Daily entry opens on day 0 ({p.day0}).</p>
      ) : null}
    </section>
  );
}

export default async function PilotsPage({ searchParams }: PageProps<"/pilots">) {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const today = nyDateKey(new Date());
  const params = await searchParams;
  const [pilots, firms] = await Promise.all([
    listPilots(db, workspaceId, today),
    db
      .select({ id: company.id, name: company.name })
      .from(company)
      .where(
        and(
          eq(company.workspaceId, workspaceId),
          eq(company.dncFlag, false),
          ne(company.status, "excluded"),
          isNull(company.mergedIntoId),
        ),
      )
      .orderBy(asc(company.name)),
  ]);
  const running = pilots.filter((p) => p.status === "running");
  const atRisk = running.filter((p) => p.vacancies.some((v) => v.guarantee.status === "at_risk")).length;
  const met = pilots.filter((p) => p.status === "met").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pilots"
        context="Enter each vacancy's numbers every day. At risk is judged from day 7; met or missed at day 14."
        numbers={[
          { label: "Running", value: <Num value={running.length} /> },
          { label: "At risk", value: <Num value={atRisk} /> },
          { label: "Met the guarantee", value: <Num value={met} /> },
        ]}
      />
      {running.length === 0 ? (
        <EmptyState
          title="No running pilots"
          sentence="Start one below when a firm agrees to 14 days on a couple of vacancies."
          action={{ label: "Start a pilot", href: "#start" }}
        />
      ) : null}
      {pilots.map((p) => (
        <PilotCard key={p.id} p={p} today={today} />
      ))}
      <section
        id="start"
        aria-labelledby="start-heading"
        className="border-border bg-card flex scroll-mt-20 flex-col gap-3 rounded-xl border p-5"
      >
        <h2 id="start-heading" className="font-semibold">
          Start a pilot
        </h2>
        <StartPilotForm
          firms={firms}
          today={today}
          preset={typeof params.lead === "string" ? params.lead : undefined}
        />
      </section>
    </div>
  );
}
