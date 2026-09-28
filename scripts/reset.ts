import { rmSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "@/lib/env";

// Deletes the local database folder only. Why: start over with fresh demo data.
const env = parseEnv(process.env);
if (env.DATABASE_DRIVER !== "pglite") throw new Error("Reset only works on the local database.");
rmSync(path.resolve(env.PGLITE_DIR), { recursive: true, force: true });
console.log(`Deleted ${env.PGLITE_DIR}.`);
