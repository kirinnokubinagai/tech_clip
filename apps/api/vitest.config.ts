import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const suppressedApiTestLogs = [
  "\"message\":\"認証メール送信エラー\"",
  "\"message\":\"サインインに失敗しました\"",
  "\"message\":\"リフレッシュトークンの発行に失敗しました\"",
  "\"message\":\"リフレッシュトークンの再利用を検知しました\"",
];

export default defineConfig({
  resolve: {
    alias: {
      "@api": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["../../tests/api/**/*.test.ts"],
    onConsoleLog(log) {
      if (suppressedApiTestLogs.some((message) => log.includes(message))) {
        return false;
      }
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/db/seed.ts"],
    },
  },
});
