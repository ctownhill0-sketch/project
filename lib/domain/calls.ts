// Call workspace rules (brief M6): script variables, dispositions on hotkeys 1–9, next steps,
// and the order of today's call list. tel: links only; do-not-call is permanent.
import { nyDayStart } from "@/lib/domain/ny-time";

export type Disposition =
  | "no_answer"
  | "left_voicemail"
  | "gatekeeper"
  | "callback"
  | "conversation"
  | "audit_booked"
  | "not_interested"
  | "wrong_number"
  | "do_not_call";

/** Hotkeys 1–9, in the database enum's order. */
export const DISPOSITIONS: { key: string; value: Disposition; label: string }[] = [
  { key: "1", value: "no_answer", label: "No answer" },
  { key: "2", value: "left_voicemail", label: "Left voicemail" },
  { key: "3", value: "gatekeeper", label: "Gatekeeper" },
  { key: "4", value: "callback", label: "Callback" },
  { key: "5", value: "conversation", label: "Conversation" },
  { key: "6", value: "audit_booked", label: "Audit booked" },
  { key: "7", value: "not_interested", label: "Not interested" },
  { key: "8", value: "wrong_number", label: "Wrong number" },
  { key: "9", value: "do_not_call", label: "Do not call" },
];

export function dispositionForKey(key: string) {
  return DISPOSITIONS.find((d) => d.key === key) ?? null;
}

export type ScriptVars = Record<string, string | number | null | undefined>;

export interface FilledScript {
  text: string;
  parts: { text: string; missing?: boolean; variable?: string }[];
  missing: string[];
}

/** Fills {{variables}}. Anything missing (or unknown to the app) renders as "unknown", flagged. */
export function fillScript(body: string, vars: ScriptVars): FilledScript {
  const parts: FilledScript["parts"] = [];
  const missing: string[] = [];
  let last = 0;
  for (const m of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    if (m.index! > last) parts.push({ text: body.slice(last, m.index) });
    const name = m[1]!;
    const value = vars[name];
    if (value === null || value === undefined || value === "") {
      parts.push({ text: "unknown", missing: true, variable: name });
      if (!missing.includes(name)) missing.push(name);
    } else parts.push({ text: String(value), variable: name });
    last = m.index! + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return { text: parts.map((p) => p.text).join(""), parts, missing };
}

const BUSINESS_DAYS_AFTER: Partial<Record<Disposition, number>> = {
  no_answer: 1,
  gatekeeper: 1,
  callback: 1,
  conversation: 1,
  left_voicemail: 2,
};

function nyWeekday(at: Date): number {
  const w = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(at);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(w) + 1;
}

/** The next business day(s) at the same New York wall time (DST-safe). null = no follow-up. */
export function suggestNextStep(disposition: Disposition, now: Date): Date | null {
  const days = BUSINESS_DAYS_AFTER[disposition];
  if (!days) return null;
  const start = nyDayStart(now);
  const offset = now.getTime() - start.getTime();
  let day = start;
  let added = 0;
  while (added < days) {
    day = nyDayStart(new Date(day.getTime() + 36 * 3_600_000));
    if (nyWeekday(day) <= 5) added += 1;
  }
  return new Date(day.getTime() + offset);
}

export interface CallCandidate {
  companyId: string;
  name: string;
  town: string | null;
  score: number;
  why: string;
  phone: string | null;
  dnc: boolean;
  excluded: boolean;
  lastCalledAt: Date | null;
  /** From the latest call's next step. */
  nextStepAt: Date | null;
  /** Fresh evidence: a mystery shop went unanswered or slow and they haven't been called since. */
  callNow: boolean;
  lastDisposition: Disposition | null;
}

/** After these the firm leaves the call list (it's in the pipeline, or not a prospect). */
const DONE: Disposition[] = ["not_interested", "wrong_number", "audit_booked", "do_not_call"];

export interface CallListItem extends CallCandidate {
  kind: "callback" | "call_now" | "top_score";
  reason: string;
}

const RECENT_MS = 2 * 24 * 3_600_000;

/** Today's calls: callbacks due (oldest first), then call-now firms, then highest score. */
export function buildCallList(
  { now, firms }: { now: Date; firms: CallCandidate[] },
  limit = 200,
): CallListItem[] {
  const callable = firms.filter(
    (f) =>
      f.phone &&
      !f.dnc &&
      !f.excluded &&
      !(f.lastDisposition && DONE.includes(f.lastDisposition) && !f.nextStepAt),
  );
  const due = callable
    .filter((f) => f.nextStepAt && f.nextStepAt.getTime() <= now.getTime())
    .sort((a, b) => a.nextStepAt!.getTime() - b.nextStepAt!.getTime())
    .map((f) => ({ ...f, kind: "callback" as const, reason: "Callback due" }));
  const rest = callable.filter(
    (f) =>
      !f.nextStepAt && // anything scheduled later waits for its time
      (!f.lastCalledAt || now.getTime() - f.lastCalledAt.getTime() > RECENT_MS),
  );
  const hot = rest
    .filter((f) => f.callNow)
    .sort((a, b) => b.score - a.score)
    .map((f) => ({ ...f, kind: "call_now" as const, reason: "Call now: fresh mystery-shop result" }));
  const top = rest
    .filter((f) => !f.callNow)
    .sort((a, b) => b.score - a.score)
    .map((f) => ({ ...f, kind: "top_score" as const, reason: `Score ${f.score}` }));
  return [...due, ...hot, ...top].slice(0, limit);
}
