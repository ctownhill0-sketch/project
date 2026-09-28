import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { DEFAULT_BUSINESS_HOURS, hoursBucket } from "@/lib/domain/hours";
import { expectedMrr, PRICING } from "@/lib/domain/pipeline";
import {
  createRng,
  fictionalDomain,
  fictionalFirmName,
  fictionalPhone,
  intBetween,
  pick,
  type Rng,
} from "./fictional";

/**
 * Demo data for the Free Build. Every firm, person, domain and phone number is
 * fictional (.example domains, 555-01xx numbers). Deterministic for a given `now`.
 */

export const SEED_OWNER_EMAIL = "ctownhill0@gmail.com";
const DAY = 86_400_000;

type Own = { workspaceId: string; createdById: string };

const NYC_METRO_TOWNS = [
  ["Brooklyn", "NY"],
  ["Queens", "NY"],
  ["Bronx", "NY"],
  ["Staten Island", "NY"],
  ["Manhattan", "NY"],
  ["Yonkers", "NY"],
  ["White Plains", "NY"],
  ["New Rochelle", "NY"],
  ["Mount Vernon", "NY"],
  ["Hempstead", "NY"],
  ["Huntington", "NY"],
  ["Freeport", "NY"],
  ["Jersey City", "NJ"],
  ["Hoboken", "NJ"],
  ["Newark", "NJ"],
  ["Paterson", "NJ"],
  ["Elizabeth", "NJ"],
  ["Hackensack", "NJ"],
  ["Bayonne", "NJ"],
  ["Union City", "NJ"],
] as const;
const OTHER_TOWNS = [
  ["Hartford", "CT"],
  ["Providence", "RI"],
  ["Worcester", "MA"],
  ["Albany", "NY"],
  ["Allentown", "PA"],
] as const;

const FIRST_NAMES = [
  "Jordan",
  "Avery",
  "Morgan",
  "Riley",
  "Casey",
  "Taylor",
  "Quinn",
  "Reese",
  "Skyler",
  "Rowan",
];
const LAST_NAMES = ["Example", "Sample", "Placeholder", "Demo", "Fictus", "Testwell", "Mockford", "Dummer"];

export const PIPELINE_STAGES = [
  { key: "new", name: "New", probability: 5 },
  { key: "shopped", name: "Shopped", probability: 10 },
  { key: "called", name: "Called", probability: 15 },
  { key: "conversation", name: "Conversation", probability: 25 },
  { key: "audit_sent", name: "Audit sent", probability: 35 },
  { key: "audit_review_booked", name: "Audit review booked", probability: 45 },
  { key: "pilot_proposed", name: "Pilot proposed", probability: 60 },
  { key: "pilot_live", name: "Pilot live", probability: 75 },
  { key: "paid_monthly", name: "Paid monthly", probability: 100, isWon: true },
  { key: "lost", name: "Lost", probability: 0, isLost: true },
] as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  metros: ["New York metro"],
  businessHours: DEFAULT_BUSINESS_HOURS,
  killTest: {
    day0: "2026-09-29",
    deadline: "2026-12-28",
    pilotsTarget: 3,
    conversationsTarget: 60,
    afterHoursMedianMinutes: 10,
  },
  scoringWeights: {
    notAppfolio: 30,
    noSoftware: 20,
    listings3to25: 20,
    slowReply: 25,
    units50to500: 15,
    local: 10,
  },
  guarantee: { tourTarget: 5, medianReplySeconds: 60, atRiskFromDay: 7, pilotDays: 14 },
  pricing: PRICING,
  growth: { weeklyTarget: 0.07, startsAfterClients: 3 },
  ycReadiness: { mrrLow: 8000, mrrHigh: 15000, clients: 10 },
  callBlocks: { days: [2, 3, 4], start: "09:00", end: "11:30" },
  brand: { wordmark: "Vacancy Desk" },
};

const SOFTWARE_PATTERNS: {
  software: (typeof s.softwareKind.enumValues)[number];
  pattern: string;
  kind: "domain" | "substring";
}[] = [
  { software: "appfolio", pattern: "appfolio.com", kind: "domain" },
  { software: "buildium", pattern: "managebuilding.com", kind: "domain" },
  { software: "doorloop", pattern: "doorloop.com", kind: "domain" },
  { software: "rent_manager", pattern: "rentmanager", kind: "substring" },
  { software: "rent_manager", pattern: "rmresident", kind: "substring" },
  { software: "yardi", pattern: "rentcafe", kind: "substring" },
  { software: "yardi", pattern: "yardibreeze", kind: "substring" },
];

/** Layer-1 fair-housing patterns (M14). Editable in Settings. Screening aid, not legal advice. */
export const FAIR_HOUSING_RULES = [
  {
    pattern: String.raw`\b(no|without) (kids|children)\b`,
    category: "familial_status",
    severity: "block",
    explanation: "Excludes families with children.",
    saferRewrite: "Describe the unit, not who should live in it.",
  },
  {
    pattern: String.raw`\badults?[- ]only\b`,
    category: "familial_status",
    severity: "block",
    explanation: "Excludes families with children.",
    saferRewrite: "Describe the unit, not who should live in it.",
  },
  {
    pattern: String.raw`\bperfect for (singles|a single person|couples)\b`,
    category: "familial_status",
    severity: "warn",
    explanation: "Signals a preferred household type.",
    saferRewrite: "Great for anyone who wants a quiet one-bedroom.",
  },
  {
    pattern: String.raw`\bideal for (young )?professionals\b|\byoung professionals\b`,
    category: "age",
    severity: "warn",
    explanation: "Signals an age or familial preference.",
    saferRewrite: "Close to transit and downtown offices.",
  },
  {
    pattern: String.raw`\bno section[- ]?8\b|\bsection[- ]?8 not accepted\b`,
    category: "source_of_income",
    severity: "block",
    explanation: "Source of income is protected in NY State, NYC and NJ.",
    saferRewrite: "All lawful sources of income are considered.",
  },
  {
    pattern: String.raw`\b(no|not accepting) (vouchers|housing vouchers|programs|assistance)\b`,
    category: "source_of_income",
    severity: "block",
    explanation: "Source of income is protected in NY State, NYC and NJ.",
    saferRewrite: "All lawful sources of income are considered.",
  },
  {
    pattern: String.raw`\bmust (have|show) (a )?(job|employment|paycheck)\b|\bemployed only\b`,
    category: "source_of_income",
    severity: "warn",
    explanation: "Can exclude people with lawful non-wage income.",
    saferRewrite: "Applicants must show the ability to pay rent from any lawful source.",
  },
  {
    pattern: String.raw`\benglish[- ]only\b|\bmust speak english\b`,
    category: "national_origin",
    severity: "block",
    explanation: "National origin is a protected class.",
    saferRewrite: "Remove the language requirement.",
  },
  {
    pattern: String.raw`\bable[- ]bodied\b|\bno wheelchairs?\b`,
    category: "disability",
    severity: "block",
    explanation: "Disability is a protected class.",
    saferRewrite: "Describe access features, e.g. 'third-floor walk-up'.",
  },
  {
    pattern: String.raw`\bno (pets|animals)\b(?!.*assistance animals)`,
    category: "disability",
    severity: "warn",
    explanation: "Assistance animals are not pets and must be considered.",
    saferRewrite: "No pets; assistance animals are welcome.",
  },
  {
    pattern: String.raw`\b(christian|muslim|jewish|catholic) (home|household|tenants?)\b`,
    category: "religion",
    severity: "block",
    explanation: "Religion is a protected class.",
    saferRewrite: "Describe the unit, not who should live in it.",
  },
  {
    pattern: String.raw`\bmature (tenants?|persons?|adults?)\b`,
    category: "age",
    severity: "warn",
    explanation: "Signals an age preference.",
    saferRewrite: "Quiet building.",
  },
] as const;

const SCRIPTS = [
  {
    kind: "gatekeeper",
    name: "Gatekeeper",
    body: "Hi, this is {{founderName}}. Who handles leasing inquiries for {{firmName}}? I have a quick note about how fast your listings get answered.",
  },
  {
    kind: "opener_with_result",
    name: "Opener (with test result)",
    body: "Hi {{contactName}}, {{founderName}} here. I sent an inquiry on one of your listings on {{shopDate}} and the first reply took {{replyTime}}. Renters usually pick whoever answers first. Do you have two minutes?",
  },
  {
    kind: "opener_without_result",
    name: "Opener (no test yet)",
    body: "Hi {{contactName}}, {{founderName}} here. I help property managers answer every rental inquiry in under a minute, day or night. How are you handling after-hours inquiries at {{firmName}} today?",
  },
  {
    kind: "voicemail",
    name: "Voicemail",
    body: "Hi {{contactName}}, {{founderName}}. I tested how fast {{firmName}} replies to rental inquiries and have the result for you. I'll try again tomorrow.",
  },
  {
    kind: "follow_up",
    name: "Follow-up",
    body: "Following up on the reply-time test for {{firmName}}. Happy to walk you through it in ten minutes.",
  },
  {
    kind: "pilot_close",
    name: "Pilot close",
    body: "Let's run a 14-day pilot on two vacancies. If we don't hit a median reply under 60 seconds and about {{tourTarget}} tours per vacancy, that vacancy's month is free.",
  },
] as const;

const OBJECTIONS = [
  {
    title: "We already reply fast",
    response:
      "Great. The test showed {{replyTime}}; if that's typical, the pilot will confirm it at no risk.",
    category: "status_quo",
  },
  {
    title: "We use AppFolio",
    response: "Understood. We focus on firms not on AppFolio, so we're probably not a fit right now.",
    category: "fit",
  },
  {
    title: "Too expensive",
    response: "One extra lease-up week on an $1,800 unit costs about $415. The guarantee covers the risk.",
    category: "price",
  },
  {
    title: "Send me an email",
    response: "Happy to. What's the one number you'd want to see in it?",
    category: "brush_off",
  },
  {
    title: "We don't trust AI with renters",
    response:
      "Everything Avery says comes from your written policies, and your team sees every conversation.",
    category: "trust",
  },
] as const;

function nyDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(instant);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

function uniqueNames(rng: Rng, n: number): string[] {
  const names = new Set<string>();
  while (names.size < n) names.add(fictionalFirmName(rng));
  return [...names];
}

export interface SeedResult {
  skipped: boolean;
  summary: string;
}

export async function seed(db: Db, { now = new Date(), seedValue = 20260929 } = {}): Promise<SeedResult> {
  const existing = await db.select().from(s.appUser).where(eq(s.appUser.email, SEED_OWNER_EMAIL));
  if (existing.length > 0)
    return { skipped: true, summary: "Already seeded. Run pnpm db:reset to start over." };

  const rng = createRng(seedValue);
  const today = nyDate(now);

  return db.transaction(async (tx) => {
    const [ws] = await tx.insert(s.workspace).values({ name: "Vacancy Desk" }).returning();
    const [owner] = await tx
      .insert(s.appUser)
      .values({ email: SEED_OWNER_EMAIL, name: "Founder" })
      .returning();
    if (!ws || !owner) throw new Error("Could not create the workspace owner.");
    const own: Own = { workspaceId: ws.id, createdById: owner.id };
    await tx.insert(s.membership).values({ ...own, userId: owner.id, role: "owner" });

    // Settings, patterns, rules, scripts, objections, stages.
    await tx
      .insert(s.setting)
      .values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ ...own, key, value })));
    await tx.insert(s.softwarePattern).values(SOFTWARE_PATTERNS.map((p) => ({ ...own, ...p })));
    await tx.insert(s.fairHousingRule).values(FAIR_HOUSING_RULES.map((r) => ({ ...own, ...r })));
    await tx.insert(s.script).values(SCRIPTS.map((x) => ({ ...own, ...x })));
    await tx.insert(s.objection).values(OBJECTIONS.map((x) => ({ ...own, ...x })));
    const stages = await tx
      .insert(s.pipelineStage)
      .values(PIPELINE_STAGES.map((st, i) => ({ ...own, ...st, position: i + 1 })))
      .returning();
    const stageByKey = new Map(stages.map((st) => [st.key, st]));

    // 45 unique firms: 40 in the NYC metro, 5 elsewhere; the first 5 are on AppFolio.
    const names = uniqueNames(rng, 45);
    const software = ["buildium", "doorloop", "rent_manager", "yardi", "none", "none", "unknown"] as const;
    const firmRows = names.map((name, i) => {
      const [city, state] = i < 40 ? pick(rng, NYC_METRO_TOWNS) : (OTHER_TOWNS[i - 40] ?? OTHER_TOWNS[0]);
      const domain = fictionalDomain(name);
      const phone = fictionalPhone(rng);
      return {
        ...own,
        name,
        normalizedName: name.toLowerCase(),
        domain,
        normalizedDomain: domain,
        websiteUrl: `https://${domain}`,
        phone,
        normalizedPhone: phone,
        city,
        state,
        metro: i < 40 ? "New York metro" : `${city} area`,
        isLocal: i < 40,
        estUnits: intBetween(rng, 30, 650),
        estUnitsSource: "csv" as const,
        liveListingsCount: intBetween(rng, 0, 40),
        liveListingsSource: "csv" as const,
        detectedSoftware: i < 5 ? ("appfolio" as const) : pick(rng, software),
        status: i < 5 ? ("excluded" as const) : ("new" as const),
      };
    });
    const firms = await tx.insert(s.company).values(firmRows).returning();

    // 5 duplicates: 3 share a domain, 2 have near-identical names in the same city.
    const dupSources = firms.slice(10, 15);
    const duplicates = await tx
      .insert(s.company)
      .values(
        dupSources.map((f, i) => ({
          ...own,
          name: i < 3 ? `${f.name} LLC` : f.name.replace(/ (\w+)$/, " $1 Inc"),
          normalizedName: (i < 3 ? `${f.name} LLC` : f.name.replace(/ (\w+)$/, " $1 Inc")).toLowerCase(),
          domain: i < 3 ? f.domain : null,
          normalizedDomain: i < 3 ? f.normalizedDomain : null,
          phone: f.phone,
          normalizedPhone: f.normalizedPhone,
          city: f.city,
          state: f.state,
          metro: f.metro,
          isLocal: f.isLocal,
          detectedSoftware: "unknown" as const,
        })),
      )
      .returning();

    // One fictional contact per unique firm.
    await tx.insert(s.contact).values(
      firms.map((f, i) => {
        const first = pick(rng, FIRST_NAMES);
        return {
          ...own,
          companyId: f.id,
          name: `${first} ${pick(rng, LAST_NAMES)}`,
          roleTitle: i % 3 === 0 ? "Owner" : "Leasing manager",
          email: `${first.toLowerCase()}@${f.domain}`,
          phone: f.phone,
          isDecisionMaker: i % 3 === 0,
        };
      }),
    );

    // 40 mystery shops, one per non-AppFolio unique firm (so never twice in 30 days).
    const shopFirms = firms.slice(5);
    const replyMinutes = [3, 14, 38, 95, 160, 240, 420, 900, 1600, 55, 7, 130];
    const shops = shopFirms.map((f, i) => {
      // Two shops straddle the 8 Mar 2026 DST change; the rest spread over 12 weeks.
      const sentAt =
        i === 0
          ? new Date("2026-03-06T14:30:00Z") // Fri 09:30 EST
          : i === 1
            ? new Date("2026-03-09T13:30:00Z") // Mon 09:30 EDT
            : new Date(now.getTime() - (i * 2 + 1) * DAY - (i % 2 === 0 ? 2 * 3_600_000 : -9 * 3_600_000));
      const noReply = i % 5 === 4;
      const minutes = replyMinutes[i % replyMinutes.length] ?? 60;
      const firstReplyAt = noReply ? null : new Date(sentAt.getTime() + minutes * 60_000);
      const replyType = noReply ? ("none" as const) : minutes < 5 ? ("auto" as const) : ("human" as const);
      return {
        ...own,
        companyId: f.id,
        channel: pick(rng, ["email", "listing_site", "website_form"] as const),
        sentAt,
        hoursBucket: hoursBucket(sentAt, DEFAULT_BUSINESS_HOURS),
        firstReplyAt,
        firstHumanReplyAt: replyType === "human" ? firstReplyAt : null,
        replyType,
        questionsAnswered: noReply ? 0 : intBetween(rng, 1, 4),
        followUpsIn7d: noReply ? 0 : intBetween(rng, 0, 2),
        tourOffered: !noReply && rng() > 0.5,
        shopperName: "Demo Shopper",
      };
    });
    await tx.insert(s.mysteryShop).values(shops);

    // 25 calls over the last three weeks.
    const dispositions = s.callDisposition.enumValues.filter((d) => d !== "do_not_call");
    await tx.insert(s.call).values(
      shopFirms.slice(0, 25).map((f, i) => {
        const disposition = dispositions[i % dispositions.length] ?? "no_answer";
        return {
          ...own,
          companyId: f.id,
          calledAt: new Date(now.getTime() - (i % 15) * DAY - 3 * 3_600_000),
          disposition,
          isDecisionMakerConversation: disposition === "conversation" || disposition === "audit_booked",
          nextStepAt: disposition === "callback" ? new Date(now.getTime() + 2 * DAY) : null,
          nextStepNote: disposition === "callback" ? "Call back after the owner's site visit" : null,
        };
      }),
    );

    // 12 deals across the pipeline; at most one open deal per firm.
    const dealPlan = [
      "new",
      "shopped",
      "called",
      "conversation",
      "conversation",
      "audit_sent",
      "audit_review_booked",
      "pilot_proposed",
      "pilot_live",
      "pilot_live",
      "paid_monthly",
      "lost",
    ] as const;
    const dealRows = dealPlan.map((key, i) => {
      const stage = stageByKey.get(key);
      if (!stage) throw new Error(`missing stage ${key}`);
      const vacancies = key === "paid_monthly" ? 3 : 2;
      const closed = key === "paid_monthly" || key === "lost";
      return {
        ...own,
        companyId: shopFirms[i]?.id ?? "",
        stageId: stage.id,
        vacancies,
        probability: stage.probability,
        expectedMrr: expectedMrr({ vacancies, probability: stage.probability }).toFixed(2),
        closedAt: closed ? new Date(now.getTime() - 10 * DAY) : null,
        lostReason: key === "lost" ? "Signed a two-year contract with another vendor" : null,
      };
    });
    const deals = await tx.insert(s.deal).values(dealRows).returning();
    await tx.insert(s.stageEvent).values(
      deals.map((d) => ({
        ...own,
        dealId: d.id,
        toStageId: d.stageId,
        movedAt: new Date(now.getTime() - 12 * DAY),
      })),
    );

    // Clients: two live pilots (day 7 today) and one paying client.
    const pilotDay0 = addDays(today, -7);
    const liveDeals = deals.filter((_, i) => dealPlan[i] === "pilot_live");
    const paidDeal = deals[dealPlan.indexOf("paid_monthly")];
    for (const [index, d] of liveDeals.entries()) {
      const onTrack = index === 0;
      const [client] = await tx
        .insert(s.client)
        .values({ ...own, companyId: d.companyId, status: "pilot", startedOn: pilotDay0 })
        .returning();
      if (!client) throw new Error("client insert failed");
      const [pilot] = await tx
        .insert(s.pilot)
        .values({ ...own, clientId: client.id, day0: pilotDay0, tourTarget: 5 })
        .returning();
      if (!pilot) throw new Error("pilot insert failed");
      const vacancies = await tx
        .insert(s.vacancy)
        .values(
          [1, 2].map((n) => ({
            ...own,
            clientId: client.id,
            label: `Unit ${n}A`,
            listedOn: addDays(pilotDay0, -3),
            baselineDaysOnMarket: 34,
          })),
        )
        .returning();
      const metrics = vacancies.flatMap((v) =>
        Array.from({ length: 7 }, (_, day) => ({
          ...own,
          pilotId: pilot.id,
          vacancyId: v.id,
          day: addDays(pilotDay0, day),
          inquiries: intBetween(rng, 2, 6),
          medianReplySeconds: onTrack ? intBetween(rng, 25, 50) : intBetween(rng, 70, 95),
          p90ReplySeconds: onTrack ? intBetween(rng, 55, 90) : intBetween(rng, 120, 240),
          // On track: 3 tours per vacancy by day 7 (projects to 6 ≥ 5). At risk: 1 (projects to 2).
          tours: onTrack ? (day === 2 || day === 4 || day === 6 ? 1 : 0) : day === 5 ? 1 : 0,
          applications: onTrack && day === 6 ? 1 : 0,
          escalations: day === 3 ? 1 : 0,
          humanMinutes: intBetween(rng, 5, 20),
        })),
      );
      await tx.insert(s.pilotMetric).values(metrics);
    }
    if (paidDeal) {
      await tx
        .insert(s.client)
        .values({ ...own, companyId: paidDeal.companyId, status: "active", startedOn: addDays(today, -20) });
    }

    // 12 weeks of founder-entered metrics (MRR starts when the first client pays).
    const thisMonday = mondayOf(today);
    await tx.insert(s.weeklyMetric).values(
      Array.from({ length: 12 }, (_, k) => {
        const weekStart = addDays(thisMonday, -7 * (11 - k));
        const paying = k >= 9;
        return {
          ...own,
          weekStart,
          mrr: paying ? "400.00" : "0.00",
          cash: (1200 - k * 35 + (paying ? 400 : 0)).toFixed(2),
          netBurn: "35.00",
          paidClients: paying ? 1 : 0,
          insuranceStudyHours: (2 + (k % 4)).toFixed(1),
        };
      }),
    );

    await tx.insert(s.auditLog).values({
      ...own,
      action: "create",
      entity: "seed",
      diff: { companies: firms.length + duplicates.length, shops: shops.length },
    });

    return {
      skipped: false,
      summary: `Seeded ${firms.length + duplicates.length} companies, ${shops.length} shops, 25 calls, ${deals.length} deals, ${liveDeals.length} pilots, 12 weeks.`,
    };
  });
}
