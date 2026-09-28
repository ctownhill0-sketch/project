import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePersisted } from "@/lib/use-persisted";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("usePersisted", () => {
  it("starts at the fallback and remembers a change", () => {
    const { result } = renderHook(() => usePersisted("pref-a", "comfortable"));
    expect(result.current[0]).toBe("comfortable");
    act(() => result.current[1]("compact"));
    expect(result.current[0]).toBe("compact");
    expect(localStorage.getItem("pref-a")).toBe("compact");
  });

  it("still works when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => usePersisted("pref-b", "comfortable"));
    expect(result.current[0]).toBe("comfortable");
    act(() => result.current[1]("compact"));
    expect(result.current[0]).toBe("compact");
  });
});
