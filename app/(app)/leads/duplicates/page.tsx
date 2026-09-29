import type { Metadata } from "next";
import Link from "next/link";
import { MergeButtons } from "@/components/leads/lead-actions";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { softwareLabel, type Software } from "@/lib/domain/scoring";
import { formatPhone } from "@/lib/format";
import { possibleDuplicatePairs } from "@/lib/leads/manage";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Possible duplicates" };

type Firm = Awaited<ReturnType<typeof possibleDuplicatePairs>>[number]["a"];

function Card({ firm, side }: { firm: Firm; side: string }) {
  const unknown = <span className="text-muted-foreground">unknown</span>;
  return (
    <div className="border-border flex min-w-0 flex-col gap-2 rounded-lg border p-4">
      <p className="text-caption text-muted-foreground">{side}</p>
      <p className="font-semibold">{firm.name}</p>
      <dl className="text-small grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 [&_dd]:min-w-0 [&_dd]:break-words">
        <dt className="text-muted-foreground">Website</dt>
        <dd>{firm.domain ?? unknown}</dd>
        <dt className="text-muted-foreground">Phone</dt>
        <dd className="num">{firm.phone ? formatPhone(firm.phone) : unknown}</dd>
        <dt className="text-muted-foreground">Town</dt>
        <dd>{[firm.city, firm.state].filter(Boolean).join(", ") || unknown}</dd>
        <dt className="text-muted-foreground">Software</dt>
        <dd>{softwareLabel((firm.softwareOverride ?? firm.detectedSoftware) as Software)}</dd>
        <dt className="text-muted-foreground">Score</dt>
        <dd>
          <Num value={firm.score} />
        </dd>
        <dt className="text-muted-foreground">Source</dt>
        <dd>
          {firm.source === "finder" ? "Lead finder" : firm.source === "csv" ? "CSV import" : "Added by hand"}
        </dd>
      </dl>
      {firm.dncFlag ? (
        <p className="text-destructive-text text-small font-medium">Do not call (carries over when merged)</p>
      ) : null}
    </div>
  );
}

export default async function DuplicatesPage() {
  const { workspaceId } = await requireUser();
  const pairs = await possibleDuplicatePairs(await getDb(), workspaceId);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Possible duplicates"
        context="Leads that look like the same firm. Keep one: calls, shops, contacts and deals move over, and blank fields are filled in."
        numbers={[{ label: "Pairs to check", value: <Num value={pairs.length} /> }]}
        action={
          <Link href="/leads" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Back to leads
          </Link>
        }
      />
      {pairs.length === 0 ? (
        <EmptyState
          title="No duplicates"
          sentence="Every lead looks like a different firm."
          action={{ label: "Open leads", href: "/leads" }}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {pairs.map((p) => (
            <li
              key={`${p.a.id}-${p.b.id}`}
              className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{p.reason}</p>
                <MergeButtons a={{ id: p.a.id, name: p.a.name }} b={{ id: p.b.id, name: p.b.name }} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card firm={p.a} side="Left" />
                <Card firm={p.b} side="Right" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
