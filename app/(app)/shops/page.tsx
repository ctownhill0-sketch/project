import type { Metadata } from "next";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { navLabel } from "@/components/shell/nav-items";
import { LogShopForm } from "@/components/shops/log-shop-form";
import { ReplyButtons } from "@/components/shops/reply-buttons";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { company } from "@/lib/db/schema";
import { formatMinutes } from "@/lib/domain/scoring";
import type { ShopStats } from "@/lib/domain/shop-stats";
import { shopsOverview } from "@/lib/queries/shops";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: navLabel("/shops") };

const CHANNEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  listing_site: "Listing site",
  website_form: "Website form",
};
const BUCKET: Record<string, string> = {
  business: "Business hours",
  saturday: "Saturday",
  after_hours: "After hours",
};
const REPLY: Record<string, string> = {
  human: "A person",
  auto: "Auto-reply",
  ai: "AI assistant",
  none: "No reply yet",
};

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);

function Minutes({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">unknown</span>;
  if (!Number.isFinite(value)) return <span>Never (no reply)</span>;
  return <span className="num">{formatMinutes(value)}</span>;
}

function StatsRow({ label, s }: { label: string; s: ShopStats }) {
  return (
    <tr className="border-border border-t">
      <th scope="row" className="px-3 py-2 text-left font-medium">
        {label}
      </th>
      <td className="px-3 py-2 text-right">
        <Num value={s.count} />
      </td>
      <td className="px-3 py-2 text-right">
        <Minutes value={s.medianRepliedMinutes} />
      </td>
      <td className="px-3 py-2 text-right">
        <Minutes value={s.medianWithNoReplyMinutes} />
      </td>
      <td className="px-3 py-2 text-right">
        <Minutes value={s.p75RepliedMinutes} />
      </td>
      <td className="px-3 py-2 text-right">
        <Minutes value={s.p90RepliedMinutes} />
      </td>
      <td className="px-3 py-2 text-right">
        <Num value={s.noReplyShare24h} format="percent" />
      </td>
      <td className="px-3 py-2 text-right">
        <Num value={s.noReplyShare72h} format="percent" />
      </td>
    </tr>
  );
}

export default async function ShopsPage({ searchParams }: PageProps<"/shops">) {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const now = new Date();
  const params = await searchParams;
  const leadId = typeof params.lead === "string" && /^[0-9a-f-]{36}$/.test(params.lead) ? params.lead : null;
  const [o, preset] = await Promise.all([
    shopsOverview(db, workspaceId, now),
    leadId
      ? db
          .select({ id: company.id, name: company.name, city: company.city })
          .from(company)
          .where(and(eq(company.id, leadId), eq(company.workspaceId, workspaceId)))
      : Promise.resolve([]),
  ]);
  const s = o.stats;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mystery shops"
        context="Send a genuine rental inquiry under your own name, log it here, then record when they reply."
        numbers={[
          {
            label: "After-hours median reply",
            value: <Minutes value={s.after_hours.medianWithNoReplyMinutes} />,
            note: "No reply counts as never",
          },
          { label: "No reply within 24h", value: <Num value={s.all.noReplyShare24h} format="percent" /> },
          { label: "Reply checks due", value: <Num value={o.replyChecks.length} /> },
          { label: "Shops this week", value: <Num value={o.thisWeek} /> },
        ]}
        action={
          <Link href="/shops/plan" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Plan mystery shops
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="checks-heading" className="flex flex-col gap-3">
            <h2 id="checks-heading" className="font-semibold">
              Reply checks due
            </h2>
            {o.replyChecks.length === 0 ? (
              <p className="text-muted-foreground">
                Nothing to check. Checks come up 1h, 4h, 24h and 72h after each inquiry.
              </p>
            ) : (
              <ul className="border-border bg-card divide-border divide-y rounded-xl border">
                {o.replyChecks.map((c) => (
                  <li key={c.shopId} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/leads?lead=${c.companyId}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {c.companyName}
                      </Link>
                      <span className="text-small text-muted-foreground">
                        {c.checkpointHours}h check · sent {when(c.sentAt)}
                      </span>
                    </div>
                    <ReplyButtons shopId={c.shopId} firmName={c.companyName} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
            <h2 id="stats-heading" className="font-semibold">
              Response times
            </h2>
            <p className="text-small text-muted-foreground">
              Two medians side by side: replies only, and with every no-reply counted as never answered. Hours
              are New York time, correct across daylight saving.
            </p>
            <div
              className="border-border bg-card relative overflow-x-auto rounded-xl border"
              role="region"
              aria-label="Response times by hours"
              tabIndex={0}
            >
              <table className="text-small w-full min-w-[720px]">
                <caption className="sr-only">Response times by when the inquiry was sent</caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Sent during
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Shops
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Median, replies only
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Median, no reply counted
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      P75
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      P90
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      No reply in 24h
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      No reply in 72h
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <StatsRow label="All" s={s.all} />
                  <StatsRow label="Business hours" s={s.business} />
                  <StatsRow label="Saturday" s={s.saturday} />
                  <StatsRow label="After hours" s={s.after_hours} />
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="log-heading" className="flex flex-col gap-3">
            <h2 id="log-heading" className="font-semibold">
              All shops
            </h2>
            {o.total === 0 ? (
              <EmptyState
                title="No shops yet"
                sentence="Pick a few top leads and send each a genuine inquiry."
                action={{ label: "Plan mystery shops", href: "/shops/plan" }}
              />
            ) : (
              <div
                className="border-border bg-card relative overflow-x-auto rounded-xl border"
                role="region"
                aria-label="All shops table"
                tabIndex={0}
              >
                <table className="text-small w-full min-w-[640px]">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Firm
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Sent
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Hours
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Channel
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        First reply
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        From
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.shops.map((sh) => (
                      <tr key={sh.id} className="border-border border-t">
                        <td className="px-3 py-2">
                          <Link
                            href={`/leads?lead=${sh.companyId}`}
                            className="underline-offset-2 hover:underline"
                          >
                            {sh.companyName}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{when(sh.sentAt)}</td>
                        <td className="px-3 py-2">{BUCKET[sh.hoursBucket]}</td>
                        <td className="px-3 py-2">{CHANNEL[sh.channel]}</td>
                        <td className="px-3 py-2 text-right">
                          {sh.replyMinutes === null ? "No reply yet" : <Minutes value={sh.replyMinutes} />}
                        </td>
                        <td className="px-3 py-2">{REPLY[sh.replyType]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside aria-label="Log a shop" className="flex flex-col gap-6">
          <section
            aria-labelledby="new-shop"
            id="new"
            className="border-border bg-card flex scroll-mt-20 flex-col gap-3 rounded-xl border p-5"
          >
            <h2 id="new-shop" className="font-semibold">
              Log a shop
            </h2>
            <LogShopForm initialFirm={preset[0] ?? null} />
          </section>
          <section
            aria-labelledby="ethics"
            className="border-border bg-card flex flex-col gap-2 rounded-xl border p-5"
          >
            <h2 id="ethics" className="inline-flex items-center gap-2 font-semibold">
              <Icons.info className="size-4" />
              Mystery-shop ethics
            </h2>
            <ul className="text-small flex list-disc flex-col gap-1.5 pl-5">
              <li>
                Use your real name. No made-up personas, and never a persona built on a protected
                characteristic.
              </li>
              <li>
                Send genuine questions about real listings. Never book a fake tour or waste a showing slot.
              </li>
              <li>At most one shop per firm every 30 days. The app enforces this.</li>
              <li>Never shop a firm marked do not call.</li>
              <li>Results describe response behavior only, never rents.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
