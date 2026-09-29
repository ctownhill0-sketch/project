import type { ReactNode } from "react";
import { Icons } from "@/components/icons";
import { GoogleContent } from "@/components/finder/google-attribution";
import { FetchReviewsButton, OverrideFitButton } from "@/components/finder/place-actions";
import { Num } from "@/components/num";
import { Estimated } from "@/components/states/estimated";
import { StatusBadge } from "@/components/states/status-badge";
import { Badge } from "@/components/ui/badge";
import { softwareLabel, type Software } from "@/lib/domain/scoring";
import { formatPhone } from "@/lib/format";
import type { placeDetail } from "@/lib/queries/finder";

export type PlaceDetail = NonNullable<Awaited<ReturnType<typeof placeDetail>>>;

const CONFIDENCE: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence: review",
};
const SERVICE: Record<string, string> = {
  residential: "Residential",
  hoa: "HOA",
  commercial: "Commercial",
  vacation: "Vacation rentals",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Source({ url }: { url: string }) {
  let label = url;
  try {
    const u = new URL(url);
    label = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {}
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link text-caption break-all underline underline-offset-2"
    >
      {label}
      <span className="sr-only"> (source, opens in a new tab)</span>
    </a>
  );
}

export function PlacePanel({ detail, actions }: { detail: PlaceDetail; actions?: ReactNode }) {
  const { place, latest, reviews, enrichmentRuns } = detail;
  const software = latest.get("software");
  const size = latest.get("size_units");
  const listings = latest.get("listing_count");
  const email = latest.get("email");
  const phone = latest.get("phone");
  const services = detail.evidence.filter((e) => e.kind === "service_type");
  const lastRun = enrichmentRuns[0];

  return (
    <article className="flex flex-col gap-5 p-5">
      <header className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground">Place</span>
        <h2 className="text-h3 font-semibold">{detail.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {place.dedupeStatus === "dnc" || place.triageStatus === "dnc" ? (
            <StatusBadge status="do_not_call" />
          ) : null}
          {place.fitStatus === "excluded" ? <StatusBadge status="excluded" /> : null}
          {place.fitStatus === "not_a_fit" ? <Badge variant="outline">Probably not a fit</Badge> : null}
          {place.dedupeStatus === "duplicate" ? <Badge variant="outline">Already a lead</Badge> : null}
          {place.dedupeStatus === "possible_duplicate" ? (
            <Badge variant="outline">Possible duplicate</Badge>
          ) : null}
          {place.triageStatus === "added" ? (
            <Badge variant="outline" className="text-success border-success/40">
              <Icons.success data-icon="inline-start" />
              Added
            </Badge>
          ) : null}
        </div>
        {place.fitReason || place.dedupeReason ? (
          <p className="text-small text-muted-foreground flex flex-wrap items-center gap-2">
            {[place.fitReason, place.dedupeReason].filter(Boolean).join(". ")}
            {place.fitStatus !== "ok" && place.triageStatus === "pending" ? (
              <OverrideFitButton placeResultId={place.id} />
            ) : null}
          </p>
        ) : null}
        {actions}
      </header>

      <Section title="Why this lead">
        <p>{place.why ?? "Not scored yet."}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-h2 num font-semibold">{place.score}</span>
          <span className="text-muted-foreground">of 100</span>
        </p>
        <table className="text-small w-full">
          <caption className="sr-only">Score breakdown</caption>
          <tbody>
            {place.scoreBreakdown.map((line) => (
              <tr key={line.rule} className="border-border border-b last:border-0">
                <td className="py-1.5">{line.reason}</td>
                <td className="num py-1.5 text-right">{line.points > 0 ? `+${line.points}` : line.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {place.displayName || place.formattedAddress || place.nationalPhone ? (
        <Section title="From Google">
          <GoogleContent mapsUri={place.googleMapsUri}>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 [&_dd]:min-w-0 [&_dd]:break-words">
              <dt className="text-muted-foreground">Address</dt>
              <dd>{place.formattedAddress ?? <span className="text-muted-foreground">unknown</span>}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="num">
                {place.nationalPhone ? (
                  formatPhone(place.nationalPhone)
                ) : (
                  <span className="text-muted-foreground">unknown</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="break-all">
                {place.websiteUri ? (
                  <a
                    href={place.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2"
                  >
                    {place.websiteUri}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">unknown</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Google reviews</dt>
              <dd>
                {place.userRatingCount === null ? (
                  <span className="text-muted-foreground">unknown</span>
                ) : (
                  <Num value={place.userRatingCount} />
                )}
              </dd>
            </dl>
          </GoogleContent>
        </Section>
      ) : null}

      <Section title="From their website">
        {place.enrichmentStatus === "none" ? (
          <p className="text-muted-foreground">
            {place.websiteUri ? "Website not checked yet." : "No website listed."}
          </p>
        ) : place.enrichmentStatus === "failed" ? (
          <p className="text-muted-foreground">
            Couldn&apos;t check the website
            {lastRun?.error
              ? ` (${lastRun.error === "robots" ? "robots.txt asks bots not to" : lastRun.error})`
              : ""}
            . Nothing was guessed.
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 [&_dd]:min-w-0 [&_dd]:break-words">
            <dt className="text-muted-foreground">Software</dt>
            <dd className="flex flex-col gap-0.5">
              <span>
                {software ? softwareLabel(software.value as Software) : "Software unknown"}
                {software ? (
                  <span className="text-muted-foreground"> · {CONFIDENCE[software.confidence]}</span>
                ) : null}
              </span>
              {software?.quote ? (
                <span className="text-caption text-muted-foreground break-all">{software.quote}</span>
              ) : null}
              {software ? <Source url={software.sourceUrl} /> : null}
            </dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd className="flex flex-col gap-0.5">
              {size ? (
                <>
                  <Estimated>
                    ~<Num value={Number(size.value)} /> units
                  </Estimated>
                  <span className="text-caption text-muted-foreground">“{size.quote}”</span>
                  <Source url={size.sourceUrl} />
                </>
              ) : (
                <span className="text-muted-foreground">unknown</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Listings</dt>
            <dd className="flex flex-col gap-0.5">
              {listings ? (
                <>
                  <Estimated>
                    <Num value={Number(listings.value)} /> live listings
                  </Estimated>
                  <Source url={listings.sourceUrl} />
                </>
              ) : (
                <span className="text-muted-foreground">unknown</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Contact</dt>
            <dd className="flex flex-col gap-0.5">
              {phone ? <span className="num">{formatPhone(phone.value)}</span> : null}
              {email ? <span>{email.value}</span> : null}
              {!phone && !email ? <span className="text-muted-foreground">unknown</span> : null}
            </dd>
            <dt className="text-muted-foreground">Services</dt>
            <dd>
              {services.length ? (
                services.map((s) => SERVICE[s.value] ?? s.value).join(", ")
              ) : (
                <span className="text-muted-foreground">unknown</span>
              )}
            </dd>
          </dl>
        )}
      </Section>

      <Section title="Reviews">
        <div className="flex flex-wrap items-center gap-2">
          <FetchReviewsButton placeResultId={place.id} fetched={reviews.length > 0} />
          {place.reviewFlagCount ? (
            <span className="text-small">
              <Num value={place.reviewFlagCount} /> mention slow or no replies
            </span>
          ) : null}
        </div>
        {reviews.length ? (
          <GoogleContent mapsUri={place.googleMapsUri}>
            <p className="text-caption text-muted-foreground">Sample of up to 5 Google reviews</p>
            <ul className="flex flex-col gap-3">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-col gap-1">
                  <p>{r.text}</p>
                  <p className="text-caption text-muted-foreground">
                    {r.rating ? `${r.rating} of 5 · ` : ""}
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
          </GoogleContent>
        ) : null}
      </Section>
    </article>
  );
}
