"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useHydrated } from "@/components/split/use-hydrated";
import { useWide } from "@/components/split/use-wide";

interface SplitViewProps {
  list: ReactNode;
  detail: ReactNode | null;
  /** Accessible name for the detail region / sheet. */
  detailLabel: string;
  /** On narrow screens the detail opens as a sheet only when the URL asked for a record. */
  openOnNarrow: boolean;
  /** Where closing the sheet goes (same page, record param removed). */
  closeHref: string;
  /** Key for remembering the split size in this browser. */
  id: string;
  /** Default list width in percent (the detail gets the rest). */
  listSize?: number;
}

/**
 * List + detail (brief §3). ≥1280px: side by side with an adjustable, keyboard-resizable split.
 * Below that the detail slides over the list, so you never lose your place.
 */
export function SplitView({
  list,
  detail,
  detailLabel,
  openOnNarrow,
  closeHref,
  id,
  listSize = 44,
}: SplitViewProps) {
  const wide = useWide();
  const hydrated = useHydrated();
  const router = useRouter();
  if (!wide) {
    return (
      <>
        <div className="border-border bg-card min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border">
          {list}
        </div>
        <Sheet
          open={openOnNarrow && detail !== null}
          onOpenChange={(open) => (open ? null : router.replace(closeHref, { scroll: false }))}
        >
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader className="sr-only">
              <SheetTitle>{detailLabel}</SheetTitle>
            </SheetHeader>
            {detail}
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    // Hidden below 1280px by CSS too, so narrow screens never paint the split before hydration.
    <div className="hidden min-h-0 min-w-0 flex-1 xl:flex">
      <ResizablePanelGroup
        id={id}
        orientation="horizontal"
        className="border-border bg-card min-h-0 flex-1 rounded-xl border"
      >
        <ResizablePanel id={`${id}-list`} defaultSize={`${listSize}`} minSize={300}>
          <div className="h-full overflow-y-auto">{list}</div>
        </ResizablePanel>
        {/* The resize handle only works once hydrated, and until then it has no value to announce. */}
        {hydrated ? <ResizableHandle withHandle aria-label="Resize list and detail" /> : null}
        <ResizablePanel id={`${id}-detail`} defaultSize={`${100 - listSize}`} minSize={420}>
          <section aria-label={detailLabel} className="h-full overflow-y-auto">
            {detail}
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
