import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { auditLog, fairHousingCheck, fairHousingRule, script } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertOwner } from "@/lib/db/test-fixtures";
import {
  activeRules,
  checkForText,
  isCleared,
  overrideCheck,
  runCheck,
  saveRule,
  saveScript,
  setRuleActive,
} from "@/lib/compliance/fair-housing";
import { FAIR_HOUSING_RULES } from "@/lib/seed/rules";

const NOW = new Date("2026-09-29T15:00:00Z");
let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function setup() {
  const o = await insertOwner(handle.db);
  await handle.db.insert(fairHousingRule).values(FAIR_HOUSING_RULES.map((r) => ({ ...o.own, ...r })));
  return { ctx: { userId: o.userId, workspaceId: o.workspaceId }, own: o.own };
}

describe("runCheck", () => {
  it("logs the outcome and a hash of the text, never the text, audited", async () => {
    const { ctx } = await setup();
    const check = await runCheck(handle.db, ctx, {
      entityType: "tester",
      entityId: null,
      text: "No kids please",
    });
    expect(check.outcome).toBe("block");
    expect(check.matches[0]).toMatchObject({ category: "familial_status", phrase: "No kids" });
    const [row] = await handle.db.select().from(fairHousingCheck).where(eq(fairHousingCheck.id, check.id));
    expect(row!.textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("please");
    const audits = await handle.db.select().from(auditLog).where(eq(auditLog.entityId, check.id));
    expect(audits).toHaveLength(1);
  });

  it("uses only this workspace's active rules", async () => {
    const { ctx } = await setup();
    const other = await setup();
    const rules = await activeRules(handle.db, ctx.workspaceId);
    const noKids = rules.find((r) => r.pattern.includes("kids"))!;
    await setRuleActive(handle.db, ctx, noKids.id, false);
    const mine = await runCheck(handle.db, ctx, { entityType: "tester", entityId: null, text: "no kids" });
    const theirs = await runCheck(handle.db, other.ctx, {
      entityType: "tester",
      entityId: null,
      text: "no kids",
    });
    expect(mine.outcome).toBe("pass");
    expect(theirs.outcome).toBe("block");
  });
});

describe("overrideCheck", () => {
  it("clears a warning with a reason", async () => {
    const { ctx } = await setup();
    const check = await runCheck(handle.db, ctx, { entityType: "tester", entityId: null, text: "No pets." });
    expect(isCleared(check)).toBe(false);
    const done = await overrideCheck(handle.db, ctx, check.id, "Building is a co-op; board rule.", NOW);
    expect(done).toMatchObject({ overrideReason: "Building is a co-op; board rule.", overriddenAt: NOW });
    expect(isCleared(done)).toBe(true);
  });

  it("needs a real reason, and never clears a block", async () => {
    const { ctx } = await setup();
    const warn = await runCheck(handle.db, ctx, { entityType: "tester", entityId: null, text: "No pets." });
    await expect(overrideCheck(handle.db, ctx, warn.id, "ok", NOW)).rejects.toThrow(/at least 10/);
    const block = await runCheck(handle.db, ctx, {
      entityType: "tester",
      entityId: null,
      text: "No vouchers",
    });
    await expect(overrideCheck(handle.db, ctx, block.id, "It's a false positive here", NOW)).rejects.toThrow(
      /can't be overridden/,
    );
  });
});

describe("rules", () => {
  it("saves a new rule after validating it, and refuses a dangerous one", async () => {
    const { ctx } = await setup();
    const input = {
      pattern: String.raw`\bno students\b`,
      category: "other",
      severity: "warn" as const,
      explanation: "Local ordinance.",
      saferRewrite: null,
    };
    const id = await saveRule(handle.db, ctx, input);
    const check = await runCheck(handle.db, ctx, {
      entityType: "tester",
      entityId: null,
      text: "No students",
    });
    expect(check.matches.some((m) => m.ruleId === id)).toBe(true);
    await expect(saveRule(handle.db, ctx, { ...input, pattern: "(a+)+$" })).rejects.toThrow(/nested/);
    await saveRule(handle.db, ctx, { ...input, id, severity: "block" });
    const [row] = await handle.db.select().from(fairHousingRule).where(eq(fairHousingRule.id, id));
    expect(row!.severity).toBe("block");
  });
});

describe("saveScript", () => {
  async function withScript() {
    const s = await setup();
    const [row] = await handle.db
      .insert(script)
      .values({ ...s.own, kind: "voicemail", name: "Voicemail", body: "Hi {{contactName}}." })
      .returning();
    return { ...s, script: row! };
  }

  it("saves clean text and logs the check against the script", async () => {
    const { ctx, script: sc } = await withScript();
    const r = await saveScript(handle.db, ctx, { id: sc.id, body: "Hi {{contactName}}, calling back." }, NOW);
    expect(r).toMatchObject({ saved: true, outcome: "pass" });
    const checks = await handle.db
      .select()
      .from(fairHousingCheck)
      .where(and(eq(fairHousingCheck.entityType, "script"), eq(fairHousingCheck.entityId, sc.id)));
    expect(checks).toHaveLength(1);
  });

  it("refuses blocked text and asks for a reason on a warning", async () => {
    const { ctx, script: sc } = await withScript();
    const blocked = await saveScript(handle.db, ctx, { id: sc.id, body: "We take no vouchers." }, NOW);
    expect(blocked).toMatchObject({ saved: false, outcome: "block" });
    const warned = await saveScript(
      handle.db,
      ctx,
      { id: sc.id, body: "Great for young professionals." },
      NOW,
    );
    expect(warned).toMatchObject({ saved: false, outcome: "warn" });
    const [unchanged] = await handle.db.select().from(script).where(eq(script.id, sc.id));
    expect(unchanged!.body).toBe("Hi {{contactName}}.");
    const ok = await saveScript(
      handle.db,
      ctx,
      {
        id: sc.id,
        body: "Great for young professionals.",
        overrideReason: "Quoting the firm's own ad back to them.",
      },
      NOW,
    );
    expect(ok).toMatchObject({ saved: true, outcome: "warn" });
  });
});

describe("checkForText", () => {
  it("finds the check that covered exactly this text, ignoring rejected drafts", async () => {
    const { ctx, own } = await setup();
    const [sc] = await handle.db
      .insert(script)
      .values({ ...own, kind: "voicemail", name: "Voicemail", body: "Hi {{contactName}}." })
      .returning();
    await saveScript(handle.db, ctx, { id: sc!.id, body: "Hi there, calling back." }, NOW);
    await saveScript(handle.db, ctx, { id: sc!.id, body: "We take no vouchers." }, NOW);
    const found = await checkForText(handle.db, ctx.workspaceId, "script", sc!.id, "Hi there, calling back.");
    expect(found?.outcome).toBe("pass");
    expect(await checkForText(handle.db, ctx.workspaceId, "script", sc!.id, "Never checked")).toBeNull();
  });
});
