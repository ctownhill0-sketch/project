import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Num } from "@/components/num";
import { PageHeader } from "@/components/page-header";
import { PlacesSettings } from "@/components/settings/places-settings";
import { navLabel } from "@/components/shell/nav-items";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { placesKeyStatus } from "@/lib/finder/runtime";
import { getFinderConfig, usageCounts } from "@/lib/finder/service";

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

export default async function SettingsPage() {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const now = new Date();
  const [config, usage] = await Promise.all([
    getFinderConfig(db, workspaceId),
    usageCounts(db, workspaceId, "search", now),
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
        ]}
      />
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        <Link href="#places" className="text-link text-small underline underline-offset-2">
          Google Places
        </Link>
        <Link href="/settings/fair-housing" className="text-link text-small underline underline-offset-2">
          Fair-housing check
        </Link>
      </nav>
      <Section
        id="places"
        title="Google Places"
        description="The Lead finder's only paid service. Stays free under the caps below."
      >
        <PlacesSettings key_={key} caps={config.caps} />
      </Section>
    </div>
  );
}
