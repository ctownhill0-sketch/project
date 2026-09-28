import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips } from "@/components/filter-chips";
import { Icons } from "@/components/icons";
import { LeadPanel } from "@/components/leads/lead-panel";
import { LeadsGrid } from "@/components/leads/leads-grid";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { navLabel } from "@/components/shell/nav-items";
import { SplitView } from "@/components/split/split-view";
import { EmptyState } from "@/components/states/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { softwareLabel } from "@/lib/domain/scoring";
import { LEAD_STATUSES, SOFTWARE_KINDS, leadsHref, parseLeadFilters } from "@/lib/queries/lead-filters";
import { getLeadDetail, leadCounts, listLeads } from "@/lib/queries/leads";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: navLabel("/leads") };

const STATUS_CHIP: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: "New",
  researching: "Researching",
  ready: "Ready to call",
  contacted: "Contacted",
  excluded: "Excluded",
  archived: "Archived",
};

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const params = await searchParams;
  const filters = parseLeadFilters(params);
  const [rows, counts] = await Promise.all([
    listLeads(db, workspaceId, filters),
    leadCounts(db, workspaceId),
  ]);
  const requested = typeof params.lead === "string" ? params.lead : null;
  const selectedId = requested ?? rows[0]?.id ?? null;
  const lead = selectedId ? await getLeadDetail(db, workspaceId, selectedId) : null;
  const filtered = Object.keys(filters).length > 0;

  const findLeads = (
    <Link href="/finder" className={cn(buttonVariants({ size: "lg" }))}>
      <Icons.finder data-icon="inline-start" />
      Find leads
    </Link>
  );

  if (counts.total === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Leads" context="Property managers to shop, score and call." action={findLeads} />
        <EmptyState
          title="No leads yet"
          sentence="Find property managers in a town to start your list."
          action={{ label: "Find leads", href: "/finder" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leads"
        context="Property managers to shop, score and call. Highest score first."
        numbers={[
          { label: "Leads", value: <Num value={counts.total} /> },
          { label: "Callable", value: <Num value={counts.ready} />, note: "Scored, not excluded" },
          { label: "Excluded", value: <Num value={counts.excluded} />, note: "AppFolio or do not call" },
          {
            label: "Possible duplicates",
            value: <Num value={counts.possibleDuplicates} />,
            note: "Same domain or phone",
          },
        ]}
        action={findLeads}
      />

      <section aria-label="Filters" className="flex flex-col gap-3">
        <form role="search" action="/leads" className="flex max-w-md gap-2">
          {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
          {filters.software ? <input type="hidden" name="software" value={filters.software} /> : null}
          <label htmlFor="leads-q" className="sr-only">
            Search leads
          </label>
          <Input
            id="leads-q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Name, town or phone"
            maxLength={100}
          />
          <Button type="submit" variant="outline">
            <Icons.search data-icon="inline-start" />
            Search
          </Button>
        </form>
        <FilterChips
          label="Status"
          chips={[
            { label: "All", href: leadsHref(filters, { status: undefined }), active: !filters.status },
            ...LEAD_STATUSES.map((s) => ({
              label: STATUS_CHIP[s],
              href: leadsHref(filters, { status: s }),
              active: filters.status === s,
            })),
          ]}
        />
        <FilterChips
          label="Software"
          chips={[
            { label: "Any", href: leadsHref(filters, { software: undefined }), active: !filters.software },
            ...SOFTWARE_KINDS.map((s) => ({
              label: softwareLabel(s),
              href: leadsHref(filters, { software: s }),
              active: filters.software === s,
            })),
          ]}
        />
      </section>

      <div className="flex h-[70dvh] min-h-[440px]">
        <SplitView
          id="leads"
          detailLabel={lead ? `Lead: ${lead.name}` : "Lead"}
          openOnNarrow={requested !== null}
          closeHref={leadsHref(filters)}
          listSize={60}
          list={
            <LeadsGrid
              rows={rows}
              selectedId={selectedId}
              hrefPrefix={leadsHref(filters, {}, true)}
              summary={
                <span className="flex flex-wrap items-center gap-x-3" aria-live="polite">
                  <span>
                    Showing <Num value={rows.length} /> of <Num value={counts.total} />
                  </span>
                  {filtered ? (
                    <Link
                      href="/leads"
                      className="text-link inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      <Icons.close className="size-3.5" />
                      Clear filters
                    </Link>
                  ) : null}
                </span>
              }
            />
          }
          detail={lead ? <LeadPanel lead={lead} /> : null}
        />
      </div>
    </div>
  );
}
