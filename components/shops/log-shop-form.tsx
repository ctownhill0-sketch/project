"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logShopAction } from "@/app/(app)/shops/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Firm = { id: string; name: string; city: string | null };

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "website_form", label: "Website form" },
  { value: "listing_site", label: "Listing site" },
  { value: "phone", label: "Phone" },
] as const;
const BUCKET: Record<string, string> = {
  business: "business hours",
  saturday: "Saturday",
  after_hours: "after hours",
};

/** Log a shop in under a minute: pick the firm, the channel, "just now" or a time, save. */
export function LogShopForm({ initialFirm }: { initialFirm: Firm | null }) {
  const [firm, setFirm] = useState<Firm | null>(initialFirm);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Firm[]>([]);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("email");
  const [custom, setCustom] = useState(false);
  const [when, setWhen] = useState("");
  const [listingRef, setListingRef] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const searchSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      if (!q) return setResults([]);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results?: Firm[] };
      if (seq === searchSeq.current) setResults(json.results ?? []);
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!firm) return void toast.error("Pick the firm you contacted.");
        start(async () => {
          const res = await logShopAction({
            companyId: firm.id,
            channel,
            sentAt: custom && when ? new Date(when).toISOString() : new Date().toISOString(),
            listingRef: listingRef || null,
            notes: notes || null,
          });
          if (!res.ok) return void toast.error(res.error);
          toast.success(
            `Shop logged (${BUCKET[res.data.hoursBucket]}). Reply checks at 1h, 4h, 24h and 72h.`,
          );
          setFirm(null);
          setQuery("");
          setListingRef("");
          setNotes("");
          setCustom(false);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shop-firm">Firm</Label>
        {firm ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {firm.name}
              {firm.city ? <span className="text-muted-foreground">, {firm.city}</span> : null}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFirm(null)}>
              Change
            </Button>
          </div>
        ) : (
          <>
            <Input
              id="shop-firm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, town or phone"
              autoComplete="off"
            />
            {results.length ? (
              <ul
                aria-label="Matching firms"
                className="border-border bg-card divide-border divide-y rounded-lg border"
              >
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setFirm(r)}
                      className="hover:bg-muted w-full px-3 py-2 text-left"
                    >
                      {r.name}
                      {r.city ? <span className="text-muted-foreground">, {r.city}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">How you reached out</legend>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={channel === c.value}
              onClick={() => setChannel(c.value)}
              className={cn(
                "text-small inline-flex h-8 items-center rounded-full border px-3",
                channel === c.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card hover:bg-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">When you sent it</legend>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="when"
              checked={!custom}
              onChange={() => setCustom(false)}
              className="accent-primary size-4"
            />
            Just now
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="when"
              checked={custom}
              onChange={() => setCustom(true)}
              className="accent-primary size-4"
            />
            Earlier
          </label>
          {custom ? (
            <>
              <Label htmlFor="shop-when" className="sr-only">
                Sent at
              </Label>
              <Input
                id="shop-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-56"
                required
              />
            </>
          ) : null}
        </div>
      </fieldset>

      <details>
        <summary className="text-small cursor-pointer">Listing and notes (optional)</summary>
        <div className="flex flex-col gap-3 pt-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop-listing">Listing you asked about</Label>
            <Input
              id="shop-listing"
              value={listingRef}
              onChange={(e) => setListingRef(e.target.value)}
              placeholder="2BR at 12 Main St, or its link"
              maxLength={300}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop-notes">Notes</Label>
            <Textarea
              id="shop-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </div>
        </div>
      </details>

      <Button type="submit" disabled={pending || !firm} className="self-start">
        Log shop
      </Button>
    </form>
  );
}
