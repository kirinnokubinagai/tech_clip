import { describe, it, expect } from "vitest";
import app from "../index";

describe("Better Auth", () => {
  describe("createAuth", () => {
    it("createAuth関数がエクスポートされていること", async () => {
      // Arrange
      const { createAuth } = await import("./index");

      // Assert
      expect(typeof createAuth).toBe("function");
    });

    it("DB引数とシークレットを渡してauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("./index");
      const mockDb = {} as Parameters<typeof createAuth>[0];
      const secret = "test-secret-key-for-better-auth-min-32-chars!!";

      // Act
      const auth = createAuth(mockDb, secret);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
      expect(typeof auth.handler).toBe("function");
    });
  });

  describe("認証ルート統合", () => {
    it("GET /api/auth/* がBetter Authハンドラーに接続されていること", async () => {
      // Arrange
      const req = new Request("http://localhost/api/auth/ok");

      // Act
      const res = await app.fetch(req, {
        TURSO_DATABASE_URL: "file:local.db",
        TURSO_AUTH_TOKEN: "test-token",
        RUNPOD_API_KEY: "test-key",
        RUNPOD_ENDPOINT_ID: "test-endpoint",
        ENVIRONMENT: "test",
        BETTER_AUTH_SECRET: "test-secret-key-for-better-auth-min-32-chars!!",
      });

      // Assert
      expect(res.status).not.toBe(404);
    });

    it("既存のhealthエンドポイントが引き続き動作すること", async () => {
      // Arrange
      const req = new Request("http://localhost/health");

      // Act
      const res = await app.fetch(req, {
        TURSO_DATABASE_URL: "file:local.db",
        TURSO_AUTH_TOKEN: "test-token",
        RUNPOD_API_KEY: "test-key",
        RUNPOD_ENDPOINT_ID: "test-endpoint",
        ENVIRONMENT: "test",
        BETTER_AUTH_SECRET: "test-secret-key-for-better-auth-min-32-chars!!",
      });

      // Assert
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ status: "ok" });
    });
  });
});
