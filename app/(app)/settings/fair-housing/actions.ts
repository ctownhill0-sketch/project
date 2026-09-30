"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { overrideCheck, runCheck, saveRule, saveScript, setRuleActive } from "@/lib/compliance/fair-housing";
import { getDb } from "@/lib/db";

export async function checkTextAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z.object({ text: z.string().max(20_000) }).parse(raw);
    const check = await runCheck(await getDb(), user, {
      entityType: "tester",
      entityId: null,
      text: input.text,
    });
    refresh();
    return check;
  });
}

export async function overrideCheckAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z.object({ checkId: z.uuid(), reason: z.string().max(1000) }).parse(raw);
    const check = await overrideCheck(await getDb(), user, input.checkId, input.reason, new Date());
    refresh();
    return { overrideReason: check.overrideReason };
  });
}

export async function saveRuleAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({
        id: z.uuid().optional(),
        pattern: z.string().max(300),
        category: z.string().max(60),
        severity: z.enum(["warn", "block"]),
        explanation: z.string().max(500),
        saferRewrite: z.string().max(500).nullable(),
      })
      .parse(raw);
    const id = await saveRule(await getDb(), user, input);
    refresh();
    return { id };
  });
}

export async function setRuleActiveAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z.object({ id: z.uuid(), isActive: z.boolean() }).parse(raw);
    await setRuleActive(await getDb(), user, input.id, input.isActive);
    refresh();
    return null;
  });
}

export async function saveScriptAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = z
      .object({ id: z.uuid(), body: z.string().max(5000), overrideReason: z.string().max(1000).optional() })
      .parse(raw);
    const result = await saveScript(await getDb(), user, input, new Date());
    if (result.saved) refresh();
    return result;
  });
}
