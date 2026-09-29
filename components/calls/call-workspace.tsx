"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logCallAction, objectionHeardAction } from "@/app/(app)/calls/actions";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DISPOSITIONS, dispositionForKey, type Disposition, type FilledScript } from "@/lib/domain/calls";
import { formatPhone, telHref } from "@/lib/format";
import { cn } from "@/lib/utils";

const EDITABLE = "input, textarea, select, [contenteditable='true'], [role='combobox']";
const CONFIRM_MS = 3000;

export interface CallWorkspaceProps {
  companyId: string;
  name: string;
  phone: string | null;
  dnc: boolean;
  scripts: { id: string; name: string; filled: FilledScript }[];
  objections: { id: string; title: string; timesHeard: number; filled: FilledScript }[];
  /** Where to go after logging (call block: the next firm). null = stay and refresh. */
  nextHref: string | null;
  /** Call block mode: Esc leaves to this URL. */
  exitHref?: string;
}

function Filled({ script }: { script: FilledScript }) {
  return (
    <p className="leading-relaxed">
      {script.parts.map((p, i) =>
        p.missing ? (
          <mark
            key={i}
            className="bg-muted text-foreground border-warning rounded-sm border-b-2 px-1 font-medium"
            title={`Missing: ${p.variable}`}
          >
            unknown
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}

/** Hotkeys 1–9 log a disposition (9 = do not call, press twice). No animation: used all day. */
export function CallWorkspace({
  companyId,
  name,
  phone,
  dnc,
  scripts,
  objections,
  nextHref,
  exitHref,
}: CallWorkspaceProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scriptId, setScriptId] = useState(scripts[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [dm, setDm] = useState(false);
  const [nextAt, setNextAt] = useState("");
  const [nextNote, setNextNote] = useState("");
  const [confirmDnc, setConfirmDnc] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const script = scripts.find((s) => s.id === scriptId) ?? scripts[0];

  const log = (disposition: Disposition) =>
    start(async () => {
      const res = await logCallAction({
        companyId,
        disposition,
        notes: notes || null,
        nextStepAt: nextAt ? new Date(nextAt).toISOString() : null,
        nextStepNote: nextNote || null,
        isDecisionMakerConversation: dm,
      });
      if (!res.ok) return void toast.error(res.error);
      const label = DISPOSITIONS.find((d) => d.value === disposition)!.label;
      const next = res.data.nextStepAt
        ? ` Next step ${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(res.data.nextStepAt))}.`
        : "";
      toast.success(`${name}: ${label}.${next}`);
      setNotes("");
      setDm(false);
      setNextAt("");
      setNextNote("");
      if (nextHref) router.push(nextHref, { scroll: false });
    });

  const choose = (d: Disposition) => {
    if (d !== "do_not_call") return log(d);
    if (confirmDnc) {
      if (timer.current) clearTimeout(timer.current);
      setConfirmDnc(false);
      return log(d);
    }
    setConfirmDnc(true);
    timer.current = setTimeout(() => setConfirmDnc(false), CONFIRM_MS);
  };

  const latest = useRef({ choose, pending, exitHref, dnc });
  useEffect(() => {
    latest.current = { choose, pending, exitHref, dnc };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(EDITABLE)) return;
      const a = latest.current;
      if (e.key === "Escape" && a.exitHref && !document.querySelector("[role='dialog']")) {
        e.preventDefault();
        router.push(a.exitHref);
        return;
      }
      if (document.querySelector("[role='dialog']") || a.pending || a.dnc) return;
      const d = dispositionForKey(e.key);
      if (!d) return;
      e.preventDefault();
      a.choose(d.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (dnc) {
    return (
      <p role="note" className="text-destructive-text font-medium">
        {name} is marked do not call. It can&apos;t be called again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {phone ? (
        <a
          href={telHref(phone)}
          className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center gap-2 self-start rounded-lg px-5 text-lg font-semibold"
        >
          <Icons.calls className="size-5" />
          Call <span className="num">{formatPhone(phone)}</span>
        </a>
      ) : (
        <p className="text-muted-foreground">No phone number yet.</p>
      )}

      {scripts.length ? (
        <section aria-labelledby="script-heading" className="flex flex-col gap-2">
          <h3 id="script-heading" className="font-semibold">
            Script
          </h3>
          <div role="tablist" aria-label="Scripts" className="flex flex-wrap gap-1.5">
            {scripts.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === script?.id}
                onClick={() => setScriptId(s.id)}
                className={cn(
                  "text-small inline-flex h-7 items-center rounded-full border px-3",
                  s.id === script?.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card hover:bg-muted",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
          {script ? (
            <div role="tabpanel" aria-label={script.name} className="border-border rounded-lg border p-3">
              <Filled script={script.filled} />
              {script.filled.missing.length ? (
                <p className="text-caption text-muted-foreground mt-2">
                  Unknown: {script.filled.missing.join(", ")}. Say it without that detail.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="log-heading" className="flex flex-col gap-3">
        <h3 id="log-heading" className="font-semibold">
          Log the call
        </h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`notes-${companyId}`}>Notes</Label>
          <Textarea
            id={`notes-${companyId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={4000}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={dm}
              onChange={(e) => setDm(e.target.checked)}
              className="accent-primary size-4"
            />
            Spoke with the decision maker
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`next-${companyId}`}>Next step (optional)</Label>
            <Input
              id={`next-${companyId}`}
              type="datetime-local"
              value={nextAt}
              onChange={(e) => setNextAt(e.target.value)}
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`next-note-${companyId}`}>About</Label>
            <Input
              id={`next-note-${companyId}`}
              value={nextNote}
              onChange={(e) => setNextNote(e.target.value)}
              maxLength={300}
              className="w-48"
              placeholder="Ask for Sam"
            />
          </div>
        </div>
        <div role="group" aria-label="Disposition" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DISPOSITIONS.map((d) => (
            <Button
              key={d.value}
              variant={
                d.value === "do_not_call"
                  ? "destructive"
                  : d.value === "conversation" || d.value === "audit_booked"
                    ? "default"
                    : "outline"
              }
              disabled={pending}
              onClick={() => choose(d.value)}
              aria-keyshortcuts={d.key}
              className="justify-between"
            >
              {d.value === "do_not_call" && confirmDnc ? "Press 9 again" : d.label}
              <Kbd aria-hidden="true">{d.key}</Kbd>
            </Button>
          ))}
        </div>
        {confirmDnc ? (
          <p role="alert" className="text-small text-destructive-text">
            Do not call is permanent. Press 9 again within 3 seconds to confirm.
          </p>
        ) : null}
        <p className="text-caption text-muted-foreground">
          Press 1–9 to log. Without a next step, the app suggests one (for example the next business day).
        </p>
      </section>

      {objections.length ? (
        <section aria-labelledby="objections-heading" className="flex flex-col gap-2">
          <h3 id="objections-heading" className="font-semibold">
            Objections
          </h3>
          <ul className="flex flex-col gap-1.5">
            {objections.map((o) => (
              <li key={o.id}>
                <details className="border-border rounded-lg border px-3 py-2">
                  <summary className="cursor-pointer font-medium">
                    {o.title}{" "}
                    <span className="text-muted-foreground text-small font-normal">
                      (heard {o.timesHeard}×)
                    </span>
                  </summary>
                  <div className="flex flex-col gap-2 pt-2">
                    <Filled script={o.filled} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="self-start"
                      onClick={async () => {
                        const res = await objectionHeardAction(o.id);
                        if (!res.ok) toast.error(res.error);
                      }}
                    >
                      Heard it on this call
                    </Button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
