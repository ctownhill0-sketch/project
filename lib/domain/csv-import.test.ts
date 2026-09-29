import { describe, expect, it } from "vitest";
import { classifyRows, guessMapping, mapRows, parseCsv, IMPORT_FIELDS } from "@/lib/domain/csv-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF and a BOM", () => {
    const text = '﻿Name,Website\r\n"Harborline, LLC",harborline.example\r\n"Say ""hi""",x.example\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Website"],
      ["Harborline, LLC", "harborline.example"],
      ['Say "hi"', "x.example"],
    ]);
  });

  it("keeps newlines inside quotes and skips blank lines", () => {
    expect(parseCsv('a,b\n"line\nbreak",2\n\n')).toEqual([
      ["a", "b"],
      ["line\nbreak", "2"],
    ]);
  });
});

describe("guessMapping", () => {
  it("maps common header spellings to fields", () => {
    expect(
      guessMapping(["Company Name", "Website URL", "Phone Number", "City", "ST", "Units", "Portal", "Notes"]),
    ).toEqual({
      "Company Name": "name",
      "Website URL": "website",
      "Phone Number": "phone",
      City: "city",
      ST: "state",
      Units: "units",
      Portal: "software",
    });
  });

  it("exposes the fields a column can map to", () => {
    expect(IMPORT_FIELDS.map((f) => f.key)).toContain("name");
  });
});

describe("mapRows", () => {
  it("normalizes values and reports row errors without dropping them silently", () => {
    const rows = [
      ["Firm", "Site", "Phone", "Town", "State", "Doors", "Software"],
      [
        "Harborline Residential",
        "https://www.harborline.example/",
        "(201) 555-0142",
        "Hoboken",
        "nj",
        "180",
        "Buildium",
      ],
      ["", "x.example", "", "", "", "", ""],
      ["Quarry Oak", "", "555", "Newark", "NJ", "lots", "Something Else"],
    ];
    const out = mapRows(rows, {
      Firm: "name",
      Site: "website",
      Phone: "phone",
      Town: "city",
      State: "state",
      Doors: "units",
      Software: "software",
    });
    expect(out[0]).toMatchObject({
      line: 2,
      record: {
        name: "Harborline Residential",
        domain: "harborline.example",
        phone: "(201) 555-0142",
        normalizedPhone: "2015550142",
        city: "Hoboken",
        state: "NJ",
        units: 180,
        software: "buildium",
      },
      errors: [],
    });
    expect(out[1]!.errors).toEqual(["Name is missing"]);
    expect(out[2]!.errors).toEqual(["Phone isn't a 10-digit US number", "Units isn't a whole number"]);
    expect(out[2]!.record.software).toBe("unknown");
  });
});

describe("classifyRows", () => {
  const existing = [
    {
      id: "c1",
      placeId: null,
      normalizedDomain: "harborline.example",
      normalizedPhone: "2015550142",
      normalizedName: "harborline",
      city: "Hoboken",
      dnc: false,
    },
    {
      id: "c2",
      placeId: null,
      normalizedDomain: "quarryoak.example",
      normalizedPhone: null,
      normalizedName: "quarry oak",
      city: "Newark",
      dnc: true,
      dncSince: new Date("2026-09-01"),
    },
  ];
  it("marks duplicates, do-not-call, in-file repeats and errors", () => {
    const mapped = mapRows(
      [
        ["name", "website", "city"],
        ["Harborline Residential", "harborline.example", "Hoboken"],
        ["Quarry Oak", "quarryoak.example", "Newark"],
        ["Fresh Firm", "fresh.example", "Bayonne"],
        ["Fresh Firm Again", "fresh.example", "Bayonne"],
        ["", "", ""],
      ],
      { name: "name", website: "website", city: "city" },
    );
    const out = classifyRows(mapped, existing, [
      { kind: "phone", value: "0000000000", reason: "x", createdAt: new Date() },
    ]);
    expect(out.map((r) => r.status)).toEqual(["duplicate", "dnc", "new", "duplicate", "error"]);
    expect(out[1]!.reason).toMatch(/Do not call/);
    expect(out[3]!.reason).toMatch(/earlier row/);
  });

  it("imports a similar name from an earlier row as a possible duplicate, not a skip", () => {
    const mapped = mapRows(
      [
        ["name", "city"],
        ["Harborline Residential", "Hoboken"],
        ["Harbourline Residential", "Hoboken"],
      ],
      { name: "name", city: "city" },
    );
    const out = classifyRows(mapped, [], []);
    expect(out.map((r) => r.status)).toEqual(["new", "possible_duplicate"]);
    expect(out[1]!.reason).toMatch(/line 2/);
  });
});
