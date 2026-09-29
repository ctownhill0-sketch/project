"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { overrideFitAction, reviewsAction } from "@/app/(app)/finder/actions";
import { Button } from "@/components/ui/button";

export function FetchReviewsButton({ placeResultId, fetched }: { placeResultId: string; fetched: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await reviewsAction(placeResultId);
          if (res.ok)
            toast.success(
              res.data.flags
                ? `${res.data.flags} reviews mention slow or no replies`
                : "Reviews checked: no responsiveness complaints",
            );
          else toast.error(res.error);
        })
      }
    >
      {pending ? "Fetching…" : fetched ? "Refresh reviews (1 request)" : "Fetch reviews (1 request)"}
    </Button>
  );
}

export function OverrideFitButton({ placeResultId }: { placeResultId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await overrideFitAction(placeResultId);
          if (res.ok) toast.success("Marked as a fit");
          else toast.error(res.error);
        })
      }
    >
      It is a fit
    </Button>
  );
}
