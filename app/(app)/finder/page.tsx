import type { Metadata } from "next";
import Link from "next/link";
import { SearchPanel } from "@/components/finder/search-panel";
import { TerritoryForm } from "@/components/finder/territory-form";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { navLabel } from "@/components/shell/nav-items";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { purgeExpiredGoogleContent } from "@/lib/finder/service";
import { placesKeyStatus } from "@/lib/finder/runtime";
import { finderOverview } from "@/lib/queries/finder";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: navLabel("/finder") };

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  running: "Running",
  done: "Done",
  stopped: "Stopped",
  stopped_cap: "Stopped at cap",
  failed: "Failed",
};

const when = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      }).format(d)
    : "Never";

export default async function FinderPage() {
  const user = await requireUser();
  const { workspaceId } = user;
  const db = await getDb();
  const now = new Date();
  await purgeExpiredGoogleContent(db, user, now);
  const o = await finderOverview(db, workspaceId, now);
  const key = placesKeyStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lead finder"
        context="Find property managers with Google Places, check their websites, then triage them into leads."
        numbers={[
          {
            label: "Google requests today",
            value: (
              <>
                <Num value={o.usage.search.today} /> of <Num value={o.caps.search.daily} />
              </>
            ),
            note: "Daily cap, then a hard stop",
          },
          {
            label: "This month",
            value: (
              <>
                <Num value={o.usage.search.month} /> of <Num value={o.caps.search.monthly} />
              </>
            ),
            note: "1,000 free a month",
          },
          { label: "Waiting for triage", value: <Num value={o.pendingTriage} /> },
          { label: "Leads added this week", value: <Num value={o.addedThisWeek} /> },
        ]}
        action={
          <Link href="/finder/triage" className={cn(buttonVariants({ size: "lg" }))}>
            Triage places
          </Link>
        }
      />

      {!key.configured ? (
        <div
          role="note"
          className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        >
          <p>
            <span className="font-medium">No Google Places key yet.</span>{" "}
            <span className="text-muted-foreground">
              Searches need GOOGLE_PLACES_API_KEY in .env.local. Settings shows how.
            </span>
          </p>
          <Link href="/settings#places" className={cn(buttonVariants({ variant: "outline" }))}>
            Key setup
          </Link>
        </div>
      ) : null}

      <SearchPanel
        keywords={o.keywords}
        usedThisMonth={o.usage.search.month}
        territories={o.territories.map((t) => ({
          id: t.id,
          name: t.name,
          towns: t.towns.map((tt) => ({ town: tt.town, state: tt.state })),
        }))}
        savedSearches={o.savedSearches.map((s) => ({
          id: s.id,
          name: s.name,
          towns: s.towns,
          keywords: s.keywords,
        }))}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-labelledby="territory-heading" className="flex min-w-0 flex-col gap-3">
          <h2 id="territory-heading" className="font-semibold">
            Territory tracker
          </h2>
          {o.territories.length === 0 ? (
            <p className="text-muted-foreground">
              Save your town list as a territory, then run it in order with one button.
            </p>
          ) : (
            o.territories.map((t) => (
              <div
                key={t.id}
                className="border-border bg-card relative overflow-x-auto rounded-xl border"
                role="region"
                aria-label={`Territory ${t.name}`}
                tabIndex={0}
              >
                <table className="text-small w-full">
                  <caption className="px-4 pt-3 text-left font-medium">{t.name}</caption>
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="px-4 py-2 text-left font-medium">
                        Town
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">
                        Last searched
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        Places found
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        Leads added
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.towns.map((tt) => (
                      <tr key={tt.id} className="border-border border-t">
                        <td className="px-4 py-2">
                          {tt.town}, {tt.state}
                        </td>
                        <td className="text-muted-foreground px-4 py-2">{when(tt.lastSearchedAt)}</td>
                        <td className="px-4 py-2 text-right">
                          <Num value={tt.resultsFound} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Num value={tt.leadsAdded} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
          <details className="border-border bg-card rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">New territory</summary>
            <div className="pt-3">
              <TerritoryForm />
            </div>
          </details>
        </section>

        <section aria-labelledby="runs-heading" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="runs-heading" className="font-semibold">
              Recent searches
            </h2>
            <Link href="/finder/usage" className="text-link text-small underline underline-offset-2">
              Usage and cost
            </Link>
          </div>
          {o.runs.length === 0 ? (
            <p className="text-muted-foreground">No searches yet. Run one above.</p>
          ) : (
            <ul className="border-border bg-card divide-border divide-y rounded-xl border">
              {o.runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {r.towns.map((t) => `${t.town}, ${t.state}`).join(" · ")}
                    </span>
                    <span className="text-small text-muted-foreground">
                      {when(r.createdAt)} · {STATUS_LABEL[r.status]} · <Num value={r.requestsUsed} /> requests
                      · <Num value={r.newFound} /> new of <Num value={r.resultsFound} />
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/finder/results?run=${r.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Results
                    </Link>
                    <Link
                      href={`/finder/triage?run=${r.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Triage
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
