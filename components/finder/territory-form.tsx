"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveTerritoryAction } from "@/app/(app)/finder/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** "Hoboken, NJ" per line → towns. Lines that don't parse are reported, not dropped silently. */
export function parseTownLines(text: string): { towns: { town: string; state: string }[]; bad: string[] } {
  const towns: { town: string; state: string }[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(.+?),\s*([A-Za-z]{2})$/.exec(line);
    if (m) towns.push({ town: m[1]!.trim(), state: m[2]!.toUpperCase() });
    else bad.push(line);
  }
  return { towns, bad };
}

export function TerritoryForm() {
  const [name, setName] = useState("");
  const [lines, setLines] = useState("");
  const [pending, start] = useTransition();
  const parsed = parseTownLines(lines);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.bad.length) {
          toast.error(`Use "Town, ST" on each line. Check: ${parsed.bad[0]}`);
          return;
        }
        start(async () => {
          const res = await saveTerritoryAction({ name, towns: parsed.towns });
          if (res.ok) {
            toast.success("Territory saved");
            setName("");
            setLines("");
          } else toast.error(res.error);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="territory-name">Territory name</Label>
        <Input
          id="territory-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hudson County"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="territory-towns">Towns, one per line</Label>
        <Textarea
          id="territory-towns"
          value={lines}
          onChange={(e) => setLines(e.target.value)}
          placeholder={"Hoboken, NJ\nJersey City, NJ\nBayonne, NJ"}
          rows={4}
          required
          aria-describedby="territory-towns-hint"
        />
        <p id="territory-towns-hint" className="text-caption text-muted-foreground">
          {parsed.towns.length} towns{parsed.bad.length ? `, ${parsed.bad.length} lines need "Town, ST"` : ""}
        </p>
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={pending || !name || parsed.towns.length === 0}
        className="self-start"
      >
        Save territory
      </Button>
    </form>
  );
}
