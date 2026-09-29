"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteViewAction, saveViewAction } from "@/app/(app)/leads/actions";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Saved filter combinations for the Leads table (name + query). */
export function SavedViews({
  views,
  currentQuery,
}: {
  views: { name: string; query: string }[];
  currentQuery: string;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  // The name field appears after "Save this view" is pressed: move focus to it.
  useEffect(() => {
    if (naming) input.current?.focus();
  }, [naming]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id="views-label" className="text-small text-muted-foreground w-18 shrink-0">
        Views
      </span>
      <ul aria-labelledby="views-label" className="flex flex-wrap gap-1.5">
        {views.map((v) => {
          const active = v.query === currentQuery;
          return (
            <li key={v.name} className="flex items-center">
              <Link
                href={v.query ? `/leads?${v.query}` : "/leads"}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "text-small inline-flex h-7 items-center rounded-l-full border py-0 pr-2 pl-3",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card hover:bg-muted",
                )}
              >
                {v.name}
              </Link>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteViewAction(v.name);
                    if (!res.ok) toast.error(res.error);
                  })
                }
                className="border-input bg-card hover:bg-muted text-muted-foreground inline-flex h-7 items-center rounded-r-full border border-l-0 px-2"
              >
                <Icons.close className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {naming ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveViewAction({ name, query: currentQuery });
              if (!res.ok) return void toast.error(res.error);
              toast.success(`Saved view "${name}"`);
              setNaming(false);
              setName("");
            });
          }}
        >
          <label htmlFor="view-name" className="sr-only">
            View name
          </label>
          <Input
            id="view-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            maxLength={40}
            className="h-8 w-40"
            ref={input}
          />
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            Save view
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setNaming(true)}>
          Save this view
        </Button>
      )}
    </div>
  );
}
