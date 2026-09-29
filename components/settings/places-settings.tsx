"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { savePlacesCapsAction, testPlacesKeyAction } from "@/app/(app)/settings/actions";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PlacesSettingsProps {
  key_: { configured: boolean; last4: string | null; mode: "live" | "fixtures" };
  caps: { search: { daily: number; monthly: number }; details: { daily: number; monthly: number } };
}

export function PlacesSettings({ key_, caps }: PlacesSettingsProps) {
  const [pending, start] = useTransition();
  const [values, setValues] = useState({
    searchDaily: String(caps.search.daily),
    searchMonthly: String(caps.search.monthly),
    detailsDaily: String(caps.details.daily),
    detailsMonthly: String(caps.details.monthly),
  });
  const field = (id: keyof typeof values, label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`cap-${id}`}>{label}</Label>
      <Input
        id={`cap-${id}`}
        inputMode="numeric"
        value={values[id]}
        onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value.replace(/\D/g, "") }))}
        className="num w-32"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {key_.configured ? (
          <p className="text-success inline-flex items-center gap-1.5 font-medium">
            <Icons.success className="size-4" />
            {key_.mode === "fixtures" ? "Demo mode: recorded Google responses" : "Key found"}
          </p>
        ) : (
          <p className="text-destructive-text inline-flex items-center gap-1.5 font-medium">
            <Icons.error className="size-4" />
            No key
          </p>
        )}
        {key_.last4 && key_.mode === "live" ? (
          <p className="text-muted-foreground">
            Ends in <span className="num text-foreground">{key_.last4}</span>
          </p>
        ) : null}
        <Button
          variant="outline"
          disabled={pending || !key_.configured}
          onClick={() =>
            start(async () => {
              const res = await testPlacesKeyAction();
              if (res.ok) toast.success(res.data.message);
              else toast.error(res.error);
            })
          }
        >
          Test key
        </Button>
        <span className="text-small text-muted-foreground">Uses one free request (IDs only).</span>
      </div>

      <ol className="text-small flex list-decimal flex-col gap-1.5 pl-5">
        <li>
          Create a key in Google Cloud (APIs &amp; Services → Credentials), and enable{" "}
          <span className="font-medium">Places API (New)</span>.
        </li>
        <li>
          <span className="font-medium">Restrict the key</span> to Places API (New) only (API restrictions →
          Restrict key).
        </li>
        <li>
          <span className="font-medium">Set a $1 budget alert</span> (Billing → Budgets &amp; alerts) as a
          backstop.
        </li>
        <li>
          Put it in <code className="bg-muted rounded px-1">.env.local</code> as{" "}
          <code className="bg-muted rounded px-1">GOOGLE_PLACES_API_KEY=…</code> and restart{" "}
          <code className="bg-muted rounded px-1">pnpm dev</code>. The key is never stored in the database,
          logged or sent to the browser.
        </li>
      </ol>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await savePlacesCapsAction(values);
            if (res.ok) toast.success("Caps saved");
            else toast.error(res.error);
          });
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">
            Search caps (Text Search, $35 per 1,000 after 1,000 free a month)
          </legend>
          <div className="flex flex-wrap gap-4">
            {field("searchDaily", "Per day")}
            {field("searchMonthly", "Per month")}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">
            Review lookup caps ($25 per 1,000 after 1,000 free a month)
          </legend>
          <div className="flex flex-wrap gap-4">
            {field("detailsDaily", "Per day")}
            {field("detailsMonthly", "Per month")}
          </div>
        </fieldset>
        <p className="text-small text-muted-foreground">
          When a cap is reached, searches stop with a message. Nothing more is sent until the next day or
          month.
        </p>
        <Button type="submit" disabled={pending} className="self-start">
          Save caps
        </Button>
      </form>
    </div>
  );
}
