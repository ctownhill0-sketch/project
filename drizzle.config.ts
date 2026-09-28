import { defineConfig } from "drizzle-kit";

// Migrations are generated from lib/db/schema and committed. The same SQL runs on
// PGlite (local) and on real Postgres/Neon (CI parity, later deployment).
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
});
