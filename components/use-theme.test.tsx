import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTheme } from "@/components/use-theme";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme}
    </button>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

describe("useTheme", () => {
  it("reads the theme the head script set", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<Probe />);
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });

  it("switches the document theme and remembers the choice", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<Probe />);
    await act(async () => screen.getByRole("button").click());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });
});
