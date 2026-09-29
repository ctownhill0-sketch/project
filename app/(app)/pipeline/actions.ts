"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { moveDeal, openDeal, updateDealVacancies } from "@/lib/pipeline/service";

export async function moveDealAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({
        dealId: z.uuid(),
        stageKey: z.string().regex(/^[a-z_]{1,40}$/),
        lostReason: z.string().max(300).nullish(),
      })
      .parse(raw);
    await moveDeal(
      await getDb(),
      user,
      input.dealId,
      input.stageKey,
      { lostReason: input.lostReason },
      new Date(),
    );
    refresh();
    return null;
  });
}

export async function vacanciesAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({ dealId: z.uuid(), vacancies: z.coerce.number().int().min(1).max(500) })
      .parse(raw);
    await updateDealVacancies(await getDb(), user, input.dealId, input.vacancies);
    refresh();
    return null;
  });
}

export async function openDealAction(companyId: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const d = await openDeal(await getDb(), user, z.uuid().parse(companyId), "new", new Date());
    refresh();
    return { dealId: d.id };
  });
}
