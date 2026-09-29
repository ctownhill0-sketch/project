"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createRunAction,
  enrichStepAction,
  runStepAction,
  saveSearchAction,
  stopRunAction,
} from "@/app/(app)/finder/actions";
import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { estimateRun } from "@/lib/domain/finder-cost";
import { cn } from "@/lib/utils";

interface TownRef {
  town: string;
  state: string;
}

export interface SearchPanelProps {
  keywords: string[];
  usedThisMonth: number;
  territories: { id: string; name: string; towns: TownRef[] }[];
  savedSearches: { id: string; name: string; towns: TownRef[]; keywords: string[] }[];
}

type Mode = "town" | "territory" | "saved";

interface Progress {
  runId: string;
  status: string;
  queriesDone: number;
  plannedQueries: number;
  requestsUsed: number;
  resultsFound: number;
  newFound: number;
  last: string | null;
  message: string | null;
  done: boolean;
}

export function SearchPanel({ keywords, usedThisMonth, territories, savedSearches }: SearchPanelProps) {
  const [mode, setMode] = useState<Mode>("town");
  const [town, setTown] = useState("");
  const [state, setState] = useState("NJ");
  const [picked, setPicked] = useState<string[]>(keywords);
  const [territoryId, setTerritoryId] = useState(territories[0]?.id ?? "");
  const [savedId, setSavedId] = useState(savedSearches[0]?.id ?? "");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [enrich, setEnrich] = useState<{ processed: number; remaining: number; running: boolean } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const stopRef = useRef(false);

  // Fall back to the first entry: the lists can grow after this component mounted (e.g. a new territory).
  const territory = territories.find((t) => t.id === territoryId) ?? territories[0];
  const saved = savedSearches.find((s) => s.id === savedId) ?? savedSearches[0];
  const towns: TownRef[] =
    mode === "town"
      ? town.trim()
        ? [{ town: town.trim(), state: state.trim().toUpperCase() }]
        : []
      : mode === "territory"
        ? (territory?.towns ?? [])
        : (saved?.towns ?? []);
  const words = mode === "saved" ? (saved?.keywords ?? []) : picked;
  const estimate = estimateRun({ towns: towns.length, keywords: words.length, usedThisMonth });
  const running = Boolean(progress && !progress.done);

  async function loopRun(runId: string, plannedQueries: number) {
    stopRef.current = false;
    let queriesDone = 0;
    setProgress({
      runId,
      status: "running",
      queriesDone,
      plannedQueries,
      requestsUsed: 0,
      resultsFound: 0,
      newFound: 0,
      last: null,
      message: null,
      done: false,
    });
    for (;;) {
      if (stopRef.current) {
        await stopRunAction(runId);
        setProgress((p) =>
          p ? { ...p, status: "stopped", done: true, message: "Stopped. Places found so far are kept." } : p,
        );
        return;
      }
      const res = await runStepAction(runId);
      if (!res.ok) {
        toast.error(res.error);
        setProgress((p) => (p ? { ...p, done: true, message: res.error } : p));
        return;
      }
      const d = res.data;
      if (d.query) queriesDone += 1;
      setProgress({
        runId,
        status: d.status,
        queriesDone,
        plannedQueries: d.counters.plannedQueries,
        requestsUsed: d.counters.requestsUsed,
        resultsFound: d.counters.resultsFound,
        newFound: d.counters.newFound,
        last: d.query
          ? `${d.query.keyword} in ${d.query.town}, ${d.query.state}: ${d.query.found} places`
          : null,
        message: d.message,
        done: d.done,
      });
      if (d.done) {
        if (d.status === "done") toast.success(`Search finished: ${d.counters.newFound} new places`);
        else if (d.message) toast.error(d.message);
        return;
      }
    }
  }

  function run() {
    if (towns.length === 0) {
      toast.error("Add a town first.");
      return;
    }
    startTransition(async () => {
      const res = await createRunAction({
        towns,
        keywords: words,
        territoryId: mode === "territory" ? (territory?.id ?? null) : null,
        savedSearchId: mode === "saved" ? (saved?.id ?? null) : null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEnrich(null);
      await loopRun(res.data.runId, res.data.plannedQueries);
    });
  }

  function checkWebsites(runId: string) {
    startTransition(async () => {
      stopRef.current = false;
      let processed = 0;
      setEnrich({ processed, remaining: 1, running: true });
      for (;;) {
        if (stopRef.current) break;
        const res = await enrichStepAction(runId);
        if (!res.ok) {
          toast.error(res.error);
          break;
        }
        processed += res.data.processed;
        setEnrich({ processed, remaining: res.data.remaining, running: res.data.remaining > 0 });
        if (res.data.remaining === 0 || res.data.processed === 0) break;
      }
      setEnrich((e) => (e ? { ...e, running: false } : e));
      toast.success(`Checked ${processed} websites`);
    });
  }

  function saveSearch() {
    const name = window.prompt("Name this search", towns.map((t) => t.town).join(", "));
    if (!name) return;
    startTransition(async () => {
      const res = await saveSearchAction({ name, towns, keywords: words });
      if (res.ok) toast.success("Search saved");
      else toast.error(res.error);
    });
  }

  const modeButton = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => setMode(value)}
      className={cn(
        "text-small rounded-md px-3 py-1.5 font-medium",
        mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <section
      aria-labelledby="search-heading"
      className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="search-heading" className="font-semibold">
          Search Google Places
        </h2>
        <div role="tablist" aria-label="Search mode" className="bg-muted flex gap-1 rounded-lg p-1">
          {modeButton("town", "Town")}
          {modeButton("territory", "Territory")}
          {modeButton("saved", "Saved")}
        </div>
      </div>

      {mode === "town" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="finder-town">Town</Label>
            <Input
              id="finder-town"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="Hoboken"
              autoComplete="off"
            />
          </div>
          <div className="flex w-20 flex-col gap-1.5">
            <Label htmlFor="finder-state">State</Label>
            <Input
              id="finder-state"
              value={state}
              onChange={(e) => setState(e.target.value.slice(0, 2).toUpperCase())}
              maxLength={2}
            />
          </div>
        </div>
      ) : mode === "territory" ? (
        territories.length === 0 ? (
          <p className="text-muted-foreground">No territory yet. Create one below with your town list.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finder-territory">Territory</Label>
            <select
              id="finder-territory"
              value={territory?.id ?? ""}
              onChange={(e) => setTerritoryId(e.target.value)}
              className="border-input bg-card h-9 max-w-sm rounded-lg border px-2"
            >
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.towns.length} towns)
                </option>
              ))}
            </select>
          </div>
        )
      ) : savedSearches.length === 0 ? (
        <p className="text-muted-foreground">No saved searches yet. Run a town search, then save it.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finder-saved">Saved search</Label>
          <select
            id="finder-saved"
            value={saved?.id ?? ""}
            onChange={(e) => setSavedId(e.target.value)}
            className="border-input bg-card h-9 max-w-sm rounded-lg border px-2"
          >
            {savedSearches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode !== "saved" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-small text-muted-foreground mb-2">
            Keyword variants (results are merged)
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => {
              const on = picked.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}
                  className={cn(
                    "text-small inline-flex h-7 items-center rounded-full border px-3 transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card hover:bg-muted",
                  )}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-small text-muted-foreground" aria-live="polite">
          <Num value={estimate.queries} /> searches, up to <Num value={estimate.maxRequests} /> Google
          requests. Estimated cost <Num value={estimate.costAfterFreeUsd} format="currency" /> after free
          monthly usage (<Num value={estimate.listCostUsd} format="currency" /> at list price).
        </p>
        <div className="flex gap-2">
          {mode === "town" ? (
            <Button variant="outline" onClick={saveSearch} disabled={pending || towns.length === 0}>
              Save search
            </Button>
          ) : null}
          <Button onClick={run} disabled={pending || running || towns.length === 0 || words.length === 0}>
            <Icons.finder data-icon="inline-start" />
            {mode === "territory" ? "Run my territory" : "Run search"}
          </Button>
        </div>
      </div>

      {progress ? (
        <div
          className="border-border flex flex-col gap-3 rounded-lg border p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {progress.done
                ? progress.status === "done"
                  ? "Search finished"
                  : "Search stopped"
                : "Searching…"}
            </p>
            {!progress.done ? (
              <Button variant="outline" size="sm" onClick={() => (stopRef.current = true)}>
                Stop
              </Button>
            ) : null}
          </div>
          <p className="text-small">
            Search <Num value={progress.queriesDone} /> of <Num value={progress.plannedQueries} /> ·{" "}
            <Num value={progress.requestsUsed} /> requests · <Num value={progress.resultsFound} /> places (
            <Num value={progress.newFound} /> new)
          </p>
          {progress.last ? <p className="text-small text-muted-foreground">{progress.last}</p> : null}
          {progress.message ? <p className="text-small text-destructive-text">{progress.message}</p> : null}
          {progress.done ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => checkWebsites(progress.runId)}
                disabled={pending || enrich?.running}
              >
                Check websites
              </Button>
              <Link href={`/finder/triage?run=${progress.runId}`} className={cn(buttonVariants())}>
                Start triage
              </Link>
              <Link
                href={`/finder/results?run=${progress.runId}`}
                className={cn(buttonVariants({ variant: "ghost" }))}
              >
                See all results
              </Link>
              {enrich ? (
                <span className="text-small text-muted-foreground">
                  {enrich.running ? "Checking" : "Checked"} <Num value={enrich.processed} /> websites
                  {enrich.remaining > 0 ? (
                    <>
                      , <Num value={enrich.remaining} /> to go (5 seconds per site, politely)
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
