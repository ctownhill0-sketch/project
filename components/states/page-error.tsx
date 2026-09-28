"use client";

import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
  /** What failed, e.g. "Couldn't load leads". */
  what: string;
  /** How to fix it, as a full sentence. */
  fix: string;
  onRetry: () => void;
}

/** Errors say what happened and how to fix it, with a way to recover. No apologies. */
export function PageError({ what, fix, onRetry }: PageErrorProps) {
  return (
    <Alert variant="destructive" className="flex flex-col gap-3">
      <Icons.error />
      <AlertTitle>{what}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{fix}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Icons.retry data-icon="inline-start" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
