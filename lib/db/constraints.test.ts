import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { company, contact, deal, dncEntry } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { insertCompany, insertContact, insertOwner, insertStage } from "@/lib/db/test-fixtures";

let handle: DbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

describe("deal constraints", () => {
  it("allows only one open deal per company", async () => {
    const { db } = handle;
    const { own } = await insertOwner(db);
    const firm = await insertCompany(db, own);
    const stage = await insertStage(db, own);
    const openDeal = { ...own, companyId: firm.id, stageId: stage.id, probability: 5, expectedMrr: "20.00" };

    await db.insert(deal).values(openDeal);
    await expect(db.insert(deal).values(openDeal)).rejects.toThrow();
    // A closed deal doesn't count.
    await expect(db.insert(deal).values({ ...openDeal, closedAt: new Date() })).resolves.toBeDefined();
  });
});

/** Drizzle wraps database errors; the Postgres message is on `cause`. */
const PERMANENT_DNC = { cause: { message: expect.stringMatching(/do_not_call is permanent/) } };

describe("do-not-call is permanent", () => {
  it("rejects clearing contact.do_not_call", async () => {
    const { db } = handle;
    const { own } = await insertOwner(db);
    const firm = await insertCompany(db, own, "Quarry Oak Property Group");
    const person = await insertContact(db, own, firm.id);

    await db.update(contact).set({ doNotCall: true }).where(eq(contact.id, person.id));
    await expect(
      db.update(contact).set({ doNotCall: false }).where(eq(contact.id, person.id)),
    ).rejects.toMatchObject(PERMANENT_DNC);
  });

  it("rejects clearing company.dnc_flag but allows other edits", async () => {
    const { db } = handle;
    const { own } = await insertOwner(db);
    const firm = await insertCompany(db, own, "Brightwater Lane Rentals");

    await db.update(company).set({ dncFlag: true }).where(eq(company.id, firm.id));
    await expect(
      db.update(company).set({ name: "Brightwater Lane Homes" }).where(eq(company.id, firm.id)),
    ).resolves.toBeDefined();
    await expect(
      db.update(company).set({ dncFlag: false }).where(eq(company.id, firm.id)),
    ).rejects.toMatchObject(PERMANENT_DNC);
  });
});

describe("do-not-call rows can't be deleted", () => {
  it("rejects deleting a flagged contact or company, so re-importing can't reset the flag", async () => {
    const { db } = handle;
    const { own } = await insertOwner(db);
    const firm = await insertCompany(db, own, "Lanternway Homes");
    const person = await insertContact(db, own, firm.id);
    await db.update(contact).set({ doNotCall: true }).where(eq(contact.id, person.id));
    await db.update(company).set({ dncFlag: true }).where(eq(company.id, firm.id));

    await expect(db.delete(contact).where(eq(contact.id, person.id))).rejects.toMatchObject(PERMANENT_DNC);
    await expect(db.delete(company).where(eq(company.id, firm.id))).rejects.toMatchObject(PERMANENT_DNC);
  });

  it("still allows deleting rows without the flag", async () => {
    const { db } = handle;
    const { own } = await insertOwner(db);
    const firm = await insertCompany(db, own, "Redfern Rentals");
    await expect(db.delete(company).where(eq(company.id, firm.id))).resolves.toBeDefined();
  });
});

describe("do-not-call list entries are permanent", () => {
  it("rejects deleting or changing a dnc_entry", async () => {
    const { db } = handle;
    const { own } = await insertOwner(db);
    const [entry] = await db
      .insert(dncEntry)
      .values({ ...own, kind: "phone", value: "2015550142", reason: "Asked not to be called" })
      .returning();
    await expect(db.delete(dncEntry).where(eq(dncEntry.id, entry!.id))).rejects.toMatchObject(PERMANENT_DNC);
    await expect(
      db.update(dncEntry).set({ value: "2015550199" }).where(eq(dncEntry.id, entry!.id)),
    ).rejects.toMatchObject(PERMANENT_DNC);
  });
});
