import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { getDb } from "@/lib/db";
import { membership } from "@/lib/db/schema";

export interface CurrentUser {
  userId: string;
  workspaceId: string;
}

/** The single local owner. Free Build: there is no sign-in. */
export async function findLocalOwner(db: Db): Promise<CurrentUser> {
  const [row] = await db
    .select({ userId: membership.userId, workspaceId: membership.workspaceId })
    .from(membership)
    .where(eq(membership.role, "owner"))
    .orderBy(asc(membership.createdAt))
    .limit(1);
  if (!row) throw new Error("No local owner found. Run pnpm db:setup.");
  return row;
}

/**
 * Call at the top of every Server Action and Route Handler, and scope every query
 * by the returned workspaceId.
 * AUTH-HOOK: replace with a Better Auth session lookup when the app is deployed.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  // Everything behind requireUser is per-request data: never prerender it at build time.
  await connection();
  return findLocalOwner(await getDb());
});
