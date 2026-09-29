// CSV import wizard backend (brief M1): preview (no writes) and commit (one audited transaction).
// Rows matching a do-not-call firm or the do-not-call list are never imported.
import { and, eq, isNull } from "drizzle-orm";
import { withAudit, writeAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { company, dncEntry, exclusionRule, importBatch, importMapping, scoreHistory } from "@/lib/db/schema";
import {
  classifyRows,
  guessMapping,
  mapRows,
  parseCsv,
  type ClassifiedRow,
  type ColumnMapping,
} from "@/lib/domain/csv-import";
import { normalizeFirmName, type ExistingFirm } from "@/lib/domain/dedupe";
import { classifyFit } from "@/lib/domain/exclusion";
import { DEFAULT_WEIGHTS, scoreLead, type ScoringWeights } from "@/lib/domain/scoring";
import { getSetting } from "@/lib/queries/settings";

export const MAX_IMPORT_ROWS = 5000;
/** States in the founder's metro (New York metro: 5 boroughs, Long Island, Westchester, North Jersey). */
const METRO_STATES = new Set(["NY", "NJ", "CT"]);

async function loadExisting(db: Db, workspaceId: string): Promise<ExistingFirm[]> {
  const rows = await db
    .select()
    .from(company)
    .where(and(eq(company.workspaceId, workspaceId), isNull(company.mergedIntoId)));
  return rows.map((c) => ({
    id: c.id,
    placeId: c.googlePlaceId,
    normalizedDomain: c.normalizedDomain,
    normalizedPhone: c.normalizedPhone,
    normalizedName: normalizeFirmName(c.name),
    city: c.city,
    dnc: c.dncFlag,
    dncSince: c.updatedAt,
  }));
}

async function loadDnc(db: Db, workspaceId: string) {
  const rows = await db.select().from(dncEntry).where(eq(dncEntry.workspaceId, workspaceId));
  return rows.map((r) => ({ kind: r.kind, value: r.value, reason: r.reason, createdAt: r.createdAt }));
}

export interface ImportPreview {
  headers: string[];
  mapping: ColumnMapping;
  rows: ClassifiedRow[];
  counts: Record<ClassifiedRow["status"], number>;
}

export async function previewImport(
  db: Db,
  workspaceId: string,
  csvText: string,
  mapping?: ColumnMapping,
): Promise<ImportPreview> {
  const table = parseCsv(csvText);
  if (table.length === 0) throw new Error("The file is empty.");
  if (table.length - 1 > MAX_IMPORT_ROWS)
    throw new Error(
      `The file has ${table.length - 1} rows. Split it into files of ${MAX_IMPORT_ROWS} or fewer.`,
    );
  const headers = table[0]!;
  const used = mapping ?? guessMapping(headers);
  if (!Object.values(used).includes("name")) {
    return {
      headers,
      mapping: used,
      rows: [],
      counts: { new: 0, duplicate: 0, possible_duplicate: 0, dnc: 0, error: 0 },
    };
  }
  const [existing, dncList] = await Promise.all([loadExisting(db, workspaceId), loadDnc(db, workspaceId)]);
  const rows = classifyRows(mapRows(table, used), existing, dncList);
  const counts = { new: 0, duplicate: 0, possible_duplicate: 0, dnc: 0, error: 0 };
  for (const r of rows) counts[r.status] += 1;
  return { headers, mapping: used, rows, counts };
}

export async function listMappings(db: Db, workspaceId: string) {
  return db.select().from(importMapping).where(eq(importMapping.workspaceId, workspaceId));
}

export interface CommitInput {
  fileName: string;
  csvText: string;
  mapping: ColumnMapping;
  /** Save this column mapping under a name for next time. */
  saveMappingAs?: string | null | undefined;
}

/** Imports new and possible-duplicate rows. Duplicates, do-not-call matches and rows with errors are skipped. */
export async function commitImport(db: Db, ctx: AuditContext, input: CommitInput, now: Date) {
  const preview = await previewImport(db, ctx.workspaceId, input.csvText, input.mapping);
  if (!Object.values(input.mapping).includes("name")) throw new Error("Map a column to Firm name first.");
  const weights = {
    ...DEFAULT_WEIGHTS,
    ...(await getSetting<Partial<ScoringWeights>>(db, ctx.workspaceId, "scoringWeights", {})),
  };
  const toImport = preview.rows.filter((r) => r.status === "new" || r.status === "possible_duplicate");

  return withAudit(db, ctx, { action: "create", entity: "import_batch" }, async (tx) => {
    let mappingId: string | null = null;
    if (input.saveMappingAs?.trim()) {
      const name = input.saveMappingAs.trim();
      const [saved] = await tx
        .insert(importMapping)
        .values({ workspaceId: ctx.workspaceId, createdById: ctx.userId, name, mapping: input.mapping })
        .onConflictDoUpdate({
          target: [importMapping.workspaceId, importMapping.name],
          set: { mapping: input.mapping },
        })
        .returning();
      mappingId = saved?.id ?? null;
    }
    const [batch] = await tx
      .insert(importBatch)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        fileName: input.fileName.slice(0, 200),
        mappingId,
        status: "committed",
        rowCount: preview.rows.length,
        importedCount: toImport.length,
        duplicateCount: preview.counts.duplicate + preview.counts.dnc,
        possibleDuplicateCount: preview.counts.possible_duplicate,
      })
      .returning();
    const rules = await tx.select().from(exclusionRule).where(eq(exclusionRule.workspaceId, ctx.workspaceId));
    for (const row of toImport) {
      const r = row.record;
      const fit = classifyFit({ name: r.name, domain: r.domain, types: [] }, rules);
      const facts = {
        software: r.software,
        units: r.units,
        liveListings: r.listings,
        isLocal: r.state ? METRO_STATES.has(r.state) : false,
        shop: null,
        fit: { status: fit.status, reason: fit.reason },
      };
      const scored = scoreLead(facts, weights);
      const [firm] = await tx
        .insert(company)
        .values({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          name: r.name,
          normalizedName: normalizeFirmName(r.name) || r.name.toLowerCase(),
          domain: r.domain,
          normalizedDomain: r.domain,
          websiteUrl: r.websiteUrl,
          phone: r.phone,
          normalizedPhone: r.normalizedPhone,
          city: r.city,
          state: r.state,
          isLocal: facts.isLocal,
          estUnits: r.units,
          estUnitsSource: r.units === null ? "unknown" : "csv",
          liveListingsCount: r.listings,
          liveListingsSource: r.listings === null ? "unknown" : "csv",
          detectedSoftware: r.software,
          softwareEvidence: r.software === "unknown" ? null : "From the CSV import",
          availableRentalsUrl: r.rentalsUrl,
          source: "csv",
          fieldSources: {
            name: "csv",
            ...(r.phone ? { phone: "csv" as const } : {}),
            ...(r.websiteUrl ? { websiteUrl: "csv" as const } : {}),
          },
          status: scored.excluded ? "excluded" : "new",
          score: scored.score,
          scoreBreakdown: scored.breakdown,
          fitStatus: fit.status,
          fitReason: fit.reason,
          importBatchId: batch!.id,
        })
        .returning({ id: company.id });
      await tx.insert(scoreHistory).values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        companyId: firm!.id,
        score: scored.score,
        breakdown: scored.breakdown,
        reason: "Imported from CSV",
      });
    }
    if (toImport.length) {
      await writeAudit(
        tx,
        ctx,
        { action: "create", entity: "company" },
        { after: { imported: toImport.length, importBatchId: batch!.id } },
      );
    }
    return {
      result: {
        batchId: batch!.id,
        imported: toImport.length,
        possibleDuplicates: preview.counts.possible_duplicate,
        skippedDuplicates: preview.counts.duplicate,
        skippedDnc: preview.counts.dnc,
        errors: preview.counts.error,
        at: now,
      },
      entityId: batch!.id,
      after: { fileName: input.fileName, counts: preview.counts },
    };
  });
}
