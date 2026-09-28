import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Chip {
  label: string;
  href: string;
  active: boolean;
}

/** One row of URL-driven filter chips. Links, so every filtered view is shareable and Back works. */
export function FilterChips({ label, chips }: { label: string; chips: Chip[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id={`chips-${label}`} className="text-small text-muted-foreground w-18 shrink-0">
        {label}
      </span>
      <ul aria-labelledby={`chips-${label}`} className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li key={chip.label}>
            <Link
              href={chip.href}
              aria-current={chip.active ? "true" : undefined}
              scroll={false}
              className={cn(
                "text-small inline-flex h-7 items-center rounded-full border px-3 transition-colors",
                chip.active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card hover:bg-muted",
              )}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
