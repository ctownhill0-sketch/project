// Day and month boundaries in the founder's time zone (America/New_York), DST-correct.
const ZONE = "America/New_York";

export function nyDateKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The UTC instant of NY midnight on a YYYY-MM-DD date. */
function nyMidnight(date: string): Date {
  for (const offset of ["-04:00", "-05:00"]) {
    const candidate = new Date(`${date}T00:00:00${offset}`);
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(candidate);
    if (nyDateKey(candidate) === date && Number(hour) === 0) return candidate;
  }
  throw new Error(`No New York midnight on ${date}`);
}

export function nyDayStart(at: Date): Date {
  return nyMidnight(nyDateKey(at));
}

export function nyMonthStart(at: Date): Date {
  return nyMidnight(`${nyDateKey(at).slice(0, 7)}-01`);
}
