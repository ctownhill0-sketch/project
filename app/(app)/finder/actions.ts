"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { toResult } from "@/lib/actions/result";
import { withAudit } from "@/lib/audit/audit";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { placeResult, savedSearch, territory, territoryTown } from "@/lib/db/schema";
import { getPageSource, getPlacesClient } from "@/lib/finder/runtime";
import {
  createSearchRun,
  enrichPending,
  fetchPlaceReviews,
  runNextQuery,
  stopRun,
  triagePlace,
  undoLastTriage,
} from "@/lib/finder/service";

const Town = z.object({
  town: z.string().trim().min(1).max(80),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a 2-letter state"),
});
const RunInput = z.object({
  towns: z.array(Town).min(1).max(50),
  keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  territoryId: z.uuid().nullish(),
  savedSearchId: z.uuid().nullish(),
});
const Id = z.uuid();
const Decision = z.enum(["add", "skip", "not_a_fit", "dnc"]);

export async function createRunAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = RunInput.parse(raw);
    const run = await createSearchRun(await getDb(), user, input, new Date());
    return { runId: run.id, plannedQueries: run.plannedQueries, estimatedRequests: run.estimatedRequests };
  });
}

export async function runStepAction(runId: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const step = await runNextQuery(await getDb(), user, Id.parse(runId), getPlacesClient(), new Date());
    if (step.done) refresh();
    return {
      done: step.done,
      status: step.run.status,
      message: step.message,
      query: step.query,
      counters: {
        requestsUsed: step.run.requestsUsed,
        resultsFound: step.run.resultsFound,
        newFound: step.run.newFound,
        plannedQueries: step.run.plannedQueries,
      },
    };
  });
}

export async function stopRunAction(runId: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    await stopRun(await getDb(), user, Id.parse(runId), new Date());
    refresh();
    return null;
  });
}

export async function enrichStepAction(runId: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const id = runId === null ? null : Id.parse(runId);
    const result = await enrichPending(await getDb(), user, id, getPageSource(), { limit: 5 }, new Date());
    if (result.remaining === 0) refresh();
    return result;
  });
}

export async function reviewsAction(placeResultId: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const r = await fetchPlaceReviews(
      await getDb(),
      user,
      Id.parse(placeResultId),
      getPlacesClient(),
      new Date(),
    );
    refresh();
    if (r.outcome !== "ok" && r.outcome !== "empty") throw new Error(r.message);
    return { flags: r.flags };
  });
}

export async function triageAction(placeResultId: unknown, decision: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const result = await triagePlace(
      await getDb(),
      user,
      Id.parse(placeResultId),
      Decision.parse(decision),
      new Date(),
    );
    return result;
  });
}

export async function undoTriageAction() {
  const user = await requireUser();
  return toResult(async () => undoLastTriage(await getDb(), user, new Date()));
}

export async function bulkTriageAction(ids: unknown, decision: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const list = z.array(Id).min(1).max(500).parse(ids);
    const kind = z.enum(["add", "not_a_fit", "skip"]).parse(decision);
    const db = await getDb();
    const failures: string[] = [];
    let done = 0;
    for (const id of list) {
      try {
        const r = await triagePlace(db, user, id, kind, new Date());
        if (r.blocked) failures.push(r.blocked);
        else done += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "failed");
      }
    }
    refresh();
    return { done, skipped: failures.length, reasons: [...new Set(failures)].slice(0, 3) };
  });
}

/** "Not a fit" was wrong: mark the place OK again so it can be added (spec §4.2 override). */
export async function overrideFitAction(placeResultId: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const id = Id.parse(placeResultId);
    const db = await getDb();
    await withAudit(db, user, { action: "update", entity: "place_result" }, async (tx) => {
      await tx
        .update(placeResult)
        .set({ fitStatus: "ok", fitReason: null, fitOverridden: true })
        .where(and(eq(placeResult.id, id), eq(placeResult.workspaceId, user.workspaceId)));
      return { result: null, entityId: id, after: { fitStatus: "ok", fitOverridden: true } };
    });
    refresh();
    return null;
  });
}

const TerritoryInput = z.object({
  name: z.string().trim().min(1).max(80),
  towns: z.array(Town).min(1).max(100),
});

export async function saveTerritoryAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = TerritoryInput.parse(raw);
    const db = await getDb();
    const id = await withAudit(db, user, { action: "create", entity: "territory" }, async (tx) => {
      const [row] = await tx
        .insert(territory)
        .values({ workspaceId: user.workspaceId, createdById: user.userId, name: input.name })
        .returning();
      await tx.insert(territoryTown).values(
        input.towns.map((t, position) => ({
          workspaceId: user.workspaceId,
          createdById: user.userId,
          territoryId: row!.id,
          town: t.town,
          state: t.state.toUpperCase(),
          position,
        })),
      );
      return { result: row!.id, entityId: row!.id, after: input };
    });
    refresh();
    return { territoryId: id };
  });
}

const SavedSearchInput = z.object({
  name: z.string().trim().min(1).max(80),
  towns: z.array(Town).min(1).max(50),
  keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
});

export async function saveSearchAction(raw: unknown) {
  const user = await requireUser();
  return toResult(async () => {
    const input = SavedSearchInput.parse(raw);
    const db = await getDb();
    await withAudit(db, user, { action: "create", entity: "saved_search" }, async (tx) => {
      const [row] = await tx
        .insert(savedSearch)
        .values({ workspaceId: user.workspaceId, createdById: user.userId, ...input })
        .returning();
      return { result: row!.id, entityId: row!.id, after: input };
    });
    refresh();
    return null;
  });
}
