import { z } from "zod";

const envSchema = z.object({
  DATABASE_DRIVER: z.enum(["pglite", "neon"]).default("pglite"),
  PGLITE_DIR: z.string().default(".data/pglite"),
  DATABASE_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid env: ${problems}`);
  }
  return result.data;
}
