import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("treats our type-scale names as font sizes, not colors", () => {
    expect(cn("text-small text-muted-foreground")).toBe("text-small text-muted-foreground");
    expect(cn("text-small text-muted-foreground", "text-caption")).toBe("text-muted-foreground text-caption");
  });

  it("still merges real conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-foreground", "text-muted-foreground")).toBe("text-muted-foreground");
  });
});
