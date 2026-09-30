"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { closePilotAction, startPilotAction } from "@/app/(app)/pilots/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SLOTS = [0, 1, 2];

export function StartPilotForm({
  firms,
  today,
  preset,
}: {
  firms: { id: string; name: string }[];
  today: string;
  preset?: string | undefined;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label="Start a pilot"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const vacancies = SLOTS.map((i) => ({
          label: String(f.get(`label-${i}`) ?? ""),
          baselineDaysOnMarket: f.get(`baseline-${i}`) ? Number(f.get(`baseline-${i}`)) : null,
        })).filter((v) => v.label.trim());
        start(async () => {
          const res = await startPilotAction({
            companyId: String(f.get("companyId")),
            day0: String(f.get("day0")),
            vacancies,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          form.reset();
          toast.success("Pilot started");
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="pilot-firm">Firm</Label>
          <select
            id="pilot-firm"
            name="companyId"
            defaultValue={firms.some((x) => x.id === preset) ? preset : undefined}
            className="border-input bg-card h-9 max-w-full rounded-lg border px-3"
          >
            {firms.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pilot-day0">Day 0</Label>
          <Input id="pilot-day0" name="day0" type="date" defaultValue={today} required />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium">Vacancies (leave a row blank to skip it)</legend>
        {SLOTS.map((i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`pilot-label-${i}`}>Vacancy {i + 1} label</Label>
              <Input
                id={`pilot-label-${i}`}
                name={`label-${i}`}
                placeholder={i === 0 ? "Unit 1A" : undefined}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`pilot-baseline-${i}`}>Usual days on market (optional)</Label>
              <Input id={`pilot-baseline-${i}`} name={`baseline-${i}`} inputMode="numeric" pattern="\d*" />
            </div>
          </div>
        ))}
      </fieldset>
      {error ? (
        <p className="text-small text-destructive-text" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        Start pilot
      </Button>
    </form>
  );
}

export function ClosePilotButton({ pilotId, firmName }: { pilotId: string; firmName: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await closePilotAction({ pilotId });
          if (res.ok) toast.success(`${firmName}: guarantee ${res.data.outcome}`);
          else toast.error(res.error);
        })
      }
    >
      Close pilot
    </Button>
  );
}
