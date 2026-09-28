import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/page-header";

describe("PageHeader", () => {
  it("renders title, context, key numbers as a description list, and one action", () => {
    render(
      <PageHeader
        title="Leads"
        context="Scored, deduplicated NYC-metro firms."
        numbers={[
          { label: "Leads", value: "412" },
          { label: "Ready to call", value: "87", note: "score above 0" },
        ]}
        action={<a href="/finder">Find leads</a>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Leads" })).toBeInTheDocument();
    expect(screen.getByText("Scored, deduplicated NYC-metro firms.")).toBeInTheDocument();
    const list = screen.getByRole("group", { name: "Key numbers" });
    expect(
      within(list)
        .getAllByRole("term")
        .map((t) => t.textContent),
    ).toEqual(["Leads", "Ready to call"]);
    expect(within(list).getAllByRole("definition")[0]).toHaveTextContent("412");
    expect(screen.getByRole("link", { name: "Find leads" })).toBeInTheDocument();
  });

  it("works with no key numbers and no action", () => {
    render(<PageHeader title="Settings" context="Your rules and keys." />);
    expect(screen.queryByRole("group", { name: "Key numbers" })).toBeNull();
  });
});
