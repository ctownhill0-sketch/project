import { describe, expect, it } from "vitest";
import { parseTownLines } from "@/components/finder/territory-form";

describe("parseTownLines", () => {
  it("reads Town, ST lines and reports the rest", () => {
    expect(parseTownLines("Hoboken, NJ\n\n  Jersey City,nj \nBayonne")).toEqual({
      towns: [
        { town: "Hoboken", state: "NJ" },
        { town: "Jersey City", state: "NJ" },
      ],
      bad: ["Bayonne"],
    });
  });
});
