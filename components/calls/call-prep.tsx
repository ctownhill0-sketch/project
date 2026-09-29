import Link from "next/link";
import type { ReactNode } from "react";
import { Num } from "@/components/num";
import { Estimated } from "@/components/states/estimated";
import { StatusBadge } from "@/components/states/status-badge";
import { formatMinutes, softwareLabel, type Software } from "@/lib/domain/scoring";
import type { callPrep } from "@/lib/queries/calls";

export type CallPrepData = NonNullable<Awaited<ReturnType<typeof callPrep>>>;

const DISPOSITION: Record<string, string> = {
  no_answer: "No answer",
  left_voicemail: "Left voicemail",
  gatekeeper: "Gatekeeper",
  callback: "Callback",
  conversation: "Conversation",
  audit_booked: "Audit booked",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  do_not_call: "Do not call",
};

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/**
 * Call prep from the firm's own data only (brief M6). Missing values show as "unknown".
 * AI-HOOK(M5): a Claude-written brief will render above these facts, as a draft the founder approves.
 */
export function CallPrep({ prep }: { prep: CallPrepData }) {
  const { lead } = prep;
  const unknown = <span className="text-muted-foreground">unknown</span>;
  const s = lead.shopStats;
  return (
    <section aria-labelledby="prep-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="prep-heading" className="font-semibold">
          Call prep
        </h3>
        <Link href={`/leads?lead=${lead.id}`} className="text-link text-small underline underline-offset-2">
          Full lead
        </Link>
      </div>
      {lead.dncFlag ? <StatusBadge status="do_not_call" /> : null}
      <p>{lead.why}</p>
      <dl className="text-small grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 [&_dd]:min-w-0 [&_dd]:break-words">
        <Fact label="Town">{[lead.city, lead.state].filter(Boolean).join(", ") || unknown}</Fact>
        <Fact label="Software">
          {softwareLabel(lead.software as Software)}
          {lead.softwareEvidence ? (
            <span className="text-muted-foreground"> · {lead.softwareEvidence}</span>
          ) : null}
        </Fact>
        <Fact label="Units">
          {lead.estUnits === null ? (
            unknown
          ) : (
            <Estimated>
              <Num value={lead.estUnits} />
            </Estimated>
          )}
        </Fact>
        <Fact label="Live listings">
          {lead.liveListingsCount === null ? (
            unknown
          ) : (
            <Estimated>
              <Num value={lead.liveListingsCount} />
            </Estimated>
          )}
        </Fact>
        <Fact label="Mystery shops">
          {s.count === 0 ? (
            "Not shopped yet"
          ) : (
            <>
              <Num value={s.count} /> ·{" "}
              {lead.shops
                .slice(0, 3)
                .map(
                  (sh) =>
                    `${day(sh.sentAt)}: ${sh.firstReplyAt ? formatMinutes((sh.firstReplyAt.getTime() - sh.sentAt.getTime()) / 60_000) : "no reply"}`,
                )
                .join("; ")}
            </>
          )}
        </Fact>
        <Fact label="ROI">
          {prep.roi ? (
            <Estimated>
              <Num value={prep.roi.inputs.rent ?? null} format="money" /> rent ·{" "}
              <Num value={prep.roi.results.dailyCost ?? null} format="currency" /> a vacant day
            </Estimated>
          ) : (
            unknown
          )}
        </Fact>
        <Fact label="Next step">
          {prep.openNextStep
            ? `${day(prep.openNextStep.nextStepAt!)}${prep.openNextStep.nextStepNote ? `: ${prep.openNextStep.nextStepNote}` : ""}`
            : "None"}
        </Fact>
      </dl>
      {lead.finderEvidence.length ? (
        <p className="text-caption text-muted-foreground">
          From their website:{" "}
          {lead.finderEvidence.map((e) => `${e.kind.replace("_", " ")} ${e.value}`).join(" · ")}
        </p>
      ) : null}
      {lead.calls.length ? (
        <div className="flex flex-col gap-1">
          <p className="text-small font-medium">Last calls</p>
          <ul className="text-small flex flex-col gap-0.5">
            {lead.calls.slice(0, 3).map((c) => (
              <li key={c.id}>
                {day(c.calledAt)}: {DISPOSITION[c.disposition]}
                {c.notes ? <span className="text-muted-foreground"> · {c.notes}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
