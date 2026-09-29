// Mystery-shop tracker (brief M4): 60-second logging, "Replied now", and the ethics rules
// (real name, one shop per firm per 30 days, never a do-not-call firm).
import { and, desc, eq } from "drizzle-orm";
import { withAudit, type AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { appUser, company, mysteryShop } from "@/lib/db/schema";
import { DEFAULT_BUSINESS_HOURS, hoursBucket, type BusinessHours } from "@/lib/domain/hours";
import { DEFAULT_WEIGHTS, type ScoringWeights } from "@/lib/domain/scoring";
import { nextAllowedShopAt, replyTimeProblem } from "@/lib/domain/shops";
import { rescoreCompany } from "@/lib/finder/service";
import { getSetting } from "@/lib/queries/settings";

export type ShopChannel = (typeof mysteryShop.$inferInsert)["channel"];
export type ReplyType = "human" | "auto" | "ai";

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(
    d,
  );

async function weights(db: Db, workspaceId: string): Promise<ScoringWeights> {
  return {
    ...DEFAULT_WEIGHTS,
    ...(await getSetting<Partial<ScoringWeights>>(db, workspaceId, "scoringWeights", {})),
  };
}

/** The founder's real name, from Settings, else their user name (ethics: never a made-up persona). */
export async function shopperName(db: Db, ctx: AuditContext): Promise<string> {
  const saved = await getSetting<string | null>(db, ctx.workspaceId, "shopperName", null);
  if (saved?.trim()) return saved.trim();
  const [user] = await db.select({ name: appUser.name }).from(appUser).where(eq(appUser.id, ctx.userId));
  return user?.name ?? "Founder";
}

export interface LogShopInput {
  companyId: string;
  channel: ShopChannel;
  sentAt: Date;
  listingRef?: string | null | undefined;
  notes?: string | null | undefined;
}

export async function logShop(db: Db, ctx: AuditContext, input: LogShopInput, now: Date) {
  if (input.sentAt.getTime() > now.getTime() + 60_000) throw new Error("The sent time is in the future.");
  const [firm] = await db
    .select()
    .from(company)
    .where(and(eq(company.id, input.companyId), eq(company.workspaceId, ctx.workspaceId)));
  if (!firm || firm.mergedIntoId) throw new Error("Lead not found.");
  if (firm.dncFlag) throw new Error("This firm is marked do not call, so it isn't shopped either.");
  const [last] = await db
    .select({ sentAt: mysteryShop.sentAt })
    .from(mysteryShop)
    .where(eq(mysteryShop.companyId, firm.id))
    .orderBy(desc(mysteryShop.sentAt))
    .limit(1);
  const allowed = nextAllowedShopAt(last?.sentAt ?? null);
  if (allowed && input.sentAt.getTime() < allowed.getTime()) {
    throw new Error(
      `${firm.name} was shopped on ${fmt(last!.sentAt)}. One shop per firm per 30 days: next one from ${fmt(allowed)}.`,
    );
  }
  const hours = await getSetting<BusinessHours>(db, ctx.workspaceId, "businessHours", DEFAULT_BUSINESS_HOURS);
  const name = await shopperName(db, ctx);
  const w = await weights(db, ctx.workspaceId);
  return withAudit(db, ctx, { action: "create", entity: "mystery_shop" }, async (tx) => {
    const [shop] = await tx
      .insert(mysteryShop)
      .values({
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        companyId: firm.id,
        channel: input.channel,
        sentAt: input.sentAt,
        hoursBucket: hoursBucket(input.sentAt, hours),
        listingRef: input.listingRef?.trim() || null,
        notes: input.notes?.trim() || null,
        shopperName: name,
      })
      .returning();
    await rescoreCompany(tx, ctx, firm.id, w, "Mystery shop logged", now);
    return { result: shop!, entityId: shop!.id, after: shop };
  });
}

export interface ReplyInput {
  repliedAt: Date;
  replyType: ReplyType;
  questionsAnswered?: number | undefined;
  tourOffered?: boolean | undefined;
  followUpsIn7d?: number | undefined;
}

export async function recordReply(db: Db, ctx: AuditContext, shopId: string, input: ReplyInput, now: Date) {
  const [shop] = await db
    .select()
    .from(mysteryShop)
    .where(and(eq(mysteryShop.id, shopId), eq(mysteryShop.workspaceId, ctx.workspaceId)));
  if (!shop) throw new Error("Shop not found.");
  const problem = replyTimeProblem(shop.sentAt, input.repliedAt, now);
  if (problem) throw new Error(problem);
  const w = await weights(db, ctx.workspaceId);
  return withAudit(db, ctx, { action: "update", entity: "mystery_shop" }, async (tx) => {
    const patch = {
      firstReplyAt: input.repliedAt,
      replyType: input.replyType,
      firstHumanReplyAt: input.replyType === "human" ? input.repliedAt : shop.firstHumanReplyAt,
      ...(input.questionsAnswered !== undefined ? { questionsAnswered: input.questionsAnswered } : {}),
      ...(input.tourOffered !== undefined ? { tourOffered: input.tourOffered } : {}),
      ...(input.followUpsIn7d !== undefined ? { followUpsIn7d: input.followUpsIn7d } : {}),
    };
    await tx.update(mysteryShop).set(patch).where(eq(mysteryShop.id, shop.id));
    await rescoreCompany(tx, ctx, shop.companyId, w, "Shop reply recorded", now);
    return { result: null, entityId: shop.id, before: { firstReplyAt: shop.firstReplyAt }, after: patch };
  });
}
