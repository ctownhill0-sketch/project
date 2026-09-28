import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WebAssembly Postgres; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The dev-tools badge overlaps the phone bottom bar and screenshots.
  devIndicators: false,
};

export default nextConfig;
