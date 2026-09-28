import Link from "next/link";
import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardData } from "@/lib/queries/dashboard";
import { telHref } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABEL = { callback: "Callback", reply_check: "Reply check", top_score: "Top score" } as const;

/** The single best lead to act on now (Direction B's card on the C dashboard). */
export function NextUp({ next }: { next: NonNullable<DashboardData["nextUp"]> }) {
  return (
    <section
      aria-labelledby="next-up"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm md:flex-row md:items-center md:gap-8"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="next-up" className="text-small text-muted-foreground">
          Next up: {KIND_LABEL[next.kind].toLowerCase()}
        </h2>
        <p className="text-h3 truncate font-semibold">{next.name}</p>
        <p className="text-muted-foreground">
          {next.town ? `${next.town}. ` : ""}
          {next.reason}
        </p>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-caption text-muted-foreground">Score</span>
          <Num value={next.score} className="text-h1 font-semibold" />
        </div>
        <div className="flex flex-col gap-2">
          {next.phone ? (
            <a href={telHref(next.phone)} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              <Icons.calls data-icon="inline-start" />
              Call
            </a>
          ) : null}
          <Link
            href={`/dashboard?lead=${next.companyId}`}
            scroll={false}
            className="text-link text-small underline underline-offset-2"
          >
            Open lead
          </Link>
        </div>
      </div>
    </section>
  );
}
