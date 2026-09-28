import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DisabledReason } from "@/components/states/disabled-reason";
import { EmptyState } from "@/components/states/empty-state";
import { Estimated } from "@/components/states/estimated";
import { PageError } from "@/components/states/page-error";
import { StatusBadge } from "@/components/states/status-badge";

describe("StatusBadge", () => {
  it.each([
    ["on_track", "On track"],
    ["at_risk", "At risk"],
    ["met", "Met"],
    ["missed", "Missed"],
    ["excluded", "Excluded"],
  ] as const)("%s shows an icon, a text label and a tone", (status, label) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector("svg[data-icon]")).not.toBeNull();
    expect(container.firstElementChild?.getAttribute("data-tone")).toMatch(
      /success|warning|destructive|neutral/,
    );
  });
});

describe("PageError", () => {
  it("says what failed, how to fix it, and offers Retry with no apology", async () => {
    const onRetry = vi.fn();
    render(
      <PageError what="Couldn't load leads" fix="Check that pnpm dev is still running." onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load leads");
    expect(screen.getByText("Check that pnpm dev is still running.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/sorry|oops|!/);
  });
});

describe("Estimated", () => {
  it("labels partial data", () => {
    render(
      <Estimated>
        <span>120 units</span>
      </Estimated>,
    );
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(screen.getByText("120 units")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders one sentence and exactly one action", () => {
    render(
      <EmptyState
        title="No leads yet"
        sentence="Import a CSV to build your call list."
        action={{ label: "Import CSV", href: "/leads/import" }}
      />,
    );
    expect(screen.getByText("Import a CSV to build your call list.")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Import CSV" })).toHaveAttribute("href", "/leads/import");
  });
});

describe("DisabledReason", () => {
  it("disables the control and explains why via aria-describedby", () => {
    render(
      <DisabledReason reason="Add a mailing address in Settings first.">
        {(props) => (
          <button type="button" {...props}>
            Send report
          </button>
        )}
      </DisabledReason>,
    );
    const button = screen.getByRole("button", { name: "Send report" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Add a mailing address in Settings first.");
  });
});

describe("EmptyState styling", () => {
  it("gives its action link a visible outline border, not a transparent one", () => {
    render(<EmptyState title="t" sentence="s" action={{ label: "Go", href: "/x" }} />);
    const cls = screen.getByRole("link", { name: "Go" }).className.split(" ");
    expect(cls).toContain("border-input");
    expect(cls).not.toContain("border-transparent");
  });
});
