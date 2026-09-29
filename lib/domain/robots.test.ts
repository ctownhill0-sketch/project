import { describe, expect, it } from "vitest";
import { isAllowedByRobots, parseRobots } from "@/lib/domain/robots";

const TXT = `
# comment
User-agent: *
Disallow: /private
Allow: /private/open
Crawl-delay: 2

User-agent: VacancyDeskBot
Disallow: /owners
Allow: /owners/faq
`;

describe("robots.txt", () => {
  it("uses the group for our agent when present (case-insensitive)", () => {
    const rules = parseRobots(TXT);
    expect(isAllowedByRobots(rules, "VacancyDeskBot/1.0", "/owners")).toBe(false);
    expect(isAllowedByRobots(rules, "VacancyDeskBot/1.0", "/owners/faq")).toBe(true);
    // Our group replaces *, so /private is allowed for us.
    expect(isAllowedByRobots(rules, "vacancydeskbot/1.0", "/private")).toBe(true);
  });

  it("falls back to * with longest-match wins", () => {
    const rules = parseRobots(TXT);
    expect(isAllowedByRobots(rules, "OtherBot", "/private/x")).toBe(false);
    expect(isAllowedByRobots(rules, "OtherBot", "/private/open/page")).toBe(true);
    expect(isAllowedByRobots(rules, "OtherBot", "/")).toBe(true);
  });

  it("handles Disallow: / , empty Disallow, wildcards and $", () => {
    expect(isAllowedByRobots(parseRobots("User-agent: *\nDisallow: /"), "VacancyDeskBot", "/")).toBe(false);
    expect(isAllowedByRobots(parseRobots("User-agent: *\nDisallow:"), "VacancyDeskBot", "/x")).toBe(true);
    const wild = parseRobots("User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp*");
    expect(isAllowedByRobots(wild, "VacancyDeskBot", "/files/a.pdf")).toBe(false);
    expect(isAllowedByRobots(wild, "VacancyDeskBot", "/files/a.pdf?x")).toBe(true);
    expect(isAllowedByRobots(wild, "VacancyDeskBot", "/tmpfile")).toBe(false);
  });

  it("allows everything when there are no rules", () => {
    expect(isAllowedByRobots(parseRobots(""), "VacancyDeskBot", "/anything")).toBe(true);
  });
});
