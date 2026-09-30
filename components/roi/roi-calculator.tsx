"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveRoiAction } from "@/app/(app)/roi/actions";
import { Num } from "@/components/num";
import { Estimated } from "@/components/states/estimated";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseRoiQuery, roi, roiFieldError, roiQuery, type RoiInputs } from "@/lib/domain/roi";
import { cn } from "@/lib/utils";

const FIELDS: { key: keyof RoiInputs; label: string; hint: string; prefix?: string }[] = [
  { key: "rent", label: "Monthly rent", hint: "A typical unit", prefix: "$" },
  { key: "turnoversPerYear", label: "Turnovers a year", hint: "Units that become vacant" },
  { key: "daysVacant", label: "Days vacant today", hint: "Average, per turnover" },
  { key: "daysFaster", label: "Days faster to lease", hint: "Your estimate with instant replies" },
  { key: "vacanciesAtOnce", label: "Vacancies at once", hint: "Sets the monthly price" },
];

export function RoiCalculator({
  initial,
  present,
  lead,
}: {
  initial: RoiInputs;
  present: boolean;
  lead: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [inputs, setInputs] = useState<RoiInputs>(initial);
  const [raw, setRaw] = useState<Record<keyof RoiInputs, string>>(
    () =>
      Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])) as Record<
        keyof RoiInputs,
        string
      >,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof RoiInputs, string>>>({});
  const [pending, start] = useTransition();
  // Results come from the same parsed, range-limited values the shared link restores.
  const query = roiQuery(parseRoiQuery(new URLSearchParams(roiQuery(inputs))));
  const r = roi(parseRoiQuery(new URLSearchParams(query)));
  const extra = `${lead ? `&lead=${lead.id}` : ""}`;

  const set = (key: keyof RoiInputs, value: string) => {
    setRaw((prev) => ({ ...prev, [key]: value }));
    const n = Number(value);
    // Out-of-range values are flagged and never used, so the results always match the boxes.
    const problem = value === "" ? "Enter a number." : roiFieldError(key, n);
    setErrors((prev) => ({ ...prev, [key]: problem ?? undefined }));
    if (!problem) {
      const next = { ...inputs, [key]: n };
      setInputs(next);
      router.replace(`${pathname}?${roiQuery(next)}${extra}${present ? "&present=1" : ""}`, {
        scroll: false,
      });
    }
  };

  const big = present ? "text-display font-semibold" : "text-h2 font-semibold";
  const outputs = (
    <dl className={cn("grid gap-4", present ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
      <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
        <dt className={present ? "text-h3" : "text-small text-muted-foreground"}>Each vacant day costs</dt>
        <dd className={big}>
          <Num value={r.dailyCost} format="currency" />
        </dd>
      </div>
      <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
        <dt className={present ? "text-h3" : "text-small text-muted-foreground"}>Lost to vacancy a year</dt>
        <dd className={big}>
          <Num value={r.annualVacancyLoss} format="money" />
        </dd>
      </div>
      <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
        <dt className={present ? "text-h3" : "text-small text-muted-foreground"}>
          Saved a year by leasing faster
        </dt>
        <dd className={big}>
          <Num value={r.annualSavings} format="money" />
        </dd>
      </div>
      <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
        <dt className={present ? "text-h3" : "text-small text-muted-foreground"}>
          Net savings after our fee
        </dt>
        <dd className="flex flex-col gap-1">
          <span className={cn(big, r.netSavings < 0 && "text-destructive-text")}>
            <Num value={r.netSavings} format="money" />
          </span>
          <span className={present ? "text-h3" : "text-small text-muted-foreground"}>
            Fee <Num value={r.monthlyPrice} format="money" /> a month + $300 setup ={" "}
            <Num value={r.annualCost} format="money" /> a year · payback{" "}
            {r.paybackMonths === null ? "never" : <Num value={Math.round(r.paybackMonths * 10) / 10} />}
            {r.paybackMonths === null ? "" : " months"}
          </span>
        </dd>
      </div>
    </dl>
  );

  if (present) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-h2 font-semibold">
            {lead ? `What vacancy costs ${lead.name}` : "What vacancy costs you"}
          </p>
          <Link href={`${pathname}?${query}${extra}`} className={cn(buttonVariants({ variant: "outline" }))}>
            Exit present mode
          </Link>
        </div>
        <p className="text-h3">
          <Num value={inputs.rent} format="money" /> rent · <Num value={inputs.turnoversPerYear} /> turnovers
          a year · <Num value={inputs.daysVacant} /> days vacant · <Num value={inputs.daysFaster} /> days
          faster
        </p>
        {outputs}
        <p className="text-h3 text-muted-foreground">Estimated. Your real numbers will differ.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form
        className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
        onSubmit={(e) => e.preventDefault()}
        aria-label="ROI inputs"
      >
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`roi-${f.key}`}>{f.label}</Label>
            <Input
              id={`roi-${f.key}`}
              inputMode="decimal"
              value={raw[f.key]}
              onChange={(e) => set(f.key, e.target.value.replace(/[^\d.]/g, ""))}
              aria-describedby={`roi-${f.key}-hint${errors[f.key] ? ` roi-${f.key}-error` : ""}`}
              aria-invalid={errors[f.key] ? true : undefined}
              className="num"
            />
            <p id={`roi-${f.key}-hint`} className="text-caption text-muted-foreground">
              {f.hint}
            </p>
            {errors[f.key] ? (
              <p id={`roi-${f.key}-error`} className="text-caption text-destructive-text">
                {errors[f.key]} The results still use {inputs[f.key].toLocaleString("en-US")}.
              </p>
            ) : null}
          </div>
        ))}
      </form>
      <div className="flex min-w-0 flex-col gap-4">
        <Estimated>
          <span className="text-small text-muted-foreground">
            All results are estimates from your inputs.
          </span>
        </Estimated>
        {outputs}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const url = `${window.location.origin}${pathname}?${query}`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Link copied. It opens on this Mac only.");
              } catch {
                toast.message(url);
              }
            }}
          >
            Copy link
          </Button>
          <Link
            href={`${pathname}?${query}${extra}&present=1`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Present
          </Link>
          {lead ? (
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await saveRoiAction({ companyId: lead.id, query });
                  if (res.ok) toast.success(`Saved for ${res.data.name}. Call prep will quote it.`);
                  else toast.error(res.error);
                })
              }
            >
              Save for {lead.name}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
