import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips } from "@/components/filter-chips";
import { PlacesGrid } from "@/components/finder/places-grid";
import { PlacePanel } from "@/components/finder/place-panel";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { SplitView } from "@/components/split/split-view";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { purgeExpiredGoogleContent } from "@/lib/finder/service";
import { listPlaces, placeCounts, placeDetail, type PlaceFilter } from "@/lib/queries/finder";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Finder results" };

const FILTER_LABEL: Record<PlaceFilter, string> = {
  all: "All",
  pending: "Pending",
  ready: "Ready",
  added: "Added",
  duplicates: "Duplicates",
  not_a_fit: "Not a fit",
  dnc: "Do not call",
};

export default async function FinderResultsPage({ searchParams }: PageProps<"/finder/results">) {
  const user = await requireUser();
  const { workspaceId } = user;
  const db = await getDb();
  await purgeExpiredGoogleContent(db, user, new Date());
  const params = await searchParams;
  const runId = typeof params.run === "string" && /^[0-9a-f-]{36}$/.test(params.run) ? params.run : null;
  const filter = (
    typeof params.filter === "string" && params.filter in FILTER_LABEL ? params.filter : "all"
  ) as PlaceFilter;
  const [rows, counts] = await Promise.all([
    listPlaces(db, workspaceId, { runId, filter }),
    placeCounts(db, workspaceId, runId),
  ]);
  const requested = typeof params.place === "string" ? params.place : null;
  const selectedId = requested ?? rows[0]?.id ?? null;
  const detail = selectedId ? await placeDetail(db, workspaceId, selectedId) : null;
  const base = (f: PlaceFilter) =>
    `/finder/results?${runId ? `run=${runId}&` : ""}${f === "all" ? "" : `filter=${f}`}`.replace(/[?&]$/, "");
  const prefix = `${base(filter)}${base(filter).includes("?") ? "&" : "?"}place=`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Finder results"
        context={
          runId
            ? "Everything this search found, with each value's source."
            : "Everything the finder has found, best score first."
        }
        numbers={[
          { label: "Places", value: <Num value={counts.all} /> },
          { label: "Ready to triage", value: <Num value={counts.ready} /> },
          { label: "Added", value: <Num value={counts.added} /> },
          { label: "Do not call", value: <Num value={counts.dnc} /> },
        ]}
        action={
          <Link
            href={runId ? `/finder/triage?run=${runId}` : "/finder/triage"}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Start triage
          </Link>
        }
      />
      <FilterChips
        label="Show"
        chips={(Object.keys(FILTER_LABEL) as PlaceFilter[]).map((f) => ({
          label: `${FILTER_LABEL[f]} (${counts[f]})`,
          href: base(f),
          active: f === filter,
        }))}
      />
      {counts.all === 0 ? (
        <EmptyState
          title="No places yet"
          sentence="Run a search to find property managers in a town."
          action={{ label: "Run a search", href: "/finder" }}
        />
      ) : (
        <div className="flex h-[70dvh] min-h-[440px]">
          <SplitView
            id="finder-results"
            listSize={60}
            detailLabel={detail ? `Place: ${detail.name}` : "Place"}
            openOnNarrow={requested !== null}
            closeHref={base(filter)}
            list={<PlacesGrid rows={rows} selectedId={selectedId} hrefPrefix={prefix} />}
            detail={detail ? <PlacePanel detail={detail} /> : null}
          />
        </div>
      )}
    </div>
  );
}
