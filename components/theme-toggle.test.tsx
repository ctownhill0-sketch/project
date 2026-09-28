import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("is a real button whose name says what it will do", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(button.tagName).toBe("BUTTON");
    await act(async () => button.click());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });
});
