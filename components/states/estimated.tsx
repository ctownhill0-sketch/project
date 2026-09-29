import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** Partial or inferred data is always labeled (brief M1, Part 7). */
export function Estimated({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {children}
      <Badge variant="outline" className="border-input text-muted-foreground font-normal">
        Estimated
      </Badge>
    </span>
  );
}
