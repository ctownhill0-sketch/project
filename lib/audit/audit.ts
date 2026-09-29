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

/**
 * Personal data never goes into the audit log (brief Part 10: PII minimised).
 * Keys are compared without case or underscores, so `shopperName` and
 * `shopper_name` match. Free-text notes may contain anything, so they're hidden too.
 */
const PERSONAL_FIELDS = new Set(["email", "phone", "normalizedphone", "shoppername", "notes"]);
/** Entities that describe a person: their name and role are personal data as well. */
const PERSON_ENTITIES = new Set(["contact", "app_user"]);
const PERSON_FIELDS = new Set(["name", "roletitle"]);

const normalizeKey = (key: string) => key.replace(/_/g, "").toLowerCase();

export function redact(value: unknown, options: { entity?: string } = {}): unknown {
  const isPerson = options.entity !== undefined && PERSON_ENTITIES.has(options.entity);
  const hide = (key: string) => {
    const k = normalizeKey(key);
    return PERSONAL_FIELDS.has(k) || (isPerson && PERSON_FIELDS.has(k));
  };
  const walk = (inner: unknown): unknown => {
    if (Array.isArray(inner)) return inner.map(walk);
    if (inner instanceof Date) return inner.toISOString();
    if (inner && typeof inner === "object") {
      return Object.fromEntries(
        Object.entries(inner).map(([key, v]) => [key, hide(key) ? "[redacted]" : walk(v)]),
      );
    }
    return inner;
  };
  return walk(value);
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
      diff: redact({ before, after }, { entity: meta.entity }) as Record<string, unknown>,
    });
    return result;
  });
}

/**
 * An extra audit row inside a transaction that `withAudit` already opened, for work that
 * changes more than one entity (e.g. triage "add" updates a place and creates a company).
 */
export async function writeAudit(
  tx: Tx,
  ctx: AuditContext,
  meta: AuditMeta,
  change: { entityId?: string; before?: unknown; after?: unknown },
): Promise<void> {
  await tx.insert(auditLog).values({
    workspaceId: ctx.workspaceId,
    createdById: ctx.userId,
    action: meta.action,
    entity: meta.entity,
    entityId: change.entityId ?? null,
    diff: redact({ before: change.before, after: change.after }, { entity: meta.entity }) as Record<
      string,
      unknown
    >,
  });
}
