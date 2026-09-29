import { describe, expect, it } from "vitest";
import { flagReview, RESPONSIVENESS_RULES } from "@/lib/domain/review-flags";

describe("flagReview", () => {
  it("flags responsiveness complaints with the matched quote", () => {
    expect(flagReview("Called three times and they never called back.")).toMatchObject({
      category: "never_called_back",
      quote: "never called back",
    });
    expect(flagReview("No response to my emails for two weeks")?.category).toBe("no_response");
    expect(flagReview("Very hard to reach anyone in the office")?.category).toBe("slow_response");
    expect(flagReview("The office doesn't answer the phone")?.category).toBe("no_response");
    expect(flagReview("They never returned my call")?.category).toBe("never_called_back");
  });

  it("does not flag praise or unrelated complaints", () => {
    expect(flagReview("They always called back within the hour!")).toBeNull();
    expect(flagReview("Great response time, very responsive team")).toBeNull();
    expect(flagReview("The kitchen was small")).toBeNull();
    expect(flagReview("")).toBeNull();
  });

  it("exposes its rules for Settings", () => {
    expect(RESPONSIVENESS_RULES.length).toBeGreaterThan(3);
  });
});
