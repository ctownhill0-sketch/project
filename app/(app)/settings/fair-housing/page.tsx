import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { and, asc, eq } from "drizzle-orm";
import { RuleForm, RuleItem, ScriptEditor, Tester } from "@/components/compliance/fair-housing-tools";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/states/status-badge";
import { requireUser } from "@/lib/auth/require-user";
import { categoryLabel, checkStatus } from "@/lib/compliance/labels";
import { allRules, latestCheck, recentChecks } from "@/lib/compliance/fair-housing";
import { getDb } from "@/lib/db";
import { script } from "@/lib/db/schema";
import { SCREENING_LABEL } from "@/lib/domain/fair-housing";

export const metadata: Metadata = { title: "Fair-housing check" };

const WHAT: Record<string, string> = {
  tester: "Text check",
  script: "Script",
  vacancy_audit: "Vacancy audit",
};

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="border-border bg-card flex scroll-mt-20 flex-col gap-4 rounded-xl border p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="text-h3 font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function FairHousingPage() {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const [rules, checks, scripts] = await Promise.all([
    allRules(db, workspaceId),
    recentChecks(db, workspaceId),
    db
      .select()
      .from(script)
      .where(and(eq(script.workspaceId, workspaceId), eq(script.isActive, true)))
      .orderBy(asc(script.kind)),
  ]);
  const scriptChecks = await Promise.all(scripts.map((s) => latestCheck(db, workspaceId, "script", s.id)));
  const active = rules.filter((r) => r.isActive).length;
  const blocked = checks.filter((c) => c.outcome === "block").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fair-housing check"
        context={`Scripts and audits are checked before they're used. ${SCREENING_LABEL}`}
        numbers={[
          { label: "Rules on", value: <Num value={active} /> },
          { label: "Recent checks", value: <Num value={checks.length} /> },
          { label: "Blocked in recent checks", value: <Num value={blocked} /> },
        ]}
        action={
          <Link href="/settings" className="text-link text-small underline underline-offset-2">
            Back to settings
          </Link>
        }
      />

      <Section
        id="tester"
        title="Check a text"
        description="Paste any wording a renter or owner will see. Every check is logged."
      >
        <Tester />
      </Section>

      <Section
        id="scripts"
        title="Call scripts"
        description="Saving a script runs the check. Blocked wording can't be saved; a warning needs a reason."
      >
        <ul className="border-border divide-border divide-y rounded-xl border">
          {scripts.map((s, i) => {
            const c = scriptChecks[i];
            return (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{s.name}</p>
                  {c ? (
                    <StatusBadge status={checkStatus(c)} />
                  ) : (
                    <span className="text-small text-muted-foreground">Not checked yet</span>
                  )}
                </div>
                <p className="text-small text-muted-foreground">{s.body}</p>
                <ScriptEditor script={{ id: s.id, name: s.name, body: s.body }} />
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        id="rules"
        title="Rules"
        description="Phrases to flag. Includes New York and New Jersey source-of-income protections. Turn a rule off rather than delete it, so old checks still make sense."
      >
        <ul
          className="border-border divide-border divide-y rounded-xl border"
          aria-label="Fair-housing rules"
        >
          {rules.map((r) => (
            <RuleItem key={r.id} rule={r} />
          ))}
        </ul>
        <h3 className="font-semibold">Add a rule</h3>
        <RuleForm />
      </Section>

      <Section
        id="log"
        title="Check log"
        description="The last 50 checks. Only a fingerprint of the text is kept, never the text itself."
      >
        {checks.length === 0 ? (
          <p className="text-muted-foreground">No checks yet.</p>
        ) : (
          <div
            className="border-border relative overflow-x-auto rounded-xl border"
            role="region"
            aria-label="Check log table"
            tabIndex={0}
          >
            <table className="text-small w-full min-w-[640px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    When
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    What
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Result
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Flagged
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Override reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id} className="border-border border-t">
                    <td className="px-3 py-2">{when(c.createdAt)}</td>
                    <td className="px-3 py-2">{WHAT[c.entityType] ?? c.entityType}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={checkStatus(c)} />
                    </td>
                    <td className="px-3 py-2">
                      {c.matches.length
                        ? c.matches.map((m) => `“${m.phrase}” (${categoryLabel(m.category)})`).join(", ")
                        : "None"}
                    </td>
                    <td className="px-3 py-2">{c.overrideReason ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
