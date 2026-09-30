import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { PlacesSettings } from "@/components/settings/places-settings";
import { navLabel } from "@/components/shell/nav-items";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { placesKeyStatus } from "@/lib/finder/runtime";
import { getFinderConfig, usageCounts } from "@/lib/finder/service";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  BrandForm,
  DeleteDemoData,
  ExclusionForm,
  HoursForm,
  RuleList,
  SoftwarePatternForm,
  ThresholdsForm,
  WeekForm,
  WeightsForm,
  type Thresholds,
} from "@/components/settings/settings-forms";
import { exclusionRule, softwarePattern, weeklyMetric } from "@/lib/db/schema";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from "@/lib/domain/hours";
import { nyDateKey } from "@/lib/domain/ny-time";
import { softwareLabel, type Software } from "@/lib/domain/scoring";
import { getSetting } from "@/lib/queries/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { demoDataCounts } from "@/lib/settings/demo";
import { mondayOf } from "@/lib/settings/service";

export const metadata: Metadata = { title: navLabel("/settings") };

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

const SECTIONS = [
  ["weekly", "Weekly numbers"],
  ["scoring", "Scoring"],
  ["software", "Software"],
  ["exclusions", "Exclusions"],
  ["hours", "Business hours"],
  ["thresholds", "Thresholds"],
  ["brand", "Brand"],
  ["places", "Google Places"],
  ["data", "Data"],
] as const;

export default async function SettingsPage() {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const now = new Date();
  const setting = <T,>(key: string) => getSetting<T>(db, workspaceId, key, DEFAULT_SETTINGS[key] as T);
  const [
    config,
    usage,
    hours,
    killTest,
    guarantee,
    callBlocks,
    brand,
    shopperName,
    patterns,
    exclusions,
    weeks,
    demo,
  ] = await Promise.all([
    getFinderConfig(db, workspaceId),
    usageCounts(db, workspaceId, "search", now),
    getSetting<BusinessHours>(db, workspaceId, "businessHours", DEFAULT_BUSINESS_HOURS),
    setting<Thresholds["killTest"]>("killTest"),
    setting<Thresholds["guarantee"]>("guarantee"),
    setting<Thresholds["callBlocks"]>("callBlocks"),
    setting<{ wordmark: string }>("brand"),
    getSetting<string | null>(db, workspaceId, "shopperName", null),
    db
      .select()
      .from(softwarePattern)
      .where(eq(softwarePattern.workspaceId, workspaceId))
      .orderBy(asc(softwarePattern.software), asc(softwarePattern.pattern)),
    db
      .select()
      .from(exclusionRule)
      .where(eq(exclusionRule.workspaceId, workspaceId))
      .orderBy(asc(exclusionRule.kind), asc(exclusionRule.pattern)),
    db
      .select()
      .from(weeklyMetric)
      .where(and(eq(weeklyMetric.workspaceId, workspaceId)))
      .orderBy(desc(weeklyMetric.weekStart))
      .limit(4),
    demoDataCounts(db, workspaceId),
  ]);
  const key = placesKeyStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        context="How the app scores, searches and checks. Changes apply right away and are logged."
        numbers={[
          { label: "Google key", value: key.configured ? "Set" : "Missing" },
          {
            label: "Google requests today",
            value: (
              <>
                <Num value={usage.today} /> of <Num value={config.caps.search.daily} />
              </>
            ),
          },
          { label: "Demo firms left", value: <Num value={demo.companies} /> },
        ]}
      />
      <nav aria-label="Settings sections" className="flex flex-wrap gap-x-4 gap-y-2">
        {SECTIONS.map(([id, label]) => (
          <Link key={id} href={`#${id}`} className="text-link text-small underline underline-offset-2">
            {label}
          </Link>
        ))}
        <Link href="/settings/fair-housing" className="text-link text-small underline underline-offset-2">
          Fair-housing check
        </Link>
      </nav>

      <Section
        id="weekly"
        title="Weekly numbers"
        description="Enter these once a week. They drive MRR and growth on the dashboard."
      >
        <WeekForm monday={mondayOf(nyDateKey(now))} />
        {weeks.length ? (
          <ul className="text-small text-muted-foreground flex flex-col gap-1" aria-label="Recent weeks">
            {weeks.map((w) => (
              <li key={w.id}>
                Week of {w.weekStart}: MRR <Num value={Number(w.mrr)} format="money" />,{" "}
                <Num value={w.paidClients} /> paying
                {w.notes ? ` · ${w.notes}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        id="scoring"
        title="Scoring weights"
        description="Points each fact adds to a lead's score. Saving rescores every lead and logs why."
      >
        <WeightsForm weights={config.weights as unknown as Record<string, number>} />
      </Section>

      <Section
        id="software"
        title="Leasing software patterns"
        description="How the website check recognizes each leasing platform."
      >
        <RuleList
          list="software"
          label="Software patterns"
          items={patterns.map((p) => ({
            id: p.id,
            title: p.pattern,
            detail: `${softwareLabel(p.software as Software)} · ${p.kind === "domain" ? "link domain" : "page text"}`,
            isActive: p.isActive,
          }))}
        />
        <SoftwarePatternForm />
      </Section>

      <Section
        id="exclusions"
        title="Exclusion list"
        description="Chains and firms that aren't a fit. The finder and imports skip matches."
      >
        <RuleList
          list="exclusion"
          label="Exclusion rules"
          items={exclusions.map((e) => ({
            id: e.id,
            title: e.pattern,
            detail: `${e.kind === "chain" ? "Chain" : "Not a fit"} · by ${e.match}${e.category ? ` · ${e.category}` : ""}`,
            isActive: e.isActive,
          }))}
        />
        <ExclusionForm />
      </Section>

      <Section
        id="hours"
        title="Business hours"
        description="New York time. Saving re-buckets every mystery shop."
      >
        <HoursForm hours={hours} />
      </Section>

      <Section
        id="thresholds"
        title="Thresholds"
        description="The kill test, the pilot guarantee and when call blocks run."
      >
        <ThresholdsForm t={{ killTest, guarantee, callBlocks }} />
      </Section>

      <Section id="brand" title="Brand" description="The wordmark appears on the audit PDF.">
        <BrandForm wordmark={brand.wordmark} shopperName={shopperName ?? ""} />
      </Section>

      <Section
        id="places"
        title="Google Places"
        description="The Lead finder's only paid service. Stays free under the caps below."
      >
        <PlacesSettings key_={key} caps={config.caps} />
      </Section>

      <Section
        id="data"
        title="Data"
        description="Everything stays on this Mac. Export or back it up any time."
      >
        <div className="flex flex-wrap gap-3">
          <a href="/settings/export" download className={cn(buttonVariants({ variant: "outline" }))}>
            Export all data (JSON)
          </a>
          <a href="/settings/backup" download className={cn(buttonVariants({ variant: "outline" }))}>
            Download a database backup
          </a>
          <a href="/leads/export" download className={cn(buttonVariants({ variant: "outline" }))}>
            Export leads (CSV)
          </a>
        </div>
        <p className="text-small text-muted-foreground">
          To restore a backup: stop the app, unpack the file into{" "}
          <span className="font-medium">.data/pglite</span>, and start it again.
        </p>
        <h3 className="font-semibold">Delete demo data</h3>
        <DeleteDemoData companies={demo.companies} weeks={demo.weeks} />
      </Section>
    </div>
  );
}
