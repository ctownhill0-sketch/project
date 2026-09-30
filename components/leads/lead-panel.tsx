import Link from "next/link";
import type { ReactNode } from "react";
import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { Estimated } from "@/components/states/estimated";
import { StatusBadge } from "@/components/states/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatMinutes, softwareLabel, type Software } from "@/lib/domain/scoring";
import type { getLeadDetail } from "@/lib/queries/leads";
import { formatPhone, telHref } from "@/lib/format";
import { GoogleContent } from "@/components/finder/google-attribution";
import { AddToPipelineButton, SoftwareOverrideForm } from "@/components/leads/lead-actions";
import { cn } from "@/lib/utils";

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  researching: "Researching",
  ready: "Ready to call",
  contacted: "Contacted",
  excluded: "Excluded",
  archived: "Archived",
};

const EVIDENCE_LABEL: Record<string, string> = {
  software: "Software",
  size_units: "Size",
  listing_count: "Live listings",
  phone: "Phone",
  email: "Email",
  name: "Name on site",
  service_type: "Service",
};

const DISPOSITION_LABEL: Record<string, string> = {
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

function minutesOrUnknown(value: number | null): ReactNode {
  if (value === null) return <span className="text-muted-foreground">unknown</span>;
  if (!Number.isFinite(value)) return "No reply";
  return <span className="num">{formatMinutes(value)}</span>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Lead detail: only facts we have; missing values show "unknown", estimates are labelled. */
export function LeadPanel({ lead }: { lead: LeadDetail }) {
  const place = [lead.city, lead.state].filter(Boolean).join(", ");
  const stats = lead.shopStats;
  return (
    <article className="flex flex-col gap-5 p-5">
      <header className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground">Lead</span>
        <h2 className="text-h3 font-semibold">{lead.name}</h2>
        <p className="text-small text-muted-foreground">
          {place || "Town unknown"}
          {lead.domain ? <span className="ml-2">{lead.domain}</span> : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {lead.status === "excluded" ? (
            <StatusBadge status="excluded" />
          ) : (
            <Badge variant="outline">{STATUS_LABEL[lead.status] ?? lead.status}</Badge>
          )}
          {lead.dncFlag ? <StatusBadge status="do_not_call" /> : null}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {lead.phone && !lead.dncFlag ? (
            <a href={telHref(lead.phone)} className={cn(buttonVariants({ variant: "outline" }))}>
              <Icons.calls data-icon="inline-start" />
              Call <span className="num">{formatPhone(lead.phone)}</span>
            </a>
          ) : null}
          <Link href={`/shops?lead=${lead.id}#new`} className={cn(buttonVariants({ variant: "outline" }))}>
            Log a shop
          </Link>
          {!lead.dncFlag ? <AddToPipelineButton companyId={lead.id} /> : null}
        </div>
        <p className="text-small flex flex-wrap gap-x-3 gap-y-1">
          <Link href={`/roi?lead=${lead.id}`} className="text-link underline underline-offset-2">
            ROI for this firm
          </Link>
          {lead.shops.length > 0 && !lead.dncFlag ? (
            <Link href={`/audits?lead=${lead.id}`} className="text-link underline underline-offset-2">
              Start a vacancy audit
            </Link>
          ) : null}
        </p>
      </header>

      <Section title="Why this lead">
        <p>{lead.why}</p>
      </Section>

      <Section title="Score">
        <p className="flex items-baseline gap-2">
          <span className="text-h2 num font-semibold">{lead.score}</span>
          <span className="text-muted-foreground">of 100</span>
        </p>
        <table className="text-small w-full">
          <caption className="sr-only">Score breakdown</caption>
          <tbody>
            {lead.breakdown.map((line) => (
              <tr key={line.rule} className="border-border border-b last:border-0">
                <td className="py-1.5">{line.reason}</td>
                <td className="num py-1.5 text-right">{line.points > 0 ? `+${line.points}` : line.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Mystery shops">
        {stats.count === 0 ? (
          <p className="text-muted-foreground">Not shopped yet. Log a shop to measure how fast they reply.</p>
        ) : (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 [&_dd]:min-w-0 [&_dd]:break-words">
            <dt className="text-muted-foreground">Median, replies only</dt>
            <dd>{minutesOrUnknown(stats.medianRepliedMinutes)}</dd>
            <dt className="text-muted-foreground">Median, no reply counted</dt>
            <dd>{minutesOrUnknown(stats.medianWithNoReplyMinutes)}</dd>
            <dt className="text-muted-foreground">Shops</dt>
            <dd>
              <Num value={stats.count} />, <Num value={stats.count - stats.replied} /> without a reply
            </dd>
          </dl>
        )}
      </Section>

      <Section title="Details">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 [&_dd]:min-w-0 [&_dd]:break-words">
          <dt className="text-muted-foreground">Software</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {softwareLabel(lead.software)}
            {lead.websiteUrl ? (
              <a
                href={lead.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link inline-flex items-center gap-1 underline underline-offset-2"
              >
                Check portal
                <Icons.external className="size-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : null}
          </dd>
          <dt className="text-muted-foreground">Units</dt>
          <dd>
            {lead.estUnits === null ? (
              <span className="text-muted-foreground">unknown</span>
            ) : (
              <Estimated>
                <Num value={lead.estUnits} />
              </Estimated>
            )}
          </dd>
          <dt className="text-muted-foreground">Live listings</dt>
          <dd>
            {lead.liveListingsCount === null ? (
              <span className="text-muted-foreground">unknown</span>
            ) : (
              <Estimated>
                <Num value={lead.liveListingsCount} />
              </Estimated>
            )}
          </dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="num">
            {lead.phone ? formatPhone(lead.phone) : <span className="text-muted-foreground">unknown</span>}
          </dd>
        </dl>
      </Section>

      <Section title="Software">
        <p className="text-small text-muted-foreground">
          {lead.softwareOverride
            ? "Set by you"
            : lead.softwareConfidence
              ? `Detected, ${lead.softwareConfidence} confidence`
              : "Detected"}
          {lead.softwareEvidence ? `: ${lead.softwareEvidence}` : ""}
        </p>
        <SoftwareOverrideForm key={lead.id} companyId={lead.id} current={lead.softwareOverride} />
      </Section>

      {lead.finderEvidence.length ? (
        <Section title="From their website">
          <ul className="flex flex-col gap-2">
            {lead.finderEvidence.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5">
                <span>
                  <span className="text-muted-foreground">{EVIDENCE_LABEL[e.kind] ?? e.kind}: </span>
                  {e.kind === "software"
                    ? softwareLabel(e.value as Software)
                    : e.kind === "phone"
                      ? formatPhone(e.value)
                      : e.value}
                  {e.kind === "size_units" || e.kind === "listing_count" ? (
                    <span className="text-muted-foreground"> (Estimated)</span>
                  ) : null}
                </span>
                {e.quote && e.quote !== e.value ? (
                  <span className="text-caption text-muted-foreground break-all">“{e.quote}”</span>
                ) : null}
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link text-caption break-all underline underline-offset-2"
                >
                  {e.sourceUrl}
                  <span className="sr-only"> (source, opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {lead.address || lead.reviews.length ? (
        <Section title="From Google">
          <GoogleContent>
            {lead.address ? <p>{lead.address}</p> : null}
            {lead.reviews.length ? (
              <>
                <p className="text-caption text-muted-foreground">Sample of up to 5 Google reviews</p>
                <ul className="flex flex-col gap-2">
                  {lead.reviews.map((r) => (
                    <li key={r.id} className="flex flex-col gap-0.5">
                      <p>{r.text}</p>
                      <p className="text-caption text-muted-foreground">
                        {r.authorUri ? (
                          <a
                            href={r.authorUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-link underline underline-offset-2"
                          >
                            {r.authorName ?? "Google user"}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        ) : (
                          (r.authorName ?? "Google user")
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </GoogleContent>
        </Section>
      ) : null}

      <Section title="Contacts">
        {lead.contacts.length === 0 ? (
          <p className="text-muted-foreground">No contacts yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lead.contacts.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{c.name}</span>
                {c.roleTitle ? <span className="text-muted-foreground">, {c.roleTitle}</span> : null}
                {c.isDecisionMaker ? <span className="text-muted-foreground"> (decision maker)</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent calls">
        {lead.calls.length === 0 ? (
          <p className="text-muted-foreground">Not called yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lead.calls.map((c) => (
              <li key={c.id} className="flex justify-between gap-4">
                <span>{DISPOSITION_LABEL[c.disposition] ?? c.disposition}</span>
                <span className="text-muted-foreground num">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "America/New_York",
                  }).format(c.calledAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}
