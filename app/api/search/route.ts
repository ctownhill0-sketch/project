import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { searchLeads } from "@/lib/queries/leads";

const Query = z.object({ q: z.string().trim().max(100) });

/** ⌘K lead search. Local only (proxy.ts), workspace-scoped, input validated. */
export async function GET(request: NextRequest) {
  const { workspaceId } = await requireUser();
  const parsed = Query.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success)
    return NextResponse.json({ error: "Search text must be 100 characters or fewer." }, { status: 400 });
  const results = await searchLeads(await getDb(), workspaceId, parsed.data.q);
  return NextResponse.json({ results });
}
