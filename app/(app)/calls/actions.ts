"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { logCall, recordObjectionHeard } from "@/lib/calls/service";
import { getDb } from "@/lib/db";

const DISPOSITIONS = [
  "no_answer",
  "left_voicemail",
  "gatekeeper",
  "callback",
  "conversation",
  "audit_booked",
  "not_interested",
  "wrong_number",
  "do_not_call",
] as const;

export async function logCallAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({
        companyId: z.uuid(),
        disposition: z.enum(DISPOSITIONS),
        notes: z.string().max(4000).nullish(),
        nextStepAt: z.coerce.date().nullish(),
        nextStepNote: z.string().max(300).nullish(),
        isDecisionMakerConversation: z.boolean().optional(),
      })
      .parse(raw);
    const row = await logCall(await getDb(), user, input, new Date());
    refresh();
    return { callId: row.id, nextStepAt: row.nextStepAt?.toISOString() ?? null };
  });
}

export async function objectionHeardAction(objectionId: unknown) {
  const user = await requireUser();
  return toResult(async () => recordObjectionHeard(await getDb(), user, z.uuid().parse(objectionId)));
}
