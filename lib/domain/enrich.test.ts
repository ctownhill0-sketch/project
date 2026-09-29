import { describe, expect, it } from "vitest";
import {
  countListings,
  detectSoftware,
  extractContacts,
  extractName,
  extractServiceTypes,
  extractSize,
  likelyPages,
  parsePage,
} from "@/lib/domain/enrich";
import { DEFAULT_SOFTWARE_PATTERNS } from "@/lib/domain/software";

const HOME = "https://harborline.example/";
const page = (html: string, url = HOME) => parsePage(url, html);

const VENDOR_LINKS: [string, string][] = [
  ["appfolio", `<a href="https://harborline.appfolio.com/connect">Resident portal</a>`],
  ["buildium", `<a href="https://harborline.managebuilding.com/Resident/portal/login">Pay rent</a>`],
  ["doorloop", `<a href="https://app.doorloop.com/tenant-portal">Tenant login</a>`],
  ["rent_manager", `<a href="https://harborline.rmresident.com/">Residents</a>`],
  ["yardi", `<a href="https://www.rentcafe.com/residentservices/harborline">Pay online</a>`],
  ["yardi", `<a href="https://harborline.securecafe.com/residentservices/">Pay online</a>`],
  ["propertyware", `<a href="https://harborline.propertyware.com/pw/portals/tenant">Portal</a>`],
  ["rentvine", `<a href="https://harborline.rentvine.com/portals/resident">Portal</a>`],
  ["tenantcloud", `<a href="https://home.tenantcloud.com/login">Tenant login</a>`],
];

describe("detectSoftware", () => {
  it.each(VENDOR_LINKS)(
    "finds %s from a portal link with high confidence and the evidence URL",
    (software, link) => {
      const result = detectSoftware([page(`<html><body>${link}</body></html>`)], DEFAULT_SOFTWARE_PATTERNS);
      expect(result).toMatchObject({ software, confidence: "high", sourceUrl: HOME });
      expect(result.evidence).toMatch(/^https:\/\//);
    },
  );

  it("finds a vendor from a script src", () => {
    const html = `<script src="https://widgets.appfolio.com/listings.js"></script>`;
    expect(detectSoftware([page(html)], DEFAULT_SOFTWARE_PATTERNS)).toMatchObject({
      software: "appfolio",
      confidence: "high",
    });
  });

  it("gives medium confidence when only the page text names a vendor", () => {
    const html = `<footer>Our rent payments are powered by Buildium.</footer>`;
    expect(detectSoftware([page(html)], DEFAULT_SOFTWARE_PATTERNS)).toMatchObject({
      software: "buildium",
      confidence: "medium",
    });
  });

  it("gives low confidence when two vendors are linked", () => {
    const html = VENDOR_LINKS[0]![1] + VENDOR_LINKS[1]![1];
    expect(detectSoftware([page(html)], DEFAULT_SOFTWARE_PATTERNS).confidence).toBe("low");
  });

  it("says none only after at least two pages without a vendor, otherwise unknown", () => {
    const plain = page("<p>Welcome</p>");
    expect(detectSoftware([plain], DEFAULT_SOFTWARE_PATTERNS)).toMatchObject({ software: "unknown" });
    expect(
      detectSoftware([plain, page("<p>About</p>", `${HOME}about`)], DEFAULT_SOFTWARE_PATTERNS),
    ).toMatchObject({
      software: "none",
      confidence: "medium",
    });
  });
});

describe("extractSize", () => {
  it.each([
    ["We manage over 300 doors across Hudson County.", 300],
    ["A portfolio of 150+ units in North Jersey", 150],
    ["Managing 1,200 homes for local owners", 1200],
    ["450 units under management", 450],
    ["Proudly overseeing more than 75 rental properties", 75],
  ])("reads %j as %i with the quote", (text, value) => {
    const result = extractSize([page(`<p>${text}</p>`)]);
    expect(result).toMatchObject({ value, sourceUrl: HOME });
    expect(text).toContain(result!.quote);
  });

  it("ignores listing counts, years and implausible numbers", () => {
    expect(extractSize([page("<p>2 units available now. Since 1998.</p>")])).toBeNull();
    expect(extractSize([page("<p>We manage 3 units</p>")])).toBeNull();
    expect(extractSize([page("<p>We manage 90,000 units</p>")])).toBeNull();
  });

  it("takes the largest plausible value", () => {
    const html = "<p>We manage 120 units.</p><p>Our team oversees 300+ homes.</p>";
    expect(extractSize([page(html)])?.value).toBe(300);
  });
});

describe("countListings", () => {
  it("counts known listing widgets", () => {
    const cards = Array.from({ length: 7 }, (_, i) => `<div class="listing-item">Unit ${i}</div>`).join("");
    expect(countListings(page(cards, `${HOME}rentals`))).toMatchObject({
      value: 7,
      sourceUrl: `${HOME}rentals`,
    });
  });

  it("reads an explicit count in the text", () => {
    expect(countListings(page("<h2>12 available rentals</h2>"))?.value).toBe(12);
  });

  it("returns null when nothing looks like a listing", () => {
    expect(countListings(page("<p>Contact us</p>"))).toBeNull();
  });
});

describe("extractContacts", () => {
  it("keeps business phones and generic emails only", () => {
    const html = `
      <a href="tel:+12015550142">Call</a>
      <a href="tel:201-555-0142">Call again</a>
      <a href="mailto:info@harborline.example">Email</a>
      <a href="mailto:leasing@harborline.example?subject=hi">Leasing</a>
      <a href="mailto:jane.doe@harborline.example">Jane</a>
      <a href="mailto:jsmith@harborline.example">J</a>`;
    const { phones, emails } = extractContacts([page(html)]);
    expect(phones.map((p) => p.value)).toEqual(["2015550142"]);
    expect(emails.map((e) => e.value)).toEqual(["info@harborline.example", "leasing@harborline.example"]);
  });
});

describe("extractName", () => {
  it("prefers og:site_name, then a cleaned title", () => {
    expect(extractName(page(`<meta property="og:site_name" content="Harborline Residential">`))).toBe(
      "Harborline Residential",
    );
    expect(extractName(page("<title>Home | Harborline Residential</title>"))).toBe("Harborline Residential");
    expect(extractName(page("<title>Harborline Residential - Home</title>"))).toBe("Harborline Residential");
    expect(extractName(page("<p>no title</p>"))).toBeNull();
  });
});

describe("extractServiceTypes", () => {
  it("returns each hinted service type with a quote", () => {
    const html =
      "<p>Residential property management and HOA management. We also handle vacation rentals.</p>";
    const types = extractServiceTypes([page(html)]);
    expect(types.map((t) => t.value).sort()).toEqual(["hoa", "residential", "vacation"]);
    expect(types.every((t) => t.quote.length > 0)).toBe(true);
  });
});

describe("likelyPages", () => {
  it("picks up to 3 same-host pages in priority order", () => {
    const html = `
      <a href="/about">About</a><a href="/owners">Owners</a>
      <a href="https://harborline.example/rentals">Rentals</a>
      <a href="/pay-rent">Pay rent</a>
      <a href="https://other.example/rentals">Other site</a>`;
    expect(likelyPages(page(html))).toEqual([
      "https://harborline.example/rentals",
      "https://harborline.example/pay-rent",
      "https://harborline.example/owners",
    ]);
  });
});
