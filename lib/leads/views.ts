// Saved views for the Leads table: a name plus the filter query string, kept in settings.
import type { AuditContext } from "@/lib/audit/audit";
import type { Db } from "@/lib/db/client";
import { getSetting } from "@/lib/queries/settings";
import { saveSetting } from "@/lib/settings/save";

export interface SavedView {
  name: string;
  query: string;
}

const KEY = "leads.views";
const MAX_VIEWS = 20;
const FILTER_PARAMS = ["status", "software", "q"] as const;

/** Only known filters survive, in a fixed order, so views can't carry anything else in the URL. */
export function sanitizeViewQuery(query: string): string {
  const input = new URLSearchParams(query.replace(/^\?/, ""));
  const out = new URLSearchParams();
  for (const key of FILTER_PARAMS) {
    const value = input.get(key);
    if (value && /^[\w .,'&-]{1,100}$/.test(value)) out.set(key, value);
  }
  return out.toString();
}

export async function listSavedViews(db: Db, workspaceId: string): Promise<SavedView[]> {
  return getSetting<SavedView[]>(db, workspaceId, KEY, []);
}

export async function saveSavedView(db: Db, ctx: AuditContext, name: string, query: string) {
  const views = await listSavedViews(db, ctx.workspaceId);
  const clean = { name: name.trim(), query: sanitizeViewQuery(query) };
  const at = views.findIndex((v) => v.name === clean.name);
  if (at >= 0) views[at] = clean;
  else {
    if (views.length >= MAX_VIEWS)
      throw new Error(`You can keep up to ${MAX_VIEWS} saved views. Delete one first.`);
    views.push(clean);
  }
  await saveSetting(db, ctx, KEY, views);
}

export async function deleteSavedView(db: Db, ctx: AuditContext, name: string) {
  const views = await listSavedViews(db, ctx.workspaceId);
  await saveSetting(
    db,
    ctx,
    KEY,
    views.filter((v) => v.name !== name),
  );
}
