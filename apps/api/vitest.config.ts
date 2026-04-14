import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

import { shouldSuppressTestLog } from "./vitest.utils";

export default defineConfig({
  resolve: {
    alias: {
      "@api": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["../../tests/api/setup.ts"],
    include: ["../../tests/api/**/*.test.ts"],
    onConsoleLog(log) {
      return shouldSuppressTestLog(log);
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/db/seed.ts"],
    },
  },
});
