import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Google Places content shown without a Google map must carry Google Maps attribution, be visually
 * set apart from other content, and have an accessible "Google Maps" label (finder spec §1.3).
 */
export function GoogleAttribution({ className }: { className?: string }) {
  return (
    <span
      aria-label="Google Maps"
      role="img"
      className={cn("text-caption text-muted-foreground font-medium", className)}
    >
      Google Maps
    </span>
  );
}

export function GoogleContent({
  children,
  mapsUri,
  className,
}: {
  children: ReactNode;
  mapsUri?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("border-border flex flex-col gap-2 rounded-lg border p-3", className)}>
      {children}
      <div className="flex items-center justify-between gap-2">
        {mapsUri ? (
          <a
            href={mapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link text-caption underline underline-offset-2"
          >
            View on Google Maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span />
        )}
        <GoogleAttribution />
      </div>
    </div>
  );
}
