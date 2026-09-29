import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { call, company, contact, enrichmentEvidence, mysteryShop, review } from "@/lib/db/schema";
import { whyThisLead, type Software } from "@/lib/domain/scoring";
import { shopStats } from "@/lib/domain/shop-stats";
import { groupBy, leadFacts } from "@/lib/queries/facts";

export interface LeadFilters {
  status?: string;
  software?: Software;
  q?: string;
}

export interface LeadRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  software: Software;
  units: number | null;
  listings: number | null;
  score: number;
  status: string;
  dnc: boolean;
  why: string;
  /** Replied-only median; Infinity-free. null = no replied shop. */
  shopMedianMinutes: number | null;
  shopNoReply: boolean;
  shopCount: number;
}

const liveFirms = (workspaceId: string) =>
  and(eq(company.workspaceId, workspaceId), isNull(company.mergedIntoId));

export async function listLeads(
  db: Db,
  workspaceId: string,
  filters: LeadFilters,
  now = new Date(),
): Promise<LeadRow[]> {
  const conditions = [liveFirms(workspaceId)];
  if (filters.status)
    conditions.push(eq(company.status, filters.status as typeof company.$inferSelect.status));
  if (filters.q) {
    const q = `%${filters.q}%`;
    conditions.push(or(ilike(company.name, q), ilike(company.city, q), ilike(company.normalizedPhone, q)));
  }
  const firms = await db
    .select()
    .from(company)
    .where(and(...conditions))
    .orderBy(desc(company.score), company.name);
  const shops = groupBy(
    await db
      .select({
        companyId: mysteryShop.companyId,
        sentAt: mysteryShop.sentAt,
        firstReplyAt: mysteryShop.firstReplyAt,
      })
      .from(mysteryShop)
      .where(eq(mysteryShop.workspaceId, workspaceId)),
    (s) => s.companyId,
  );
  return firms
    .map((f) => {
      const own = shops.get(f.id) ?? [];
      const facts = leadFacts(f, own, now);
      return {
        id: f.id,
        name: f.name,
        city: f.city,
        state: f.state,
        phone: f.phone,
        software: facts.software,
        units: f.estUnits,
        listings: f.liveListingsCount,
        score: f.score,
        status: f.status,
        dnc: f.dncFlag,
        why: whyThisLead(facts),
        shopMedianMinutes: facts.shop?.medianReplyMinutes ?? null,
        shopNoReply: facts.shop?.anyNoReply ?? false,
        shopCount: own.length,
      };
    })
    .filter((l) => !filters.software || l.software === filters.software);
}

export async function leadCounts(db: Db, workspaceId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      excluded: sql<number>`count(*) filter (where ${company.status} = 'excluded')::int`,
      ready: sql<number>`count(*) filter (where ${company.status} <> 'excluded' and ${company.score} > 0 and not ${company.dncFlag})::int`,
    })
    .from(company)
    .where(liveFirms(workspaceId));
  // Possible duplicates: firms sharing a normalized domain or phone with another firm.
  const dupes = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from ${company} c
    where c.workspace_id = ${workspaceId} and c.merged_into_id is null and exists (
      select 1 from ${company} d where d.workspace_id = c.workspace_id and d.id <> c.id and d.merged_into_id is null
      and ((c.normalized_domain is not null and d.normalized_domain = c.normalized_domain)
        or (c.normalized_phone is not null and d.normalized_phone = c.normalized_phone)))`);
  return {
    total: row?.total ?? 0,
    excluded: row?.excluded ?? 0,
    ready: row?.ready ?? 0,
    possibleDuplicates: dupes.rows[0]?.n ?? 0,
  };
}

export async function getLeadDetail(db: Db, workspaceId: string, id: string, now = new Date()) {
  const [firm] = await db
    .select()
    .from(company)
    .where(and(eq(company.id, id), eq(company.workspaceId, workspaceId)));
  if (!firm) return null;
  const [people, shops, calls, evidence, reviews] = await Promise.all([
    db
      .select()
      .from(contact)
      .where(and(eq(contact.companyId, id), eq(contact.workspaceId, workspaceId))),
    db
      .select()
      .from(mysteryShop)
      .where(and(eq(mysteryShop.companyId, id), eq(mysteryShop.workspaceId, workspaceId)))
      .orderBy(desc(mysteryShop.sentAt)),
    db
      .select()
      .from(call)
      .where(and(eq(call.companyId, id), eq(call.workspaceId, workspaceId)))
      .orderBy(desc(call.calledAt))
      .limit(5),
    db
      .select()
      .from(enrichmentEvidence)
      .where(and(eq(enrichmentEvidence.companyId, id), eq(enrichmentEvidence.workspaceId, workspaceId)))
      .orderBy(asc(enrichmentEvidence.createdAt)),
    db
      .select()
      .from(review)
      .where(and(eq(review.companyId, id), eq(review.workspaceId, workspaceId)))
      .orderBy(desc(review.publishedAt)),
  ]);
  const facts = leadFacts(firm, shops, now);
  return {
    ...firm,
    software: facts.software,
    why: whyThisLead(facts),
    breakdown: firm.scoreBreakdown,
    contacts: people,
    shops,
    shopStats: shopStats(shops, now),
    calls,
    /** What the Lead Finder learned from the firm's own website, newest per kind, with sources. */
    finderEvidence: [
      ...new Map(
        evidence.map((e) => [e.kind === "service_type" ? `${e.kind}:${e.value}` : e.kind, e]),
      ).values(),
    ],
    reviews,
  };
}

/** ⌘K lead search: name, town or phone digits. */
export async function searchLeads(db: Db, workspaceId: string, query: string, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q}%`;
  return db
    .select({ id: company.id, name: company.name, city: company.city, score: company.score })
    .from(company)
    .where(
      and(
        liveFirms(workspaceId),
        or(ilike(company.name, like), ilike(company.city, like), ilike(company.normalizedPhone, like)),
      ),
    )
    .orderBy(desc(company.score))
    .limit(limit);
}
