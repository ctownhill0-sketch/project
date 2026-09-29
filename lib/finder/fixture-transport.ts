// Recorded Places responses for tests, CI and the e2e demo (no live calls). See spec §3 and D-F7.
import textSearch from "@/lib/finder/fixtures/text-search.json";
import reviews from "@/lib/finder/fixtures/place-details-reviews.json";
import type { PlacesTransport } from "@/lib/finder/places";

type Pages = { places?: unknown[]; nextPageToken?: string }[];
const TOWNS = textSearch as unknown as Record<string, Pages>;

export function fixtureTransport(): PlacesTransport {
  return async (req) => {
    if (req.method === "GET") {
      return {
        status: 200,
        json: req.url.endsWith("/fx-hoboken-004") ? reviews : { id: req.url.split("/").pop(), reviews: [] },
      };
    }
    const body = JSON.parse(req.body ?? "{}") as {
      textQuery?: string;
      pageToken?: string;
      pageSize?: number;
    };
    if (body.pageSize === 1) return { status: 200, json: { places: [{ id: "fx-test" }] } };
    const town = /\bin (.+)$/.exec(body.textQuery ?? "")?.[1] ?? "";
    const pages = TOWNS[town];
    if (!pages) return { status: 200, json: {} };
    const index = body.pageToken ? Number(body.pageToken.split("-").pop()) : 0;
    return { status: 200, json: pages[index] ?? {} };
  };
}
