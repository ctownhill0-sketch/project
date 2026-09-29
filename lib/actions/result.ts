import { ZodError } from "zod";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Turns thrown errors into a message the UI can show. Zod issues name the field. */
export async function toResult<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return {
        ok: false,
        error: `Check ${issue?.path.join(".") || "the form"}: ${issue?.message ?? "invalid value"}`,
      };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }
}
