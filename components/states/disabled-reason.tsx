import { useId, type ReactNode } from "react";

interface DisabledControlProps {
  "aria-disabled": true;
  "aria-describedby": string;
}

interface DisabledReasonProps {
  reason: string;
  /** Render the control with these props. Don't attach an action to a disabled control. */
  children: (props: DisabledControlProps) => ReactNode;
}

/**
 * A disabled control always says why (brief Part 7). aria-disabled keeps it
 * focusable so keyboard and screen-reader users can find the reason.
 * Works in server and client components.
 */
export function DisabledReason({ reason, children }: DisabledReasonProps) {
  const id = useId();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {children({ "aria-disabled": true, "aria-describedby": id })}
      <span id={id} className="text-small text-muted-foreground">
        {reason}
      </span>
    </span>
  );
}
