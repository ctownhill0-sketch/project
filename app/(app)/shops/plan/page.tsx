import type { Metadata } from "next";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { shopPlan } from "@/lib/queries/shops";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan mystery shops" };

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(
    d,
  );

export default async function PlanPage({ searchParams }: PageProps<"/shops/plan">) {
  const { workspaceId } = await requireUser();
  const params = await searchParams;
  const ids =
    typeof params.ids === "string"
      ? params.ids
          .split(",")
          .filter((id) => /^[0-9a-f-]{36}$/.test(id))
          .slice(0, 50)
      : null;
  const plan = await shopPlan(await getDb(), workspaceId, ids, new Date());
  const done = plan.filter((p) => p.done).length;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plan mystery shops"
        context={
          ids
            ? "The leads you picked. Open each rentals page, send a genuine inquiry yourself, then log it."
            : "Your top new leads. Open each rentals page, send a genuine inquiry yourself, then log it."
        }
        numbers={[
          { label: "Firms", value: <Num value={plan.length} /> },
          { label: "Shopped", value: <Num value={done} /> },
        ]}
        action={
          <Link href="/shops" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            All shops
          </Link>
        }
      />
      {plan.length === 0 ? (
        <EmptyState
          title="No leads to shop"
          sentence="Find or import leads first."
          action={{ label: "Find leads", href: "/finder" }}
        />
      ) : (
        <ol
          className="border-border bg-card divide-border divide-y rounded-xl border"
          aria-label="Shop checklist"
        >
          {plan.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                {p.done ? (
                  <Icons.success className="text-success mt-0.5 size-5 shrink-0" aria-label="Shopped" />
                ) : (
                  <Icons.neutral
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-label="Not shopped yet"
                  />
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-small text-muted-foreground">
                    {p.done && p.lastShopAt && p.nextAllowedAt
                      ? `Shopped ${day(p.lastShopAt)}. Next shop from ${day(p.nextAllowedAt)}.`
                      : `${p.city ?? "Town unknown"} · score ${p.score}`}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Open rentals page
                    <span className="sr-only"> for {p.name} (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-small text-muted-foreground">No website found</span>
                )}
                {!p.done ? (
                  <Link href={`/shops?lead=${p.id}#new`} className={cn(buttonVariants({ size: "sm" }))}>
                    Log shop<span className="sr-only"> for {p.name}</span>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
