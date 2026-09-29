// Google Places API (New) client (finder spec §3). Server-side only: the key is passed in by the
// caller from the environment and only ever sent in the X-Goog-Api-Key header. It never appears in
// results, errors or logs. The transport is injectable so tests and CI use recorded fixtures.
import "server-only";
import type { CapResult } from "@/lib/domain/finder-cost";

export const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.types",
  "places.businessStatus",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.userRatingCount",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");
/** Essentials (IDs only): free, used by "Test key". */
export const TEST_KEY_FIELD_MASK = "places.id";
/** Place Details Enterprise + Atmosphere, on demand only. */
export const DETAILS_REVIEWS_FIELD_MASK = "id,reviews";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";
/** Google stops paginating well before this; it's a safety stop. */
const MAX_PAGES = 5;

export interface PlacesRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}
export type PlacesTransport = (req: PlacesRequest) => Promise<{ status: number; json: unknown }>;

export type PlacesOutcome =
  | "ok"
  | "empty"
  | "quota_exceeded"
  | "invalid_key"
  | "missing_key"
  | "bad_request"
  | "network"
  | "cap_reached";

export interface FoundPlace {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  town: string | null;
  state: string | null;
  types: string[];
  businessStatus: string | null;
  websiteUri: string | null;
  nationalPhone: string | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
}

export interface FoundReview {
  rating: number | null;
  text: string;
  publishedAt: string | null;
  authorName: string | null;
  authorUri: string | null;
}

/** Called before every request (caps) and after it (usage log). */
export interface UsageHooks {
  guard: () => Promise<CapResult>;
  record: (outcome: "sent" | "failed" | "blocked_cap", httpStatus: number | null) => Promise<void>;
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  types?: string[];
  businessStatus?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  userRatingCount?: number;
  googleMapsUri?: string;
}

interface RawError {
  error?: { code?: number; status?: string; message?: string; details?: { reason?: string }[] };
}

/** "100 Main St, Hoboken, NJ 07030, USA" → Hoboken, NJ. */
export function townFromAddress(address: string | undefined): { town: string | null; state: string | null } {
  if (!address) return { town: null, state: null };
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length < 3) return { town: null, state: null };
  const stateZip = parts[parts.length - 2] ?? "";
  const state = /^([A-Z]{2})\b/.exec(stateZip)?.[1] ?? null;
  return { town: parts[parts.length - 3] ?? null, state };
}

function toPlace(raw: RawPlace, fallback: { town: string; state: string }): FoundPlace | null {
  if (!raw.id) return null;
  const parsed = townFromAddress(raw.formattedAddress);
  return {
    placeId: raw.id,
    name: raw.displayName?.text?.trim() || "Unnamed place",
    formattedAddress: raw.formattedAddress ?? null,
    town: parsed.town ?? fallback.town,
    state: parsed.state ?? fallback.state,
    types: raw.types ?? [],
    businessStatus: raw.businessStatus ?? null,
    websiteUri: raw.websiteUri ?? null,
    nationalPhone: raw.nationalPhoneNumber ?? null,
    userRatingCount: raw.userRatingCount ?? null,
    googleMapsUri: raw.googleMapsUri ?? null,
  };
}

function classifyError(
  status: number,
  json: unknown,
): Exclude<PlacesOutcome, "ok" | "empty" | "missing_key" | "cap_reached"> {
  const err = (json as RawError)?.error;
  const reasons = (err?.details ?? []).map((d) => d.reason);
  if (status === 429 || err?.status === "RESOURCE_EXHAUSTED") return "quota_exceeded";
  if (status === 403 || err?.status === "PERMISSION_DENIED" || reasons.includes("API_KEY_INVALID"))
    return "invalid_key";
  if (status >= 500) return "network";
  return "bad_request";
}

const MESSAGES: Record<PlacesOutcome, string> = {
  ok: "",
  empty: "Google found no places for this search.",
  quota_exceeded: "Google says the quota is used up. Check the key's quotas in Google Cloud.",
  invalid_key: "Google rejected the key. Check it in Settings and that Places API (New) is enabled.",
  missing_key: "No Google Places key yet. Add GOOGLE_PLACES_API_KEY to .env.local (see Settings).",
  bad_request: "Google couldn't read the request.",
  network: "Couldn't reach Google. Check the internet connection and try again.",
  cap_reached: "",
};

export function createPlacesClient({
  apiKey,
  transport,
}: {
  apiKey: string | undefined;
  transport: PlacesTransport;
}) {
  const headers = (mask: string): Record<string, string> => ({
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey ?? "",
    "X-Goog-FieldMask": mask,
  });

  async function send(req: PlacesRequest, hooks: UsageHooks) {
    const cap = await hooks.guard();
    if (!cap.ok) {
      await hooks.record("blocked_cap", null);
      return { kind: "cap" as const, message: cap.message };
    }
    try {
      const res = await transport(req);
      await hooks.record(res.status < 400 ? "sent" : "failed", res.status);
      return { kind: "response" as const, ...res };
    } catch {
      // Never surface the transport's error text: it could contain request details.
      await hooks.record("failed", null);
      return { kind: "network" as const };
    }
  }

  return {
    async searchAll(
      query: { keyword: string; town: string; state: string },
      hooks: UsageHooks,
    ): Promise<{ outcome: PlacesOutcome; places: FoundPlace[]; pages: number; message: string }> {
      if (!apiKey) return { outcome: "missing_key", places: [], pages: 0, message: MESSAGES.missing_key };
      const base = {
        textQuery: `${query.keyword} in ${query.town}, ${query.state}`,
        pageSize: 20,
        regionCode: "US",
      };
      const places: FoundPlace[] = [];
      let pageToken: string | undefined;
      let pages = 0;
      do {
        const body = JSON.stringify(pageToken ? { ...base, pageToken } : base);
        const res = await send(
          { url: SEARCH_URL, method: "POST", headers: headers(SEARCH_FIELD_MASK), body },
          hooks,
        );
        if (res.kind === "cap") return { outcome: "cap_reached", places, pages, message: res.message };
        if (res.kind === "network") return { outcome: "network", places, pages, message: MESSAGES.network };
        pages += 1;
        if (res.status >= 400) {
          const outcome = classifyError(res.status, res.json);
          return { outcome, places, pages, message: MESSAGES[outcome] };
        }
        const json = res.json as { places?: RawPlace[]; nextPageToken?: string };
        for (const raw of json.places ?? []) {
          const place = toPlace(raw, query);
          if (place) places.push(place);
        }
        pageToken = json.nextPageToken || undefined;
      } while (pageToken && pages < MAX_PAGES);
      return places.length === 0
        ? { outcome: "empty", places, pages, message: MESSAGES.empty }
        : { outcome: "ok", places, pages, message: "" };
    },

    async reviews(
      placeId: string,
      hooks: UsageHooks,
    ): Promise<{ outcome: PlacesOutcome; reviews: FoundReview[]; message: string }> {
      if (!apiKey) return { outcome: "missing_key", reviews: [], message: MESSAGES.missing_key };
      const res = await send(
        {
          url: `${DETAILS_URL}${encodeURIComponent(placeId)}`,
          method: "GET",
          headers: headers(DETAILS_REVIEWS_FIELD_MASK),
        },
        hooks,
      );
      if (res.kind === "cap") return { outcome: "cap_reached", reviews: [], message: res.message };
      if (res.kind === "network") return { outcome: "network", reviews: [], message: MESSAGES.network };
      if (res.status >= 400) {
        const outcome = classifyError(res.status, res.json);
        return { outcome, reviews: [], message: MESSAGES[outcome] };
      }
      const raw = (res.json as { reviews?: Record<string, unknown>[] }).reviews ?? [];
      const reviews = raw.slice(0, 5).map((r) => {
        const author = (r.authorAttribution ?? {}) as { displayName?: string; uri?: string };
        return {
          rating: typeof r.rating === "number" ? r.rating : null,
          text: ((r.text as { text?: string } | undefined)?.text ?? "").trim(),
          publishedAt: typeof r.publishTime === "string" ? r.publishTime : null,
          authorName: author.displayName ?? null,
          authorUri: author.uri ?? null,
        };
      });
      return {
        outcome: reviews.length ? "ok" : "empty",
        reviews,
        message: reviews.length ? "" : "Google has no reviews for this place.",
      };
    },

    /** One free Essentials (IDs only) request. */
    async testKey(): Promise<{ outcome: PlacesOutcome; message?: string }> {
      if (!apiKey) return { outcome: "missing_key", message: MESSAGES.missing_key };
      try {
        const res = await transport({
          url: SEARCH_URL,
          method: "POST",
          headers: headers(TEST_KEY_FIELD_MASK),
          body: JSON.stringify({ textQuery: "property management in Hoboken, NJ", pageSize: 1 }),
        });
        if (res.status < 400) return { outcome: "ok" };
        const outcome = classifyError(res.status, res.json);
        return { outcome, message: MESSAGES[outcome] };
      } catch {
        return { outcome: "network", message: MESSAGES.network };
      }
    },
  };
}

export type PlacesClient = ReturnType<typeof createPlacesClient>;
