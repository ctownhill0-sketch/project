"use client";

import { useId, useState, useTransition, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { saveDayAction } from "@/app/(app)/pilots/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { key: "inquiries", label: "Inquiries", nullable: false },
  { key: "medianReplySeconds", label: "Median reply (s)", nullable: true },
  { key: "p90ReplySeconds", label: "P90 reply (s)", nullable: true },
  { key: "tours", label: "Tours", nullable: false },
  { key: "applications", label: "Applications", nullable: false },
  { key: "escalations", label: "Escalations", nullable: false },
  { key: "fairHousingFlags", label: "Fair-housing flags", nullable: false },
  { key: "humanMinutes", label: "Human minutes", nullable: false },
] as const;
type Key = (typeof FIELDS)[number]["key"];
type Values = Record<Key, string>;

export interface EntryVacancy {
  id: string;
  label: string;
  metrics: ({ day: string } & Record<Key, number | null>)[];
}

const blank = (): Values => Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Values;
const fromMetric = (m: Record<Key, number | null> | undefined): Values =>
  m
    ? (Object.fromEntries(FIELDS.map((f) => [f.key, m[f.key] === null ? "" : String(m[f.key])])) as Values)
    : blank();

/**
 * One day's numbers for every vacancy in a pilot. Tab moves across, the arrow keys move up and
 * down a column, and Enter saves.
 */
export function DayEntry({
  pilotId,
  firmName,
  days,
  defaultDay,
  vacancies,
}: {
  pilotId: string;
  firmName: string;
  days: string[];
  defaultDay: string;
  vacancies: EntryVacancy[];
}) {
  const id = useId();
  const load = (day: string) =>
    Object.fromEntries(vacancies.map((v) => [v.id, fromMetric(v.metrics.find((m) => m.day === day))]));
  const [day, setDay] = useState(defaultDay);
  const [values, setValues] = useState<Record<string, Values>>(() => load(defaultDay));
  const [pending, start] = useTransition();

  const move = (e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const next = document.getElementById(`${id}-${row + (e.key === "ArrowDown" ? 1 : -1)}-${col}`);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <form
      aria-label={`Daily numbers for ${firmName}`}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const rows = vacancies.map((v) => {
          const val = values[v.id] ?? blank();
          return {
            vacancyId: v.id,
            ...Object.fromEntries(
              FIELDS.map((f) => [f.key, val[f.key] === "" ? (f.nullable ? null : 0) : Number(val[f.key])]),
            ),
          };
        });
        start(async () => {
          const res = await saveDayAction({ pilotId, day, rows });
          if (res.ok) toast.success(`Saved ${day} for ${firmName}`);
          else toast.error(res.error);
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-day`}>Day</Label>
          <select
            id={`${id}-day`}
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setValues(load(e.target.value));
            }}
            className="border-input bg-card h-9 rounded-lg border px-3"
          >
            {days.map((d, i) => (
              <option key={d} value={d}>
                Day {i} · {d}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Save day
        </Button>
      </div>
      <div
        className="relative overflow-x-auto"
        role="region"
        aria-label={`${firmName} daily numbers table`}
        tabIndex={0}
      >
        <table className="text-small w-full min-w-[880px]">
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Vacancy
              </th>
              {FIELDS.map((f) => (
                <th key={f.key} scope="col" className="px-2 py-1.5 text-left font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vacancies.map((v, row) => (
              <tr key={v.id} className="border-border border-t">
                <th scope="row" className="px-2 py-1.5 text-left font-medium">
                  {v.label}
                </th>
                {FIELDS.map((f, col) => (
                  <td key={f.key} className="px-2 py-1.5">
                    <Input
                      id={`${id}-${row}-${col}`}
                      inputMode="numeric"
                      aria-label={`${v.label} ${f.label}`}
                      placeholder={f.nullable ? "unknown" : "0"}
                      className="num h-8 w-24"
                      value={values[v.id]?.[f.key] ?? ""}
                      onKeyDown={(e) => move(e, row, col)}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, "");
                        setValues((prev) => ({
                          ...prev,
                          [v.id]: { ...(prev[v.id] ?? blank()), [f.key]: clean },
                        }));
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
