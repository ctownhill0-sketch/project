"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { checkAuditAction } from "@/app/(app)/audits/actions";
import { CheckResult, type CheckView } from "@/components/compliance/check-result";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { countSentences, SUMMARY_SENTENCES, ungroundedNumbers, type AuditSnapshot } from "@/lib/domain/audit";

/**
 * The founder's 3-sentence summary, with a live sentence count and number check, then one button
 * that saves, runs the fair-housing check and downloads the PDF when everything passes.
 * AI-HOOK(M8): a drafted summary would prefill this box, labeled as a draft, and pass the same checks.
 */
export function AuditEditor({
  id,
  snapshot,
  initialSummary,
  initialCheck,
}: {
  id: string;
  snapshot: AuditSnapshot;
  initialSummary: string;
  initialCheck: CheckView | null;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [check, setCheck] = useState<CheckView | null>(initialCheck);
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const sentences = countSentences(summary);
  const loose = ungroundedNumbers(summary, snapshot);
  const pdf = `/audits/${id}/pdf`;

  const download = () => {
    // A plain link click: the Route Handler answers with an attachment, so the page stays put.
    const link = document.createElement("a");
    link.href = pdf;
    link.click();
    toast.success("PDF exported");
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await checkAuditAction({ id, summary });
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setProblems(res.data.problems);
            setCheck(res.data.check);
            if (res.data.ready) download();
          });
        }}
      >
        <Label htmlFor="audit-summary">Summary, in your words</Label>
        <Textarea
          id="audit-summary"
          rows={6}
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            setCheck(null);
            setProblems([]);
          }}
          aria-describedby="audit-summary-count audit-summary-numbers"
          placeholder="What you found, why it costs them, and what you propose."
        />
        <p id="audit-summary-count" className="text-small text-muted-foreground">
          <span className="num">{sentences}</span> of <span className="num">{SUMMARY_SENTENCES}</span>{" "}
          sentences
        </p>
        <p id="audit-summary-numbers" className="text-small" aria-live="polite">
          {loose.length ? (
            <span className="text-destructive-text">Not in the audit&apos;s data: {loose.join(", ")}</span>
          ) : (
            <span className="text-muted-foreground">Every number matches the audit&apos;s data.</span>
          )}
        </p>
        <Button type="submit" size="lg" className="self-start" disabled={pending}>
          Check and export PDF
        </Button>
      </form>
      {problems.length ? (
        <ul className="text-destructive-text text-small flex list-disc flex-col gap-1 pl-5" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {check ? (
        <CheckResult
          key={check.id}
          check={check}
          overrideLabel="Override and export"
          onOverridden={download}
        />
      ) : null}
      {check && (check.outcome === "pass" || check.overrideReason) ? (
        <a href={pdf} className="text-link text-small underline underline-offset-2">
          Download the PDF again
        </a>
      ) : null}
    </div>
  );
}
