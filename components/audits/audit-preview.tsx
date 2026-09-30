import { auditSections, type AuditSnapshot } from "@/lib/domain/audit";

/** The page as the PDF draws it, from the same sections. */
export function AuditPreview({
  snapshot,
  summary,
  brand,
}: {
  snapshot: AuditSnapshot;
  summary: string;
  brand: string;
}) {
  return (
    <article
      aria-label="Audit preview"
      className="border-border bg-card flex flex-col gap-5 rounded-xl border p-6"
    >
      <header className="flex flex-col gap-1">
        <p className="text-primary text-small font-semibold">{brand}</p>
        <h2 className="text-h3 font-semibold">Vacancy audit: {snapshot.firmName}</h2>
      </header>
      <div className="bg-background border-border flex flex-col gap-1 rounded-lg border p-4">
        <p className="text-caption text-muted-foreground font-medium">Summary · Written by you</p>
        <p>
          {summary.trim() || <span className="text-muted-foreground">Your three sentences go here.</span>}
        </p>
      </div>
      {auditSections(snapshot).map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h3 className="font-semibold">{section.title}</h3>
          {section.rows?.length ? (
            <div
              className="relative overflow-x-auto"
              role="region"
              aria-label={`${section.title} table`}
              tabIndex={0}
            >
              <table className="text-small w-full min-w-[420px]">
                {section.rows.some((r) => r.metro !== undefined) ? (
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-3 text-left font-medium">
                        <span className="sr-only">Measure</span>
                      </th>
                      <th scope="col" className="py-1.5 pr-3 text-left font-medium">
                        This firm
                      </th>
                      <th scope="col" className="py-1.5 text-left font-medium">
                        Metro median
                      </th>
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.label} className="border-border border-t">
                      <th scope="row" className="text-muted-foreground py-1.5 pr-3 text-left font-normal">
                        {row.label}
                      </th>
                      <td className="num py-1.5 pr-3 font-medium">{row.firm}</td>
                      {row.metro !== undefined ? <td className="num py-1.5">{row.metro}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {section.lines?.map((line) => (
            <p
              key={line}
              className={section.title === "Method" ? "text-small text-muted-foreground" : "text-small"}
            >
              {line}
            </p>
          ))}
        </section>
      ))}
      <p className="text-caption text-muted-foreground">
        Response behavior only; rents are never compared across firms. Wording checked for fair-housing issues
        (screening aid, not legal advice).
      </p>
    </article>
  );
}
