"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  addExclusionAction,
  addSoftwarePatternAction,
  deleteDemoDataAction,
  saveBrandAction,
  saveHoursAction,
  saveThresholdsAction,
  saveWeekAction,
  saveWeightsAction,
  setListItemActiveAction,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/actions/result";

const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
] as const;

/** A form that sends its fields to one action and reports the result inline. */
function useSave<T>(action: (raw: unknown) => Promise<ActionResult<T>>, success: (data: T) => string) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (payload: unknown, after?: () => void) =>
    start(async () => {
      const res = await action(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success(success(res.data));
      after?.();
    });
  return { pending, error, save };
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p className="text-small text-destructive-text" role="alert">
      {error}
    </p>
  ) : null;
}

function DayPicker({ name, legend, value }: { name: string; legend: string; value: number[] }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-small mb-1.5 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {DAYS.map(([n, label]) => (
          <label key={n} className="text-small inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              name={name}
              value={n}
              defaultChecked={value.includes(n)}
              className="accent-primary size-4"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const days = (f: FormData, name: string) => f.getAll(name).map(Number);
const text = (f: FormData, name: string) => String(f.get(name) ?? "");
const numOrNull = (f: FormData, name: string) => (text(f, name).trim() === "" ? null : Number(text(f, name)));

// ---------------------------------------------------------------------------------------------

const WEIGHT_LABELS: Record<string, string> = {
  notAppfolio: "Not on AppFolio",
  noSoftware: "No leasing software",
  listings3to25: "3 to 25 live listings",
  slowReply: "Slow or no reply to a shop",
  units50to500: "50 to 500 units",
  local: "In a target metro",
  reviewSignals: "Reviews mention slow replies",
  chainOrNotFit: "Chain or not a fit (negative)",
};

export function WeightsForm({ weights }: { weights: Record<string, number> }) {
  const id = useId();
  const { pending, error, save } = useSave(
    saveWeightsAction,
    (d) => `Weights saved. ${d.rescored} leads rescored.`,
  );
  return (
    <form
      aria-label="Scoring weights"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(WEIGHT_LABELS).map(([key, label]) => (
          <Field key={key} id={`${id}-${key}`} label={label}>
            <Input
              id={`${id}-${key}`}
              name={key}
              inputMode="numeric"
              defaultValue={weights[key]}
              className="num"
            />
          </Field>
        ))}
      </div>
      <ErrorLine error={error} />
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        Save weights and rescore
      </Button>
    </form>
  );
}

export function HoursForm({
  hours,
}: {
  hours: {
    days: number[];
    start: string;
    end: string;
    saturdayBucket: boolean;
    holidaysAreAfterHours: boolean;
  };
}) {
  const id = useId();
  const { pending, error, save } = useSave(
    saveHoursAction,
    (d) => `Hours saved. ${d.changed} shops moved bucket.`,
  );
  return (
    <form
      aria-label="Business hours"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          days: days(f, "days"),
          start: text(f, "start"),
          end: text(f, "end"),
          saturdayBucket: f.get("saturdayBucket") === "on",
          holidaysAreAfterHours: f.get("holidays") === "on",
        });
      }}
    >
      <DayPicker name="days" legend="Business days" value={hours.days} />
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <Field id={`${id}-start`} label="Opens">
          <Input id={`${id}-start`} name="start" type="time" defaultValue={hours.start} />
        </Field>
        <Field id={`${id}-end`} label="Closes">
          <Input id={`${id}-end`} name="end" type="time" defaultValue={hours.end} />
        </Field>
      </div>
      <label className="text-small inline-flex items-center gap-2">
        <input
          type="checkbox"
          name="saturdayBucket"
          defaultChecked={hours.saturdayBucket}
          className="accent-primary size-4"
        />
        Saturday is its own bucket
      </label>
      <label className="text-small inline-flex items-center gap-2">
        <input
          type="checkbox"
          name="holidays"
          defaultChecked={hours.holidaysAreAfterHours}
          className="accent-primary size-4"
        />
        US federal holidays count as after hours
      </label>
      <ErrorLine error={error} />
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        Save hours
      </Button>
    </form>
  );
}

export interface Thresholds {
  killTest: {
    day0: string;
    deadline: string;
    pilotsTarget: number;
    conversationsTarget: number;
    afterHoursMedianMinutes: number;
  };
  guarantee: { tourTarget: number; medianReplySeconds: number; atRiskFromDay: number; pilotDays: number };
  callBlocks: { days: number[]; start: string; end: string };
}

export function ThresholdsForm({ t }: { t: Thresholds }) {
  const id = useId();
  const { pending, error, save } = useSave(saveThresholdsAction, () => "Thresholds saved");
  return (
    <form
      aria-label="Thresholds"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          killTest: {
            day0: text(f, "day0"),
            deadline: text(f, "deadline"),
            pilotsTarget: text(f, "pilotsTarget"),
            conversationsTarget: text(f, "conversationsTarget"),
            afterHoursMedianMinutes: text(f, "afterHours"),
          },
          guarantee: {
            tourTarget: text(f, "tourTarget"),
            medianReplySeconds: text(f, "medianReply"),
            atRiskFromDay: text(f, "atRisk"),
            pilotDays: text(f, "pilotDays"),
          },
          callBlocks: { days: days(f, "blockDays"), start: text(f, "blockStart"), end: text(f, "blockEnd") },
        });
      }}
    >
      <h3 className="font-semibold">Day-90 kill test</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field id={`${id}-day0`} label="Day 0">
          <Input id={`${id}-day0`} name="day0" type="date" defaultValue={t.killTest.day0} />
        </Field>
        <Field id={`${id}-deadline`} label="Deadline">
          <Input id={`${id}-deadline`} name="deadline" type="date" defaultValue={t.killTest.deadline} />
        </Field>
        <Field id={`${id}-pilots`} label="Pilots target">
          <Input
            id={`${id}-pilots`}
            name="pilotsTarget"
            inputMode="numeric"
            defaultValue={t.killTest.pilotsTarget}
          />
        </Field>
        <Field id={`${id}-conv`} label="Conversations target">
          <Input
            id={`${id}-conv`}
            name="conversationsTarget"
            inputMode="numeric"
            defaultValue={t.killTest.conversationsTarget}
          />
        </Field>
        <Field id={`${id}-ah`} label="After-hours median (min)">
          <Input
            id={`${id}-ah`}
            name="afterHours"
            inputMode="numeric"
            defaultValue={t.killTest.afterHoursMedianMinutes}
          />
        </Field>
      </div>
      <h3 className="font-semibold">Pilot guarantee</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={`${id}-tours`} label="Tours per vacancy">
          <Input
            id={`${id}-tours`}
            name="tourTarget"
            inputMode="numeric"
            defaultValue={t.guarantee.tourTarget}
          />
        </Field>
        <Field id={`${id}-median`} label="Median reply under (s)">
          <Input
            id={`${id}-median`}
            name="medianReply"
            inputMode="numeric"
            defaultValue={t.guarantee.medianReplySeconds}
          />
        </Field>
        <Field id={`${id}-risk`} label="At risk from day">
          <Input
            id={`${id}-risk`}
            name="atRisk"
            inputMode="numeric"
            defaultValue={t.guarantee.atRiskFromDay}
          />
        </Field>
        <Field id={`${id}-days`} label="Pilot length (days)">
          <Input
            id={`${id}-days`}
            name="pilotDays"
            inputMode="numeric"
            defaultValue={t.guarantee.pilotDays}
          />
        </Field>
      </div>
      <h3 className="font-semibold">Call blocks</h3>
      <DayPicker name="blockDays" legend="Call-block days" value={t.callBlocks.days} />
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <Field id={`${id}-bs`} label="Block starts">
          <Input id={`${id}-bs`} name="blockStart" type="time" defaultValue={t.callBlocks.start} />
        </Field>
        <Field id={`${id}-be`} label="Block ends">
          <Input id={`${id}-be`} name="blockEnd" type="time" defaultValue={t.callBlocks.end} />
        </Field>
      </div>
      <ErrorLine error={error} />
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        Save thresholds
      </Button>
    </form>
  );
}

export function BrandForm({ wordmark, shopperName }: { wordmark: string; shopperName: string }) {
  const id = useId();
  const { pending, error, save } = useSave(saveBrandAction, () => "Brand saved");
  return (
    <form
      aria-label="Brand"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({ wordmark: text(f, "wordmark"), shopperName: text(f, "shopperName") });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${id}-wordmark`} label="Wordmark" hint="Shown on the audit PDF.">
          <Input id={`${id}-wordmark`} name="wordmark" defaultValue={wordmark} maxLength={40} />
        </Field>
        <Field
          id={`${id}-shopper`}
          label="Your real name, for mystery shops"
          hint="Shops always use your real name."
        >
          <Input id={`${id}-shopper`} name="shopperName" defaultValue={shopperName} maxLength={80} />
        </Field>
      </div>
      <ErrorLine error={error} />
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        Save brand
      </Button>
    </form>
  );
}

export function WeekForm({ monday }: { monday: string }) {
  const id = useId();
  const { pending, error, save } = useSave(saveWeekAction, () => "Week saved");
  return (
    <form
      aria-label="This week's numbers"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          weekStart: text(f, "weekStart"),
          mrr: text(f, "mrr") || 0,
          cash: numOrNull(f, "cash"),
          netBurn: numOrNull(f, "netBurn"),
          paidClients: text(f, "paidClients") || 0,
          insuranceStudyHours: text(f, "study") || 0,
          notes: text(f, "notes") || null,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field id={`${id}-week`} label="Week of">
          <Input id={`${id}-week`} name="weekStart" type="date" defaultValue={monday} />
        </Field>
        <Field id={`${id}-mrr`} label="MRR ($)">
          <Input id={`${id}-mrr`} name="mrr" inputMode="decimal" />
        </Field>
        <Field id={`${id}-cash`} label="Cash ($)">
          <Input id={`${id}-cash`} name="cash" inputMode="decimal" />
        </Field>
        <Field id={`${id}-burn`} label="Net burn ($)">
          <Input id={`${id}-burn`} name="netBurn" inputMode="decimal" />
        </Field>
        <Field id={`${id}-clients`} label="Paying clients">
          <Input id={`${id}-clients`} name="paidClients" inputMode="numeric" />
        </Field>
        <Field id={`${id}-study`} label="Insurance study (h)">
          <Input id={`${id}-study`} name="study" inputMode="decimal" />
        </Field>
      </div>
      <Field id={`${id}-notes`} label="Notes (optional)">
        <Input id={`${id}-notes`} name="notes" maxLength={500} />
      </Field>
      <ErrorLine error={error} />
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        Save week
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
// Rule lists

export interface ListItem {
  id: string;
  title: string;
  detail: string;
  isActive: boolean;
}

export function RuleList({
  list,
  label,
  items,
}: {
  list: "software" | "exclusion";
  label: string;
  items: ListItem[];
}) {
  const [pending, start] = useTransition();
  return (
    <ul
      aria-label={label}
      className="border-border divide-border max-h-80 divide-y overflow-y-auto rounded-lg border"
    >
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-small font-medium break-all">{item.title}</span>
            <span className="text-caption text-muted-foreground">
              {item.detail}
              {item.isActive ? "" : " · Off"}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={`${item.isActive ? "Turn off" : "Turn on"} ${item.title}`}
            onClick={() =>
              start(async () => {
                const res = await setListItemActiveAction({ list, id: item.id, isActive: !item.isActive });
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            {item.isActive ? "Turn off" : "Turn on"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

const SOFTWARE = [
  ["appfolio", "AppFolio"],
  ["buildium", "Buildium"],
  ["doorloop", "DoorLoop"],
  ["rent_manager", "Rent Manager"],
  ["yardi", "Yardi"],
  ["propertyware", "Propertyware"],
  ["rentvine", "Rentvine"],
  ["tenantcloud", "TenantCloud"],
  ["other", "Other"],
] as const;

export function SoftwarePatternForm() {
  const id = useId();
  const { pending, error, save } = useSave(addSoftwarePatternAction, () => "Pattern added");
  return (
    <form
      aria-label="Add a software pattern"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        save({ software: text(f, "software"), pattern: text(f, "pattern"), kind: text(f, "kind") }, () =>
          form.reset(),
        );
      }}
    >
      <Field id={`${id}-sw`} label="Software">
        <select id={`${id}-sw`} name="software" className="border-input bg-card h-9 rounded-lg border px-3">
          {SOFTWARE.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-kind`} label="Match">
        <select id={`${id}-kind`} name="kind" className="border-input bg-card h-9 rounded-lg border px-3">
          <option value="domain">Link domain</option>
          <option value="substring">Text on the page</option>
        </select>
      </Field>
      <Field id={`${id}-pattern`} label="Pattern">
        <Input id={`${id}-pattern`} name="pattern" placeholder="managebuilding.com" required />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>
        Add pattern
      </Button>
      <div className="basis-full">
        <ErrorLine error={error} />
      </div>
    </form>
  );
}

export function ExclusionForm() {
  const id = useId();
  const { pending, error, save } = useSave(addExclusionAction, () => "Exclusion added");
  return (
    <form
      aria-label="Add an exclusion"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        save(
          {
            kind: text(f, "kind"),
            match: text(f, "match"),
            pattern: text(f, "pattern"),
            category: text(f, "category") || null,
          },
          () => form.reset(),
        );
      }}
    >
      <Field id={`${id}-kind`} label="Kind">
        <select id={`${id}-kind`} name="kind" className="border-input bg-card h-9 rounded-lg border px-3">
          <option value="chain">Chain (too big)</option>
          <option value="not_a_fit">Not a fit</option>
        </select>
      </Field>
      <Field id={`${id}-match`} label="Match on">
        <select id={`${id}-match`} name="match" className="border-input bg-card h-9 rounded-lg border px-3">
          <option value="name">Name</option>
          <option value="domain">Website domain</option>
          <option value="type">Google place type</option>
        </select>
      </Field>
      <Field id={`${id}-pattern`} label="Pattern">
        <Input id={`${id}-pattern`} name="pattern" required />
      </Field>
      <Field id={`${id}-cat`} label="Category (optional)">
        <Input id={`${id}-cat`} name="category" placeholder="hoa" />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>
        Add exclusion
      </Button>
      <div className="basis-full">
        <ErrorLine error={error} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------

export function DeleteDemoData({ companies, weeks }: { companies: number; weeks: number }) {
  const id = useId();
  const [confirm, setConfirm] = useState("");
  const { pending, error, save } = useSave(
    deleteDemoDataAction,
    (d) => `Deleted ${d.companies} demo firms and ${d.weeks} demo weeks.`,
  );
  if (companies === 0 && weeks === 0)
    return <p className="text-small text-muted-foreground">No demo data left. Everything here is yours.</p>;
  return (
    <form
      aria-label="Delete demo data"
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save({ confirm }, () => setConfirm(""));
      }}
    >
      <p className="text-small">
        Removes {companies} fictional firms (reserved <span className="font-medium">.example</span> domains
        and 555-01xx phones) with their shops, calls, deals, pilots and audits, and {weeks} demo weeks. Your
        own leads, settings, rules and scripts stay. This can&apos;t be undone.
      </p>
      <Field id={`${id}-confirm`} label="Type DELETE DEMO DATA to confirm">
        <Input
          id={`${id}-confirm`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <ErrorLine error={error} />
      <Button
        type="submit"
        variant="destructive"
        className="self-start"
        disabled={pending || confirm !== "DELETE DEMO DATA"}
      >
        Delete demo data
      </Button>
    </form>
  );
}
