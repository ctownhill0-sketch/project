import { describe, expect, it, vi } from "vitest";
import quota from "@/lib/finder/fixtures/error-quota.json";
import invalidKey from "@/lib/finder/fixtures/error-invalid-key.json";
import reviewsFixture from "@/lib/finder/fixtures/place-details-reviews.json";
import {
  DETAILS_REVIEWS_FIELD_MASK,
  SEARCH_FIELD_MASK,
  TEST_KEY_FIELD_MASK,
  createPlacesClient,
  type PlacesTransport,
} from "@/lib/finder/places";
import { fixtureTransport } from "@/lib/finder/fixture-transport";

const KEY = "test-key-abcd";

function recording(transport: PlacesTransport) {
  const calls: Parameters<PlacesTransport>[0][] = [];
  const wrapped: PlacesTransport = async (req) => {
    calls.push(req);
    return transport(req);
  };
  return { calls, transport: wrapped };
}

const allow = { guard: async () => ({ ok: true as const }), record: vi.fn(async () => undefined) };

describe("field masks", () => {
  it("search uses exactly the fields in the spec", () => {
    expect(SEARCH_FIELD_MASK).toBe(
      "places.id,places.displayName,places.formattedAddress,places.types,places.businessStatus,places.websiteUri,places.nationalPhoneNumber,places.userRatingCount,places.googleMapsUri,nextPageToken",
    );
    expect(TEST_KEY_FIELD_MASK).toBe("places.id");
    expect(DETAILS_REVIEWS_FIELD_MASK).toBe("id,reviews");
  });
});

describe("searchAll", () => {
  it("follows nextPageToken across pages and keeps the other parameters identical", async () => {
    const { calls, transport } = recording(fixtureTransport());
    const client = createPlacesClient({ apiKey: KEY, transport });
    const result = await client.searchAll(
      { keyword: "property management", town: "Hoboken", state: "NJ" },
      allow,
    );
    expect(result.outcome).toBe("ok");
    expect(result.pages).toBe(3);
    expect(result.places).toHaveLength(45);
    expect(result.places[0]).toMatchObject({
      placeId: "fx-hoboken-000",
      name: expect.any(String),
      town: "Hoboken",
    });
    const bodies = calls.map((c) => JSON.parse(c.body!) as Record<string, unknown>);
    expect(bodies[0]).toEqual({
      textQuery: "property management in Hoboken, NJ",
      pageSize: 20,
      regionCode: "US",
    });
    expect(bodies[1]).toEqual({ ...bodies[0], pageToken: "tok-hoboken-1" });
    expect(calls.every((c) => c.headers["X-Goog-FieldMask"] === SEARCH_FIELD_MASK)).toBe(true);
    expect(
      calls.every(
        (c) => c.url === "https://places.googleapis.com/v1/places:searchText" && c.method === "POST",
      ),
    ).toBe(true);
  });

  it("sends the key only in the X-Goog-Api-Key header", async () => {
    const { calls, transport } = recording(fixtureTransport());
    await createPlacesClient({ apiKey: KEY, transport }).searchAll(
      { keyword: "x", town: "Hoboken", state: "NJ" },
      allow,
    );
    for (const c of calls) {
      expect(c.headers["X-Goog-Api-Key"]).toBe(KEY);
      expect(c.url).not.toContain(KEY);
      expect(c.body ?? "").not.toContain(KEY);
    }
  });

  it("returns empty for a town with no results", async () => {
    const client = createPlacesClient({ apiKey: KEY, transport: fixtureTransport() });
    const result = await client.searchAll({ keyword: "x", town: "Nowhere", state: "NJ" }, allow);
    expect(result).toMatchObject({ outcome: "empty", places: [], pages: 1 });
  });

  it("maps quota errors and invalid keys without leaking the key", async () => {
    const quotaT: PlacesTransport = async () => ({ status: 429, json: quota });
    const bad: PlacesTransport = async () => ({ status: 400, json: invalidKey });
    const q = await createPlacesClient({ apiKey: KEY, transport: quotaT }).searchAll(
      { keyword: "x", town: "A", state: "NJ" },
      allow,
    );
    expect(q).toMatchObject({ outcome: "quota_exceeded" });
    const k = await createPlacesClient({ apiKey: KEY, transport: bad }).searchAll(
      { keyword: "x", town: "A", state: "NJ" },
      allow,
    );
    expect(k).toMatchObject({ outcome: "invalid_key" });
    expect(JSON.stringify([q, k])).not.toContain(KEY);
  });

  it("maps network failures", async () => {
    const broken: PlacesTransport = async () => {
      throw new Error(`connect ECONNREFUSED with key=${KEY}`);
    };
    const r = await createPlacesClient({ apiKey: KEY, transport: broken }).searchAll(
      { keyword: "x", town: "A", state: "NJ" },
      allow,
    );
    expect(r.outcome).toBe("network");
    expect(JSON.stringify(r)).not.toContain(KEY);
  });

  it("reports a missing key without sending anything", async () => {
    const transport = vi.fn(fixtureTransport());
    const r = await createPlacesClient({ apiKey: undefined, transport }).searchAll(
      { keyword: "x", town: "A", state: "NJ" },
      allow,
    );
    expect(r.outcome).toBe("missing_key");
    expect(transport).not.toHaveBeenCalled();
  });

  it("checks the cap before every page and stops when it is reached", async () => {
    let sent = 0;
    const guard = async () =>
      sent < 2
        ? { ok: true as const }
        : { ok: false as const, which: "daily" as const, message: "Daily cap of 2 Google requests reached." };
    const record = vi.fn(async (outcome: string) => {
      if (outcome === "sent") sent += 1;
    });
    const client = createPlacesClient({ apiKey: KEY, transport: fixtureTransport() });
    const r = await client.searchAll({ keyword: "x", town: "Hoboken", state: "NJ" }, { guard, record });
    expect(r).toMatchObject({
      outcome: "cap_reached",
      pages: 2,
      message: "Daily cap of 2 Google requests reached.",
    });
    expect(r.places).toHaveLength(40);
    expect(record.mock.calls.map((c) => c[0])).toEqual(["sent", "sent", "blocked_cap"]);
  });
});

describe("reviews and key test", () => {
  it("fetches up to 5 reviews with author attribution", async () => {
    const t: PlacesTransport = async (req) => {
      expect(req.url).toBe("https://places.googleapis.com/v1/places/fx-hoboken-004");
      expect(req.method).toBe("GET");
      expect(req.headers["X-Goog-FieldMask"]).toBe(DETAILS_REVIEWS_FIELD_MASK);
      return { status: 200, json: reviewsFixture };
    };
    const r = await createPlacesClient({ apiKey: KEY, transport: t }).reviews("fx-hoboken-004", allow);
    expect(r.outcome).toBe("ok");
    expect(r.reviews[0]).toMatchObject({
      rating: 1,
      text: expect.stringContaining("never called back"),
      authorName: "Reviewer A.",
      authorUri: expect.stringMatching(/^https:\/\//),
    });
  });

  it("tests the key with a free IDs-only request", async () => {
    const t: PlacesTransport = async (req) => {
      expect(req.headers["X-Goog-FieldMask"]).toBe("places.id");
      expect(JSON.parse(req.body!)).toMatchObject({ pageSize: 1 });
      return { status: 200, json: { places: [{ id: "x" }] } };
    };
    expect(await createPlacesClient({ apiKey: KEY, transport: t }).testKey()).toEqual({ outcome: "ok" });
  });
});
