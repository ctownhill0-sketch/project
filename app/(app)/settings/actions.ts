"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { getPlacesClient } from "@/lib/finder/runtime";
import { deleteDemoData } from "@/lib/settings/demo";
import { saveSetting } from "@/lib/settings/save";
import {
  addExclusionRule,
  addSoftwarePattern,
  saveBusinessHours,
  saveScoringWeights,
  saveWeek,
  setExclusionRuleActive,
  setSoftwarePatternActive,
} from "@/lib/settings/service";

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

// ---------------------------------------------------------------------------------------------
// Scoring, hours, thresholds, brand, weekly numbers, rule lists, demo data

const Weight = z.coerce.number().int().min(-100).max(100);

export async function saveWeightsAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const w = z
      .object({
        notAppfolio: Weight,
        noSoftware: Weight,
        listings3to25: Weight,
        slowReply: Weight,
        units50to500: Weight,
        local: Weight,
        reviewSignals: Weight,
        chainOrNotFit: Weight,
      })
      .parse(raw);
    const r = await saveScoringWeights(await getDb(), user, w, new Date());
    refresh();
    return r;
  });
}

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");

export async function saveHoursAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const h = z
      .object({
        days: z.array(z.number().int().min(1).max(7)).max(7),
        start: Time,
        end: Time,
        saturdayBucket: z.boolean(),
        holidaysAreAfterHours: z.boolean(),
      })
      .parse(raw);
    const r = await saveBusinessHours(await getDb(), user, { ...h, timeZone: "America/New_York" });
    refresh();
    return r;
  });
}

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use a date");
const Count = z.coerce.number().int().min(0).max(100_000);

export async function saveThresholdsAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const t = z
      .object({
        killTest: z
          .object({
            day0: Day,
            deadline: Day,
            pilotsTarget: Count,
            conversationsTarget: Count,
            afterHoursMedianMinutes: Count,
          })
          .refine((k) => k.deadline > k.day0, "The deadline must be after day 0"),
        guarantee: z.object({
          tourTarget: z.coerce.number().int().min(1).max(100),
          medianReplySeconds: z.coerce.number().int().min(1).max(3600),
          atRiskFromDay: z.coerce.number().int().min(1).max(30),
          pilotDays: z.coerce.number().int().min(2).max(60),
        }),
        callBlocks: z.object({
          days: z.array(z.number().int().min(1).max(7)).max(7),
          start: Time,
          end: Time,
        }),
      })
      .parse(raw);
    if (t.guarantee.atRiskFromDay >= t.guarantee.pilotDays)
      throw new Error("At risk must start before the pilot ends.");
    const db = await getDb();
    await saveSetting(db, user, "killTest", t.killTest);
    await saveSetting(db, user, "guarantee", t.guarantee);
    await saveSetting(db, user, "callBlocks", t.callBlocks);
    refresh();
    return null;
  });
}

export async function saveBrandAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const b = z
      .object({
        wordmark: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .refine((v) => !/keyhour/i.test(v), "That name isn't allowed"),
        shopperName: z.string().trim().max(80),
      })
      .parse(raw);
    const db = await getDb();
    await saveSetting(db, user, "brand", { wordmark: b.wordmark });
    await saveSetting(db, user, "shopperName", b.shopperName || null);
    refresh();
    return null;
  });
}

const Money = z.coerce.number().min(-10_000_000).max(10_000_000);

export async function saveWeekAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const w = z
      .object({
        weekStart: Day,
        mrr: z.coerce.number().min(0).max(10_000_000),
        cash: Money.nullable(),
        netBurn: Money.nullable(),
        paidClients: Count,
        insuranceStudyHours: z.coerce.number().min(0).max(168),
        notes: z.string().max(500).nullable(),
      })
      .parse(raw);
    await saveWeek(await getDb(), user, w);
    refresh();
    return null;
  });
}

export async function addSoftwarePatternAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const p = z
      .object({
        software: z.enum([
          "appfolio",
          "buildium",
          "doorloop",
          "rent_manager",
          "yardi",
          "propertyware",
          "rentvine",
          "tenantcloud",
          "other",
        ]),
        pattern: z.string().max(200),
        kind: z.enum(["domain", "substring"]),
      })
      .parse(raw);
    await addSoftwarePattern(await getDb(), user, p);
    refresh();
    return null;
  });
}

export async function addExclusionAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const e = z
      .object({
        kind: z.enum(["chain", "not_a_fit"]),
        match: z.enum(["name", "domain", "type"]),
        pattern: z.string().max(200),
        category: z.string().max(60).nullable(),
      })
      .parse(raw);
    await addExclusionRule(await getDb(), user, e);
    refresh();
    return null;
  });
}

export async function setListItemActiveAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const x = z
      .object({ list: z.enum(["software", "exclusion"]), id: z.uuid(), isActive: z.boolean() })
      .parse(raw);
    const db = await getDb();
    if (x.list === "software") await setSoftwarePatternActive(db, user, x.id, x.isActive);
    else await setExclusionRuleActive(db, user, x.id, x.isActive);
    refresh();
    return null;
  });
}

export async function deleteDemoDataAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    z.object({ confirm: z.literal("DELETE DEMO DATA") }).parse(raw);
    const r = await deleteDemoData(await getDb(), user);
    refresh();
    return r;
  });
}
