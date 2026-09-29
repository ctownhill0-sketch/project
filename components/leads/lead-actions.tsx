"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { mergeAction, softwareOverrideAction } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MergeButtons({ a, b }: { a: { id: string; name: string }; b: { id: string; name: string } }) {
  const [pending, start] = useTransition();
  const merge = (keep: typeof a, drop: typeof a) =>
    start(async () => {
      const res = await mergeAction(keep.id, drop.id);
      if (res.ok) toast.success(`Merged into ${keep.name}`);
      else toast.error(res.error);
    });
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={`Merge ${a.name} and ${b.name}`}>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => merge(a, b)}>
        Keep left
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => merge(b, a)}>
        Keep right
      </Button>
    </div>
  );
}

export const SOFTWARE_OPTIONS: { value: string; label: string }[] = [
  { value: "appfolio", label: "AppFolio" },
  { value: "buildium", label: "Buildium" },
  { value: "doorloop", label: "DoorLoop" },
  { value: "rent_manager", label: "Rent Manager" },
  { value: "yardi", label: "Yardi / RentCafe" },
  { value: "propertyware", label: "Propertyware" },
  { value: "rentvine", label: "Rentvine" },
  { value: "tenantcloud", label: "TenantCloud" },
  { value: "other", label: "Other software" },
  { value: "none", label: "No portal" },
  { value: "unknown", label: "Unknown" },
];

/** The founder's own call on a firm's software, with an optional evidence note (brief M1). */
export function SoftwareOverrideForm({
  companyId,
  current,
  compact = false,
}: {
  companyId: string;
  current: string | null;
  compact?: boolean;
}) {
  const [software, setSoftware] = useState(current ?? "");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const id = `sw-${companyId}`;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await softwareOverrideAction({
            companyId,
            software: software || null,
            note: note || null,
          });
          if (res.ok) toast.success("Software saved");
          else toast.error(res.error);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className={compact ? "sr-only" : undefined}>
          Software
        </Label>
        <select
          id={id}
          value={software}
          onChange={(e) => setSoftware(e.target.value)}
          className="border-input bg-card h-9 rounded-lg border px-2"
        >
          <option value="">Use detected</option>
          {SOFTWARE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-note`} className={compact ? "sr-only" : undefined}>
          Evidence (optional)
        </Label>
        <Input
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Where you saw it"
          className="w-48"
          maxLength={500}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
