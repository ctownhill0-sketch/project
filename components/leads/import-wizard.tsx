"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { commitImportAction, previewImportAction } from "@/app/(app)/leads/actions";
import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassifiedRow, ColumnMapping, ImportField } from "@/lib/domain/csv-import";
import { cn } from "@/lib/utils";

const FIELDS: { key: ImportField; label: string }[] = [
  { key: "name", label: "Firm name" },
  { key: "website", label: "Website" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "Town" },
  { key: "state", label: "State" },
  { key: "units", label: "Units (estimated)" },
  { key: "listings", label: "Live listings (estimated)" },
  { key: "software", label: "Software" },
  { key: "rentalsUrl", label: "Rentals page" },
];

const STATUS: Record<ClassifiedRow["status"], string> = {
  new: "New",
  possible_duplicate: "Possible duplicate",
  duplicate: "Duplicate: skipped",
  dnc: "Do not call: skipped",
  error: "Error: skipped",
};

interface Preview {
  headers: string[];
  mapping: ColumnMapping;
  counts: Record<ClassifiedRow["status"], number>;
  rows: ClassifiedRow[];
  total: number;
}

export function ImportWizard({
  savedMappings,
}: {
  savedMappings: { name: string; mapping: ColumnMapping }[];
}) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saveAs, setSaveAs] = useState("");
  const [done, setDone] = useState<{ imported: number; possibleDuplicates: number } | null>(null);
  const [pending, start] = useTransition();

  const runPreview = (text: string, mapping?: ColumnMapping) =>
    start(async () => {
      const res = await previewImportAction({ csvText: text, ...(mapping ? { mapping } : {}) });
      if (res.ok) setPreview(res.data);
      else toast.error(res.error);
    });

  const onFile = async (f: File | undefined) => {
    setDone(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("That file is over 5 MB. Split it into smaller files.");
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    runPreview(text);
  };

  const setField = (header: string, field: ImportField | "") => {
    if (!file || !preview) return;
    const next: ColumnMapping = {};
    for (const [h, f] of Object.entries(preview.mapping)) if (h !== header && f !== field) next[h] = f;
    if (field) next[header] = field;
    runPreview(file.text, next);
  };

  const importable = preview ? preview.counts.new + preview.counts.possible_duplicate : 0;
  const hasName = preview ? Object.values(preview.mapping).includes("name") : false;

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="step-file"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
      >
        <h2 id="step-file" className="font-semibold">
          1. Choose a CSV file
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="csv-file">CSV file (up to 5,000 rows)</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onFile(e.target.files?.[0])}
              className="max-w-sm"
            />
          </div>
          <a href="/sample-leads.csv" download className="text-link text-small underline underline-offset-2">
            Download a sample CSV
          </a>
        </div>
        {savedMappings.length && file ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-small text-muted-foreground">Use a saved mapping:</span>
            {savedMappings.map((m) => (
              <Button
                key={m.name}
                size="sm"
                variant="outline"
                onClick={() => runPreview(file.text, m.mapping)}
                disabled={pending}
              >
                {m.name}
              </Button>
            ))}
          </div>
        ) : null}
      </section>

      {preview ? (
        <section
          aria-labelledby="step-map"
          className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
        >
          <h2 id="step-map" className="font-semibold">
            2. Match the columns
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {preview.headers.map((h, i) => (
              <div key={`${h}-${i}`} className="flex flex-col gap-1.5">
                <Label htmlFor={`map-${i}`}>{h || `Column ${i + 1}`}</Label>
                <select
                  id={`map-${i}`}
                  value={preview.mapping[h] ?? ""}
                  onChange={(e) => setField(h, e.target.value as ImportField | "")}
                  className="border-input bg-card h-9 rounded-lg border px-2"
                >
                  <option value="">Don&apos;t import</option>
                  {FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!hasName ? (
            <p className="text-destructive-text text-small">Match one column to Firm name to continue.</p>
          ) : null}
        </section>
      ) : null}

      {preview && hasName ? (
        <section
          aria-labelledby="step-preview"
          className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
        >
          <h2 id="step-preview" className="font-semibold">
            3. Check the first 20 rows
          </h2>
          <p className="text-small" aria-live="polite">
            <Num value={preview.total} /> rows: <Num value={preview.counts.new} /> new,{" "}
            <Num value={preview.counts.possible_duplicate} /> possible duplicates (imported, then shown on the
            merge screen), <Num value={preview.counts.duplicate} /> duplicates,{" "}
            <Num value={preview.counts.dnc} /> do not call and <Num value={preview.counts.error} /> with
            errors (all skipped).
          </p>
          <div className="relative overflow-x-auto" role="region" aria-label="Preview rows" tabIndex={0}>
            <table className="text-small w-full">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Line
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Firm
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Website
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Town
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-border border-t align-top">
                    <td className="num px-3 py-2">{r.line}</td>
                    <td className="px-3 py-2">
                      {r.record.name || <span className="text-muted-foreground">missing</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.record.domain ?? <span className="text-muted-foreground">unknown</span>}
                    </td>
                    <td className="px-3 py-2">
                      {[r.record.city, r.record.state].filter(Boolean).join(", ") || (
                        <span className="text-muted-foreground">unknown</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "font-medium",
                          r.status === "dnc" || r.status === "error" ? "text-destructive-text" : "",
                        )}
                      >
                        {STATUS[r.status]}
                      </span>
                      {r.reason ? <span className="text-muted-foreground block">{r.reason}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border flex flex-wrap items-end gap-3 border-t pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="save-mapping">Save this column match as (optional)</Label>
              <Input
                id="save-mapping"
                value={saveAs}
                onChange={(e) => setSaveAs(e.target.value)}
                placeholder="My scraper"
                className="w-56"
              />
            </div>
            <Button
              disabled={pending || importable === 0}
              onClick={() =>
                start(async () => {
                  const res = await commitImportAction({
                    fileName: file!.name,
                    csvText: file!.text,
                    mapping: preview.mapping,
                    saveMappingAs: saveAs || null,
                  });
                  if (!res.ok) return void toast.error(res.error);
                  setDone(res.data);
                  toast.success(`Imported ${res.data.imported} leads`);
                })
              }
            >
              <Icons.leads data-icon="inline-start" />
              Import {importable} leads
            </Button>
          </div>
        </section>
      ) : null}

      {done ? (
        <div
          role="status"
          className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5"
        >
          <p>
            <span className="font-medium">
              Imported <Num value={done.imported} /> leads.
            </span>{" "}
            {done.possibleDuplicates ? (
              <>
                <Num value={done.possibleDuplicates} /> look like firms you already have: check them on the
                merge screen.
              </>
            ) : null}
          </p>
          <div className="flex gap-2">
            {done.possibleDuplicates ? (
              <Link href="/leads/duplicates" className={cn(buttonVariants({ variant: "outline" }))}>
                Review duplicates
              </Link>
            ) : null}
            <Link href="/leads?status=new" className={cn(buttonVariants())}>
              Open new leads
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
