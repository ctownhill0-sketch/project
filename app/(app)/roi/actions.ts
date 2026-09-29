"use server";

import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { saveRoiScenario } from "@/lib/roi/service";

/** Saves a scenario against a firm so call prep can quote it. */
export async function saveRoiAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z.object({ companyId: z.uuid(), query: z.string().max(500) }).parse(raw);
    return saveRoiScenario(await getDb(), user, input.companyId, input.query);
  });
}
