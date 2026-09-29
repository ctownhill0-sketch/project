"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { triageAction, undoTriageAction } from "@/app/(app)/finder/actions";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

const EDITABLE = "input, textarea, select, [contenteditable='true'], [role='combobox']";
const CONFIRM_MS = 3000;

export interface TriageViewProps {
  placeId: string;
  name: string;
  websiteUri: string | null;
  position: number;
  total: number;
  /** Base URL for this triage session, e.g. "/finder/triage?run=…" */
  baseHref: string;
  canAdd: boolean;
  children: ReactNode;
}

/**
 * One place at a time (finder spec §4.6). A add · S skip · N not a fit · D do not call (press twice) ·
 * O open website · U undo. No animation: this is used hundreds of times a day.
 */
export function TriageView({
  placeId,
  name,
  websiteUri,
  position,
  total,
  baseHref,
  canAdd,
  children,
}: TriageViewProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDnc, setConfirmDnc] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (id: string | null) =>
    router.replace(id ? `${baseHref}&place=${id}` : baseHref, { scroll: false });

  const decide = (decision: "add" | "skip" | "not_a_fit" | "dnc") =>
    start(async () => {
      const res = await triageAction(placeId, decision);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if ("blocked" in res.data && res.data.blocked) {
        toast.message(res.data.blocked);
        go(null);
        return;
      }
      const label = {
        add: `Added ${name} to Leads`,
        skip: `Skipped ${name}`,
        not_a_fit: `Marked ${name} not a fit`,
        dnc: `${name} is now do not call (permanent)`,
      }[decision];
      toast.success(
        label,
        decision === "dnc" ? undefined : { action: { label: "Undo", onClick: () => undo() } },
      );
      go(null);
    });

  const undo = () =>
    start(async () => {
      const res = await undoTriageAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.data.undone) {
        toast.message(res.data.message);
        return;
      }
      toast.success("Undone");
      go(res.data.placeResultId);
    });

  const dnc = () => {
    if (confirmDnc) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmDnc(false);
      decide("dnc");
      return;
    }
    setConfirmDnc(true);
    confirmTimer.current = setTimeout(() => setConfirmDnc(false), CONFIRM_MS);
  };

  const openSite = () => {
    if (websiteUri) window.open(websiteUri, "_blank", "noopener,noreferrer");
  };

  const latest = useRef({ decide, undo, dnc, openSite, canAdd, pending });
  useEffect(() => {
    latest.current = { decide, undo, dnc, openSite, canAdd, pending };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(EDITABLE) || document.querySelector("[role='dialog']")) return;
      const a = latest.current;
      if (a.pending) return;
      const key = e.key.toLowerCase();
      const map: Record<string, () => void> = {
        a: () => (a.canAdd ? a.decide("add") : toast.error("This place can't be added.")),
        s: () => a.decide("skip"),
        n: () => a.decide("not_a_fit"),
        d: () => a.dnc(),
        o: () => a.openSite(),
        u: () => a.undo(),
      };
      const fn = map[key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-4" data-place-id={placeId}>
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium" aria-live="polite">
            <span className="num">{position}</span> of <span className="num">{total}</span>
          </p>
          <progress
            value={position - 1}
            max={Math.max(total, 1)}
            className="accent-primary h-2 w-40"
            aria-label="Triage progress"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Triage actions">
          <KeyButton
            label="Add"
            shortcut="A"
            onClick={() => decide("add")}
            disabled={pending || !canAdd}
            variant="default"
          />
          <KeyButton label="Skip" shortcut="S" onClick={() => decide("skip")} disabled={pending} />
          <KeyButton label="Not a fit" shortcut="N" onClick={() => decide("not_a_fit")} disabled={pending} />
          <KeyButton
            label={confirmDnc ? "Press D again" : "Do not call"}
            shortcut="D"
            onClick={dnc}
            disabled={pending}
            variant="destructive"
          />
          <KeyButton
            label="Open website"
            shortcut="O"
            onClick={openSite}
            disabled={pending || !websiteUri}
            variant="ghost"
          />
          <KeyButton label="Undo" shortcut="U" onClick={undo} disabled={pending} variant="ghost" />
        </div>
        {confirmDnc ? (
          <p role="alert" className="text-small text-destructive-text">
            Do not call is permanent and can&apos;t be undone. Press D again within 3 seconds to confirm.
          </p>
        ) : null}
      </div>
      <div className="border-border bg-card rounded-xl border">{children}</div>
    </div>
  );
}

function KeyButton({
  label,
  shortcut,
  onClick,
  disabled,
  variant = "outline",
}: {
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost" | "destructive";
}) {
  return (
    <Button variant={variant} onClick={onClick} disabled={disabled} aria-keyshortcuts={shortcut}>
      {label}
      <Kbd aria-hidden="true">{shortcut}</Kbd>
    </Button>
  );
}
