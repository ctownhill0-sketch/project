"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { overrideCheckAction } from "@/app/(app)/settings/fair-housing/actions";
import { StatusBadge } from "@/components/states/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { categoryLabel, checkStatus } from "@/lib/compliance/labels";
import { SCREENING_LABEL, type Match, type Outcome } from "@/lib/domain/fair-housing";

export interface CheckView {
  id: string;
  outcome: Outcome;
  matches: Match[];
  overrideReason: string | null;
}

/**
 * The result of a fair-housing check: status, each flagged phrase with why and a safer wording,
 * and (for warnings) an override that needs a written reason. Blocks can't be overridden.
 */
export function CheckResult({
  check,
  onOverridden,
  overrideLabel = "Override with this reason",
  deferOverride = false,
}: {
  check: CheckView;
  onOverridden?: (reason: string) => void;
  overrideLabel?: string;
  /** The parent records the override itself (a script save re-checks and overrides in one go). */
  deferOverride?: boolean;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [cleared, setCleared] = useState(check.overrideReason);
  const [pending, start] = useTransition();
  const view = { ...check, overrideReason: cleared };

  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={checkStatus(view)} />
        <span className="text-small text-muted-foreground">
          {check.outcome === "pass"
            ? "No flagged phrases."
            : check.outcome === "block"
              ? "Change the wording before this is used."
              : cleared
                ? `Overridden: ${cleared}`
                : "Review the wording, or override with a reason."}
        </span>
      </div>
      {check.matches.length ? (
        <ul className="flex flex-col gap-2">
          {check.matches.map((m) => (
            <li key={m.ruleId} className="border-border flex flex-col gap-0.5 rounded-lg border p-3">
              <p>
                <span className="font-medium">“{m.phrase}”</span>{" "}
                <span className="text-small text-muted-foreground">
                  · {categoryLabel(m.category)} · {m.severity === "block" ? "Blocks" : "Warns"}
                </span>
              </p>
              <p className="text-small">{m.explanation}</p>
              {m.saferRewrite ? <p className="text-small">Try: {m.saferRewrite}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {check.outcome === "warn" && !cleared ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (deferOverride) {
              onOverridden?.(reason);
              return;
            }
            start(async () => {
              const res = await overrideCheckAction({ checkId: check.id, reason });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              setCleared(res.data.overrideReason);
              onOverridden?.(reason);
            });
          }}
        >
          <Label htmlFor={`${id}-reason`}>Reason for overriding (at least 10 characters)</Label>
          <Textarea id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={pending || reason.trim().length < 10}
          >
            {overrideLabel}
          </Button>
        </form>
      ) : null}
      <p className="text-caption text-muted-foreground">{SCREENING_LABEL}</p>
    </div>
  );
}
