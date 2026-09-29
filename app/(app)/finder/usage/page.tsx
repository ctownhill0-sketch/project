import type { Metadata } from "next";
import Link from "next/link";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { PLACES_PRICING, PRICING_CHECKED_ON } from "@/lib/domain/finder-cost";
import { getFinderConfig } from "@/lib/finder/service";
import { usageReport } from "@/lib/queries/finder";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Google usage" };

const day = (d: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${d}T12:00:00Z`));

export default async function UsagePage() {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const now = new Date();
  const [u, config] = await Promise.all([
    usageReport(db, workspaceId, now),
    getFinderConfig(db, workspaceId),
  ]);
  const max = Math.max(1, ...u.days.map((d) => d.search + d.details));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Google usage"
        context="Every Google Places request this app sent, and what it would cost. Counts only this app's requests."
        numbers={[
          {
            label: "Searches this month",
            value: (
              <>
                <Num value={u.month.search} /> of <Num value={config.caps.search.monthly} />
              </>
            ),
            note: `${PLACES_PRICING.text_search_enterprise.freePerMonth.toLocaleString("en-US")} free a month`,
          },
          {
            label: "Review lookups this month",
            value: (
              <>
                <Num value={u.month.details} /> of <Num value={config.caps.details.monthly} />
              </>
            ),
          },
          {
            label: "Estimated cost after free usage",
            value: <Num value={u.month.costAfterFreeUsd} format="currency" />,
            note: "Estimated",
          },
          {
            label: "At list price",
            value: <Num value={u.listCostUsd} format="currency" />,
            note: "Before free usage",
          },
        ]}
        action={
          <Link href="/settings#places" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Change caps
          </Link>
        }
      />

      <section aria-labelledby="by-day" className="flex flex-col gap-3">
        <h2 id="by-day" className="font-semibold">
          Requests by day (last 30 days)
        </h2>
        {u.days.length === 0 ? (
          <EmptyState
            title="No requests yet"
            sentence="Searches you run show up here with their cost."
            action={{ label: "Run a search", href: "/finder" }}
          />
        ) : (
          <div
            className="border-border bg-card relative overflow-x-auto rounded-xl border"
            role="region"
            aria-label="Requests by day"
            tabIndex={0}
          >
            <table className="text-small w-full">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Day
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Searches
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Review lookups
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Blocked by cap
                  </th>
                  <th scope="col" className="w-1/3 px-4 py-2 text-left font-medium">
                    <span className="sr-only">Bar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {u.days.map((d) => (
                  <tr key={d.date} className="border-border border-t">
                    <td className="px-4 py-2">{day(d.date)}</td>
                    <td className="px-4 py-2 text-right">
                      <Num value={d.search} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Num value={d.details} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Num value={d.blocked} />
                    </td>
                    <td className="px-4 py-2" aria-hidden="true">
                      <div className="bg-muted h-2 rounded-full">
                        <div
                          className="bg-chart-1 h-2 rounded-full"
                          style={{ width: `${((d.search + d.details) / max) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="by-search" className="flex flex-col gap-3">
        <h2 id="by-search" className="font-semibold">
          Which searches used them
        </h2>
        {u.runs.length === 0 ? (
          <p className="text-muted-foreground">No searches in the last 30 days.</p>
        ) : (
          <ul className="border-border bg-card divide-border divide-y rounded-xl border">
            {u.runs.map((r) => (
              <li key={r.runId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0 truncate">
                  {r.towns.map((t) => `${t.town}, ${t.state}`).join(" · ")}
                </span>
                <span className="text-small text-muted-foreground">
                  <Num value={r.requests} /> requests ·{" "}
                  <Link
                    href={`/finder/results?run=${r.runId}`}
                    className="text-link underline underline-offset-2"
                  >
                    results
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-small text-muted-foreground max-w-[70ch]">
        Prices from Google&apos;s pricing pages, checked {PRICING_CHECKED_ON}: Text Search Enterprise $
        {PLACES_PRICING.text_search_enterprise.usdPer1000} per 1,000 (1,000 free a month), Place Details
        Enterprise + Atmosphere ${PLACES_PRICING.place_details_atmosphere.usdPer1000} per 1,000 (1,000 free a
        month). Free usage is shared across your whole Google billing account, so set a $1 budget alert in
        Google Cloud as a backstop.
      </p>
    </div>
  );
}
