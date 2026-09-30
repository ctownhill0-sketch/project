"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  checkTextAction,
  saveRuleAction,
  saveScriptAction,
  setRuleActiveAction,
} from "@/app/(app)/settings/fair-housing/actions";
import { CheckResult, type CheckView } from "@/components/compliance/check-result";
import { categoryLabel } from "@/lib/compliance/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function Tester() {
  const id = useId();
  const [text, setText] = useState("");
  const [check, setCheck] = useState<CheckView | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await checkTextAction({ text });
            if (res.ok) setCheck(res.data);
            else toast.error(res.error);
          });
        }}
      >
        <Label htmlFor={`${id}-text`}>Text to check</Label>
        <Textarea
          id={`${id}-text`}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a listing, a script or an email."
        />
        <Button type="submit" className="self-start" disabled={pending}>
          Check text
        </Button>
      </form>
      {check ? <CheckResult key={check.id} check={check} /> : null}
    </div>
  );
}

export function ScriptEditor({ script }: { script: { id: string; name: string; body: string } }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(script.body);
  const [check, setCheck] = useState<CheckView | null>(null);
  const [pending, start] = useTransition();

  const save = (overrideReason?: string) =>
    start(async () => {
      const res = await saveScriptAction({ id: script.id, body, overrideReason });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.saved) {
        toast.success(`${script.name} saved`);
        setCheck(null);
        setEditing(false);
      } else setCheck(res.data.check);
    });

  if (!editing)
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${script.name}`}>
        Edit
      </Button>
    );
  return (
    <div className="flex w-full flex-col gap-2">
      <Label htmlFor={`${id}-body`}>{script.name} wording</Label>
      <Textarea
        id={`${id}-body`}
        rows={4}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          // A result (and any override) only ever applies to the text it was checked on.
          setCheck(null);
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => save()}>
          Check and save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setBody(script.body);
            setCheck(null);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
      {check ? (
        <CheckResult
          key={check.id}
          check={check}
          overrideLabel="Override and save"
          deferOverride
          onOverridden={(reason) => save(reason)}
        />
      ) : null}
    </div>
  );
}

export interface RuleRow {
  id: string;
  pattern: string;
  category: string;
  severity: "warn" | "block";
  explanation: string;
  saferRewrite: string | null;
  isActive: boolean;
}

export function RuleForm({ rule, onDone }: { rule?: RuleRow; onDone?: () => void }) {
  const id = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      aria-label={rule ? `Edit rule ${rule.pattern}` : "Add a rule"}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        start(async () => {
          const res = await saveRuleAction({
            id: rule?.id,
            pattern: String(f.get("pattern") ?? ""),
            category: String(f.get("category") ?? ""),
            severity: f.get("severity") === "block" ? "block" : "warn",
            explanation: String(f.get("explanation") ?? ""),
            saferRewrite: String(f.get("saferRewrite") ?? "") || null,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          toast.success(rule ? "Rule saved" : "Rule added");
          if (!rule) form.reset();
          onDone?.();
        });
      }}
    >
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label htmlFor={`${id}-pattern`}>Pattern (regular expression, not case-sensitive)</Label>
        <Input
          id={`${id}-pattern`}
          name="pattern"
          defaultValue={rule?.pattern}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error ? (
          <p id={`${id}-error`} className="text-small text-destructive-text">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-category`}>Category</Label>
        <Input
          id={`${id}-category`}
          name="category"
          defaultValue={rule?.category ?? "source_of_income"}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-severity`}>Severity</Label>
        <select
          id={`${id}-severity`}
          name="severity"
          defaultValue={rule?.severity ?? "warn"}
          className="border-input bg-card h-9 rounded-lg border px-3"
        >
          <option value="warn">Warn (can override with a reason)</option>
          <option value="block">Block (must change the wording)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-explanation`}>Why it&apos;s a problem</Label>
        <Input id={`${id}-explanation`} name="explanation" defaultValue={rule?.explanation} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-rewrite`}>Safer wording (optional)</Label>
        <Input id={`${id}-rewrite`} name="saferRewrite" defaultValue={rule?.saferRewrite ?? ""} />
      </div>
      <Button type="submit" variant={rule ? "outline" : "default"} className="self-start" disabled={pending}>
        {rule ? "Save rule" : "Add rule"}
      </Button>
    </form>
  );
}

export function RuleItem({ rule }: { rule: RuleRow }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-small font-medium break-all">{rule.pattern}</span>
          <p className="text-small text-muted-foreground">
            {categoryLabel(rule.category)} · {rule.severity === "block" ? "Blocks" : "Warns"}
            {rule.isActive ? "" : " · Off"} · {rule.explanation}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            aria-label={`${editing ? "Close" : "Edit"} rule ${rule.pattern}`}
          >
            {editing ? "Close" : "Edit"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            aria-label={`${rule.isActive ? "Turn off" : "Turn on"} rule ${rule.pattern}`}
            onClick={() =>
              start(async () => {
                const res = await setRuleActiveAction({ id: rule.id, isActive: !rule.isActive });
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            {rule.isActive ? "Turn off" : "Turn on"}
          </Button>
        </div>
      </div>
      {editing ? <RuleForm rule={rule} onDone={() => setEditing(false)} /> : null}
    </li>
  );
}
