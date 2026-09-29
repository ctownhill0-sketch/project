"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { commitImport, previewImport } from "@/lib/leads/import";
import { BULK_STATUSES, bulkSetStatus, mergeCompanies, setSoftwareOverride } from "@/lib/leads/manage";
import { deleteSavedView, saveSavedView } from "@/lib/leads/views";

const Id = z.uuid();
const SOFTWARE = [
  "appfolio",
  "buildium",
  "doorloop",
  "rent_manager",
  "yardi",
  "propertyware",
  "rentvine",
  "tenantcloud",
  "other",
  "none",
  "unknown",
] as const;
const FIELDS = [
  "name",
  "website",
  "phone",
  "city",
  "state",
  "units",
  "listings",
  "software",
  "rentalsUrl",
] as const;
const Mapping = z.record(z.string().max(200), z.enum(FIELDS));
const CsvText = z.string().min(1, "The file is empty").max(5_000_000, "The file is over 5 MB");

export async function previewImportAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z.object({ csvText: CsvText, mapping: Mapping.optional() }).parse(raw);
    const p = await previewImport(await getDb(), user.workspaceId, input.csvText, input.mapping);
    // The browser only needs the first 20 rows to show, plus the counts.
    return {
      headers: p.headers,
      mapping: p.mapping,
      counts: p.counts,
      rows: p.rows.slice(0, 20),
      total: p.rows.length,
    };
  });
}

export async function commitImportAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({
        fileName: z.string().min(1).max(200),
        csvText: CsvText,
        mapping: Mapping,
        saveMappingAs: z.string().max(80).nullish(),
      })
      .parse(raw);
    const r = await commitImport(await getDb(), user, input, new Date());
    refresh();
    return r;
  });
}

export async function bulkStatusAction(ids: unknown, status: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const r = await bulkSetStatus(
      await getDb(),
      user,
      z.array(Id).min(1).max(5000).parse(ids),
      z.enum(BULK_STATUSES).parse(status),
    );
    refresh();
    return r;
  });
}

export async function mergeAction(keepId: unknown, dropId: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const r = await mergeCompanies(await getDb(), user, Id.parse(keepId), Id.parse(dropId), new Date());
    refresh();
    return r;
  });
}

export async function softwareOverrideAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({ companyId: Id, software: z.enum(SOFTWARE).nullable(), note: z.string().max(500).nullish() })
      .parse(raw);
    await setSoftwareOverride(
      await getDb(),
      user,
      input.companyId,
      input.software,
      input.note ?? null,
      new Date(),
    );
    refresh();
    return null;
  });
}

export async function saveViewAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z.object({ name: z.string().trim().min(1).max(40), query: z.string().max(500) }).parse(raw);
    await saveSavedView(await getDb(), user, input.name, input.query);
    refresh();
    return null;
  });
}

export async function deleteViewAction(name: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    await deleteSavedView(await getDb(), user, z.string().min(1).max(40).parse(name));
    refresh();
    return null;
  });
}
