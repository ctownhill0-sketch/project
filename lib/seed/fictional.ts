/**
 * Fictional demo data only (brief Part 10). Names come from invented word lists,
 * domains use the reserved .example TLD (RFC 2606), and phone numbers use the
 * 555-0100–0199 range reserved for fiction.
 */

export type Rng = () => number;

/** mulberry32: tiny, fast, deterministic. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick from empty list");
  return item;
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const FIRST = [
  "Harborline",
  "Quarry Oak",
  "Brightwater",
  "Stonegate",
  "Maple Ledger",
  "Tidewell",
  "Copperfield",
  "Northbeam",
  "Ashgrove",
  "Lanternway",
  "Kestrel",
  "Bluestem",
  "Ironbridge",
  "Willowmere",
  "Crestline",
  "Foxhollow",
  "Granite Row",
  "Seabright",
  "Oakhurst",
  "Riverbend",
  "Pinecrest",
  "Larkspur",
  "Hearthstone",
  "Silverpine",
  "Cobble Lane",
  "Meadowvale",
  "Westbrook",
  "Sandpiper",
  "Redfern",
  "Halcyon",
];
const SECOND = [
  "Residential",
  "Property Group",
  "Rentals",
  "Property Management",
  "Homes",
  "Realty Management",
  "Living",
  "Management Co",
  "Properties",
  "Apartments",
];

const MIDDLE = ["", "", "Park", "Harbor", "Hill", "Square", "Commons"];

export function fictionalFirmName(rng: Rng): string {
  return [pick(rng, FIRST), pick(rng, MIDDLE), pick(rng, SECOND)].filter(Boolean).join(" ");
}

export function fictionalDomain(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}.example`;
}

const AREA_CODES = ["212", "718", "917", "516", "631", "914", "201", "973"];

export function fictionalPhone(rng: Rng): string {
  return `+1${pick(rng, AREA_CODES)}55501${String(intBetween(rng, 0, 99)).padStart(2, "0")}`;
}
