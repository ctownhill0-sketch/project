import type { Metadata } from "next";
import Link from "next/link";
import { ImportWizard } from "@/components/leads/import-wizard";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import type { ColumnMapping } from "@/lib/domain/csv-import";
import { listMappings } from "@/lib/leads/import";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Import leads" };

export default async function ImportPage() {
  const { workspaceId } = await requireUser();
  const mappings = await listMappings(await getDb(), workspaceId);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Import leads"
        context="Upload a CSV, match its columns, check the preview, then import. Duplicates and do-not-call firms are never imported."
        action={
          <Link href="/leads" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Back to leads
          </Link>
        }
      />
      <ImportWizard
        savedMappings={mappings.map((m) => ({ name: m.name, mapping: m.mapping as ColumnMapping }))}
      />
    </div>
  );
}
