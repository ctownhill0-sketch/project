"use client";

import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Icons } from "@/components/icons";
import { useRecordKeys } from "@/components/split/use-record-keys";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePersisted } from "@/lib/use-persisted";
import { cn } from "@/lib/utils";

/**
 * The DataGrid interface. Pages describe columns with this shape only, so the renderer below
 * (TanStack Table + Virtual on shadcn's table pattern) can be swapped for reui later.
 */
export interface GridColumn<T extends RowData> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Width in px. */
  width: number;
  /** A sort key makes the column sortable. null sorts last. */
  sortValue?: (row: T) => string | number | null;
  align?: "start" | "end";
  /** Default true. The first (name) column should not be hideable. */
  hideable?: boolean;
  /** Hidden until the viewer turns it on. */
  hiddenByDefault?: boolean;
}

export interface DataGridProps<T extends RowData> {
  label: string;
  rows: T[];
  columns: GridColumn<T>[];
  getRowId: (row: T) => string;
  selectedId: string | null;
  /** Selection lives in the URL: `hrefPrefix + id`. */
  hrefPrefix: string;
  /** Key for this viewer's density and column choices. */
  storageKey: string;
  empty?: ReactNode;
  /** Shown at the start of the toolbar, e.g. "Showing 12 of 50". */
  summary?: ReactNode;
}

type Density = "comfortable" | "compact";
const ROW_HEIGHT: Record<Density, number> = { comfortable: 52, compact: 36 };

const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
});

function compare(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en-US", { sensitivity: "base", numeric: true });
}

export function DataGrid<T extends RowData>({
  label,
  rows,
  columns,
  getRowId,
  selectedId,
  hrefPrefix,
  storageKey,
  empty,
  summary,
}: DataGridProps<T>) {
  const [densityRaw, setDensity] = usePersisted(`${storageKey}:density`, "comfortable");
  const density: Density = densityRaw === "compact" ? "compact" : "comfortable";
  const defaultHidden = useMemo(
    () =>
      JSON.stringify(Object.fromEntries(columns.filter((c) => c.hiddenByDefault).map((c) => [c.id, false]))),
    [columns],
  );
  const [visibilityRaw, setVisibilityRaw] = usePersisted(`${storageKey}:columns`, defaultHidden);
  const columnVisibility = useMemo<ColumnVisibilityState>(() => {
    try {
      return JSON.parse(visibilityRaw) as ColumnVisibilityState;
    } catch {
      return {};
    }
  }, [visibilityRaw]);

  const defs = useMemo<ColumnDef<typeof features, T>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        header: c.header,
        accessorFn: (row: T) => (c.sortValue ? c.sortValue(row) : null),
        cell: ({ row }) => c.cell(row.original),
        enableSorting: Boolean(c.sortValue),
        enableHiding: c.hideable !== false,
        sortFn: (a, b, id) =>
          compare(a.getValue(id) as string | number | null, b.getValue(id) as string | number | null),
        meta: { align: c.align ?? "start", width: c.width },
      })),
    [columns],
  );

  const table = useTable({
    features,
    columns: defs,
    data: rows,
    getRowId: (row: T) => getRowId(row),
    state: { columnVisibility },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      setVisibilityRaw(JSON.stringify(next));
    },
  });

  const model = table.getRowModel().rows;
  const ids = useMemo(() => model.map((r) => r.id), [model]);
  const gridRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { index, select, onKeyDown } = useRecordKeys({ ids, selectedId, hrefPrefix, containerRef: gridRef });

  const rowHeight = ROW_HEIGHT[density];
  const virtualizer = useVirtualizer({
    count: model.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (i) => model[i]?.id ?? i,
    overscan: 10,
  });
  useEffect(() => virtualizer.measure(), [virtualizer, rowHeight]);

  const selectedIndex = selectedId ? ids.indexOf(selectedId) : -1;
  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
  }, [virtualizer, selectedIndex]);

  const leaf = table.getVisibleLeafColumns();
  const width = leaf.reduce((sum, c) => sum + (c.columnDef.meta as { width: number }).width, 0);
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  const activeId = selectedIndex >= 0 || model.length > 0 ? `row-${ids[index]}` : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <div className="text-small text-muted-foreground mr-auto min-w-0">{summary}</div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm">
                <Icons.columns data-icon="inline-start" />
                Columns
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(Boolean(v))}
                  >
                    {String(c.columnDef.header)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div role="group" aria-label="Row density" className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Comfortable rows"
            aria-pressed={density === "comfortable"}
            className="aria-pressed:bg-muted"
            onClick={() => setDensity("comfortable")}
          >
            <Icons.comfortable />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Compact rows"
            aria-pressed={density === "compact"}
            className="aria-pressed:bg-muted"
            onClick={() => setDensity("compact")}
          >
            <Icons.compact />
          </Button>
        </div>
      </div>

      {model.length === 0 && empty ? (
        <div className="p-4">{empty}</div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          <table
            ref={gridRef}
            role="grid"
            aria-label={label}
            aria-rowcount={model.length + 1}
            aria-activedescendant={activeId}
            tabIndex={0}
            data-density={density}
            onKeyDown={onKeyDown}
            style={{ minWidth: width }}
            className="text-small w-full table-fixed border-separate border-spacing-0 outline-offset-[-2px]"
          >
            <colgroup>
              {leaf.map((c) => (
                <col key={c.id} style={{ width: (c.columnDef.meta as { width: number }).width }} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} aria-rowindex={1}>
                  {group.headers.map((header) => {
                    const col = header.column;
                    const sorted = col.getIsSorted();
                    const end = (col.columnDef.meta as { align: string }).align === "end";
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                        }
                        className={cn(
                          "bg-card border-border text-muted-foreground sticky top-0 border-b px-3 py-2 font-medium whitespace-nowrap",
                          end ? "text-right" : "text-left",
                        )}
                      >
                        {col.getCanSort() ? (
                          <button
                            type="button"
                            onClick={col.getToggleSortingHandler()}
                            className={cn(
                              "hover:text-foreground inline-flex items-center gap-1 rounded-sm",
                              end && "flex-row-reverse",
                            )}
                          >
                            {String(col.columnDef.header)}
                            {sorted === "asc" ? (
                              <Icons.sortAsc className="size-3.5" />
                            ) : sorted === "desc" ? (
                              <Icons.sortDesc className="size-3.5" />
                            ) : (
                              <Icons.sortNone className="size-3.5 opacity-60" />
                            )}
                          </button>
                        ) : (
                          String(col.columnDef.header)
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {padTop > 0 ? (
                <tr aria-hidden="true">
                  <td colSpan={leaf.length} style={{ height: padTop, padding: 0 }} />
                </tr>
              ) : null}
              {items.map((item) => {
                const row = model[item.index];
                if (!row) return null;
                const selected = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    id={`row-${row.id}`}
                    aria-rowindex={item.index + 2}
                    aria-selected={selected}
                    onClick={() => select(item.index, true)}
                    style={{ height: rowHeight }}
                    className={cn("hover:bg-muted cursor-default", selected && "bg-muted")}
                  >
                    {row.getVisibleCells().map((cell, i) => {
                      const end = (cell.column.columnDef.meta as { align: string }).align === "end";
                      return (
                        <td
                          key={cell.id}
                          role="gridcell"
                          className={cn(
                            "border-border truncate border-b px-3",
                            end && "num text-right",
                            i === 0 && "relative font-medium",
                            i === 0 &&
                              selected &&
                              "before:bg-accent before:absolute before:inset-y-0 before:left-0 before:w-0.5",
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {padBottom > 0 ? (
                <tr aria-hidden="true">
                  <td colSpan={leaf.length} style={{ height: padBottom, padding: 0 }} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
