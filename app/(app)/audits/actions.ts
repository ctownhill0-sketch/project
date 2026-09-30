"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { createAudit, prepareExport, saveSummary } from "@/lib/audits/service";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";

export async function createAuditAction(formData: FormData) {
  const user = await requireUser();
  const { companyId } = z.object({ companyId: z.uuid() }).parse({ companyId: formData.get("companyId") });
  const id = await createAudit(await getDb(), user, companyId, new Date());
  redirect(`/audits/${id}`);
}

/** Saves the summary, then runs the number and fair-housing checks on the whole page. */
export async function checkAuditAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z.object({ id: z.uuid(), summary: z.string().max(2000) }).parse(raw);
    const db = await getDb();
    await saveSummary(db, user, input.id, input.summary);
    const result = await prepareExport(db, user, input.id);
    refresh();
    return result;
  });
}
