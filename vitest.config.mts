import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./", import.meta.url)),
  "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: ["node_modules/**", "e2e/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          exclude: ["node_modules/**", "e2e/**"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      thresholds: { "lib/domain/**": { lines: 90, functions: 90, branches: 90, statements: 90 } },
    },
  },
});
