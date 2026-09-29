import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines, blanks nulls and uses CRLF", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x, y", 'say "hi"'],
          [null, 3],
          ["line\nbreak", undefined],
        ],
      ),
    ).toBe('a,b\r\n"x, y","say ""hi"""\r\n,3\r\n"line\nbreak",\r\n');
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(toCsv(["a"], [["=HYPERLINK(1)"], ["+1 201"], ["-x"], ["@sum"]])).toBe(
      "a\r\n'=HYPERLINK(1)\r\n'+1 201\r\n'-x\r\n'@sum\r\n",
    );
  });
});
