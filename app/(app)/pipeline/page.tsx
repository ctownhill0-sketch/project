import type { Metadata } from "next";
import Link from "next/link";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { PipelineBoard, PipelineTable } from "@/components/pipeline/board";
import { navLabel } from "@/components/shell/nav-items";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { pipelineBoard } from "@/lib/queries/pipeline";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: navLabel("/pipeline") };

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  const { workspaceId } = await requireUser();
  const params = await searchParams;
  const table = params.view === "table";
  const board = await pipelineBoard(await getDb(), workspaceId, new Date());
  const total = board.stages.reduce((n, s) => n + s.deals.length, 0);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pipeline"
        context="Every firm you've called, by stage. Drag a card or use Move to…; a lost deal needs a reason."
        numbers={[
          { label: "Open deals", value: <Num value={board.totals.open} /> },
          {
            label: "Expected MRR",
            value: <Num value={board.totals.expectedMrr} format="money" />,
            note: "Estimated: price × stage probability",
          },
          { label: "Won this month", value: <Num value={board.totals.wonThisMonth} /> },
          { label: "Lost this month", value: <Num value={board.totals.lostThisMonth} /> },
        ]}
        action={
          <Link href="/calls" className={cn(buttonVariants({ size: "lg" }))}>
            Open call list
          </Link>
        }
      />
      <nav aria-label="Pipeline view" className="flex gap-2">
        <Link
          href="/pipeline"
          aria-current={!table ? "page" : undefined}
          className={cn(buttonVariants({ variant: !table ? "secondary" : "ghost", size: "sm" }))}
        >
          Board
        </Link>
        <Link
          href="/pipeline?view=table"
          aria-current={table ? "page" : undefined}
          className={cn(buttonVariants({ variant: table ? "secondary" : "ghost", size: "sm" }))}
        >
          Table
        </Link>
      </nav>
      {total === 0 ? (
        <EmptyState
          title="No deals yet"
          sentence="Deals open when you log a call. Start with your call list."
          action={{ label: "Open call list", href: "/calls" }}
        />
      ) : table ? (
        <PipelineTable stages={board.stages} />
      ) : (
        <PipelineBoard stages={board.stages} />
      )}
    </div>
  );
}
