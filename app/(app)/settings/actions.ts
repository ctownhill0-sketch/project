"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { getPlacesClient } from "@/lib/finder/runtime";
import { saveSetting } from "@/lib/settings/save";

/** One free Essentials (IDs only) request. The key itself never leaves the server. */
export async function testPlacesKeyAction() {
  await requireUser();
  return toResult(async () => {
    const r = await getPlacesClient().testKey();
    if (r.outcome !== "ok") throw new Error(r.message ?? "Google didn't accept the key.");
    return { message: "Google accepted the key." };
  });
}

const Cap = z.coerce.number().int().min(0).max(100_000);
const CapsInput = z
  .object({ searchDaily: Cap, searchMonthly: Cap, detailsDaily: Cap, detailsMonthly: Cap })
  .refine(
    (c) => c.searchDaily <= c.searchMonthly && c.detailsDaily <= c.detailsMonthly,
    "A daily cap can't be above its monthly cap",
  );

export async function savePlacesCapsAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const c = CapsInput.parse(raw);
    await saveSetting(await getDb(), user, "finder.caps", {
      search: { daily: c.searchDaily, monthly: c.searchMonthly },
      details: { daily: c.detailsDaily, monthly: c.detailsMonthly },
    });
    refresh();
    return null;
  });
}
