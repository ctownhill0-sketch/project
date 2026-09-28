import { describe, expect, it } from "vitest";
import { isAllowedHost } from "@/lib/auth/host";

describe("isAllowedHost", () => {
  it.each(["localhost:3000", "127.0.0.1:3000", "localhost", "[::1]:3000"])("allows %s", (host) => {
    expect(isAllowedHost(host)).toBe(true);
  });

  it.each(["evil.example:3000", "localhost.evil.example", "127.0.0.1.evil.example", "", null])(
    "rejects %s (DNS-rebinding defence)",
    (host) => {
      expect(isAllowedHost(host)).toBe(false);
    },
  );
});
