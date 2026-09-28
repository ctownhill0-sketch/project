import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Num } from "@/components/num";

describe("Num", () => {
  it("formats with US grouping and tabular figures", () => {
    render(<Num value={1234.5} />);
    const el = screen.getByText("1,234.5");
    expect(el).toHaveClass("num");
  });

  it("formats currency and percent", () => {
    render(
      <>
        <Num value={59.18} format="currency" />
        <Num value={0.07} format="percent" />
      </>,
    );
    expect(screen.getByText("$59.18")).toBeInTheDocument();
    // Growth always shows one decimal so 0.0% and 7.0% line up.
    expect(screen.getByText("7.0%")).toBeInTheDocument();
  });

  it("formats whole-dollar money for MRR-style numbers", () => {
    render(<Num value={400} format="money" />);
    expect(screen.getByText("$400")).toBeInTheDocument();
  });

  it('shows "unknown" instead of inventing a number', () => {
    render(<Num value={null} />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
