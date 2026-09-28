import type { Db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

export type AuditAction = (typeof auditLog.$inferInsert)["action"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface AuditContext {
  userId: string;
  workspaceId: string;
}

export interface AuditMeta {
  action: AuditAction;
  entity: string;
}

export interface AuditedWork<T> {
  result: T;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/** Personal data never goes into the audit log (brief Part 10: PII minimised). */
const PERSONAL_FIELDS = new Set(["email", "phone", "normalizedPhone", "shopperName"]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        PERSONAL_FIELDS.has(key) ? "[redacted]" : redact(inner),
      ]),
    );
  }
  return value;
}

/**
 * Runs a create/update/delete and writes its AuditLog row in one transaction:
 * either both happen or neither does.
 */
export async function withAudit<T>(
  db: Db,
  ctx: AuditContext,
  meta: AuditMeta,
  work: (tx: Tx) => Promise<AuditedWork<T>>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const { result, entityId, before, after } = await work(tx);
    await tx.insert(auditLog).values({
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      action: meta.action,
      entity: meta.entity,
      entityId: entityId ?? null,
      diff: redact({ before, after }) as Record<string, unknown>,
    });
    return result;
  });
}
