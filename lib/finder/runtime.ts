// Server wiring for the Lead Finder: the Places transport, the polite fetcher and key status.
// The key is read here only, on the server, and never leaves it (spec §3, §4.8).
import "server-only";
import { lookup } from "node:dns/promises";
import { PoliteFetcher } from "@/lib/fetcher/fetcher";
import { fixturePageSource } from "@/lib/finder/fixture-sites";
import { fixtureTransport } from "@/lib/finder/fixture-transport";
import { createPlacesClient, type PlacesClient, type PlacesTransport } from "@/lib/finder/places";
import type { PageSource } from "@/lib/finder/service";

const usingFixtures = () => process.env.PLACES_TRANSPORT === "fixtures";

const liveTransport: PlacesTransport = async (req) => {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body ?? null,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json: unknown = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

export function getPlacesClient(): PlacesClient {
  if (usingFixtures()) return createPlacesClient({ apiKey: "fixture-key", transport: fixtureTransport() });
  return createPlacesClient({
    apiKey: process.env.GOOGLE_PLACES_API_KEY || undefined,
    transport: liveTransport,
  });
}

let fetcher: PoliteFetcher | null = null;

/** One fetcher per server process, so the per-host 5s spacing holds across requests. */
export function getPageSource(): PageSource {
  if (process.env.WEB_TRANSPORT === "fixtures") return fixturePageSource();
  fetcher ??= new PoliteFetcher({
    fetchImpl: fetch,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    lookup: async (host) => (await lookup(host, { all: true })).map((a) => a.address),
    userAgent: `VacancyDeskBot/1.0 (+mailto:${process.env.OWNER_EMAIL ?? "founder@vacancy-desk.example"})`,
  });
  return fetcher;
}

export interface KeyStatus {
  configured: boolean;
  /** Only the last 4 characters, for recognising which key is in use. */
  last4: string | null;
  mode: "live" | "fixtures";
}

export function placesKeyStatus(): KeyStatus {
  if (usingFixtures()) return { configured: true, last4: "demo", mode: "fixtures" };
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
  return { configured: key.length > 0, last4: key.length >= 8 ? key.slice(-4) : null, mode: "live" };
}
