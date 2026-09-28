import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface KeyNumber {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}

interface PageHeaderProps {
  title: string;
  /** One line of context. */
  context: ReactNode;
  /** 2–4 key numbers. */
  numbers?: KeyNumber[];
  /** The page's one primary action. */
  action?: ReactNode;
}

const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

/**
 * The same header on every page (brief §3): title + context and the one primary
 * action on the first row, then a strip of 2–4 key numbers.
 */
export function PageHeader({ title, context, numbers = [], action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span aria-hidden="true" className="bg-accent h-0.5 w-8 rounded-full" />
          <h1 className="text-h2 font-semibold">{title}</h1>
          <p className="text-muted-foreground max-w-[70ch]">{context}</p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {numbers.length ? (
        <div role="group" aria-label="Key numbers">
          <dl
            className={cn(
              "border-border bg-card grid grid-cols-2 overflow-hidden rounded-xl border",
              COLS[numbers.length],
            )}
          >
            {numbers.map((n, i) => (
              <div
                key={n.label}
                className={cn(
                  "border-border flex flex-col gap-0.5 px-4 py-2.5",
                  i > 0 && "sm:border-l",
                  i % 2 === 1 && "max-sm:border-l",
                  i >= 2 && "max-sm:border-t",
                )}
              >
                <dt className="text-caption text-muted-foreground">{n.label}</dt>
                <dd className="text-h3 num font-semibold">{n.value}</dd>
                {n.note ? <dd className="text-caption text-muted-foreground">{n.note}</dd> : null}
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </header>
  );
}
