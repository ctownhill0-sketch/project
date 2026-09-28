import type { Db } from "@/lib/db/client";
import { appUser, company, contact, membership, pipelineStage, workspace } from "@/lib/db/schema";

let ownerCount = 0;

/** Minimal owned rows for DB-level tests. Fictional data only. */
export async function insertOwner(db: Db) {
  ownerCount += 1;
  const [ws] = await db.insert(workspace).values({ name: "Test workspace" }).returning();
  const [user] = await db
    .insert(appUser)
    .values({ email: `owner${ownerCount}@vacancydesk.example`, name: "Test Owner" })
    .returning();
  if (!ws || !user) throw new Error("fixture insert failed");
  await db.insert(membership).values({ workspaceId: ws.id, createdById: user.id, userId: user.id });
  return { workspaceId: ws.id, userId: user.id, own: { workspaceId: ws.id, createdById: user.id } };
}

export async function insertCompany(
  db: Db,
  own: { workspaceId: string; createdById: string },
  name = "Harborline Residential",
) {
  const [row] = await db
    .insert(company)
    .values({ ...own, name, normalizedName: name.toLowerCase() })
    .returning();
  if (!row) throw new Error("fixture insert failed");
  return row;
}

export async function insertContact(
  db: Db,
  own: { workspaceId: string; createdById: string },
  companyId: string,
) {
  const [row] = await db
    .insert(contact)
    .values({ ...own, companyId, name: "Pat Example" })
    .returning();
  if (!row) throw new Error("fixture insert failed");
  return row;
}

export async function insertStage(db: Db, own: { workspaceId: string; createdById: string }) {
  const [row] = await db
    .insert(pipelineStage)
    .values({ ...own, key: "new", name: "New", position: 1, probability: 5 })
    .returning();
  if (!row) throw new Error("fixture insert failed");
  return row;
}
