"use client";

import { useId, type MouseEvent, type ReactNode } from "react";

interface DisabledControlProps {
  "aria-disabled": true;
  "aria-describedby": string;
  onClick: (event: MouseEvent) => void;
}

interface DisabledReasonProps {
  reason: string;
  children: (props: DisabledControlProps) => ReactNode;
}

/**
 * A disabled control always says why (brief Part 7). aria-disabled keeps it
 * focusable so keyboard and screen-reader users can find the reason.
 */
export function DisabledReason({ reason, children }: DisabledReasonProps) {
  const id = useId();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {children({
        "aria-disabled": true,
        "aria-describedby": id,
        onClick: (event) => event.preventDefault(),
      })}
      <span id={id} className="text-small text-muted-foreground">
        {reason}
      </span>
    </span>
  );
}
