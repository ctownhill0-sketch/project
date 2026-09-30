import Link from "next/link";
import { Icons } from "@/components/icons";
import type { FirstRun } from "@/lib/domain/first-run";

/** Getting started: collapsed to one line so the dashboard still fits without scrolling. */
export function FirstRunChecklist({ run }: { run: FirstRun }) {
  if (run.complete) return null;
  return (
    <details className="border-border bg-card group rounded-xl border">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <Icons.chevron className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-90" />
        <span className="font-semibold">Getting started</span>
        <span className="text-small text-muted-foreground">
          <span className="num">{run.done}</span> of <span className="num">{run.total}</span> done
          {run.next ? ` · Next: ${run.next.label}` : ""}
        </span>
      </summary>
      <ol className="flex flex-col gap-1 px-4 pb-4" aria-label="Getting started steps">
        {run.items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            {item.done ? (
              <Icons.success className="text-success size-4 shrink-0" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="border-input size-4 shrink-0 rounded-full border" />
            )}
            <span className="sr-only">{item.done ? "Done:" : "To do:"}</span>
            {item.done ? (
              <span className="text-muted-foreground">{item.label}</span>
            ) : (
              <Link href={item.href} className="text-link underline-offset-2 hover:underline">
                {item.label}
              </Link>
            )}
            {"progress" in item && !item.done ? (
              <span className="text-small text-muted-foreground num">{item.progress}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
