"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { nyDateKey } from "@/lib/domain/ny-time";
import { closePilot, MetricRow, saveDayMetrics, startPilot } from "@/lib/pilots/service";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use a date");

export async function startPilotAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({
        companyId: z.uuid(),
        day0: Day,
        vacancies: z
          .array(
            z.object({
              label: z.string().max(80),
              baselineDaysOnMarket: z.number().int().min(0).max(1000).nullable(),
            }),
          )
          .max(10),
      })
      .parse(raw);
    const id = await startPilot(await getDb(), user, input);
    refresh();
    return { id };
  });
}

export async function saveDayAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({ pilotId: z.uuid(), day: Day, rows: z.array(MetricRow).min(1).max(20) })
      .parse(raw);
    await saveDayMetrics(await getDb(), user, input, nyDateKey(new Date()));
    refresh();
    return null;
  });
}

export async function closePilotAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const { pilotId } = z.object({ pilotId: z.uuid() }).parse(raw);
    const outcome = await closePilot(await getDb(), user, pilotId, nyDateKey(new Date()));
    refresh();
    return { outcome };
  });
}
