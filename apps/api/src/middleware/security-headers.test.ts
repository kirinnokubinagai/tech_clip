import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { securityHeadersMiddleware } from "./security-headers";

/** テスト用Honoアプリを作成する */
function createTestApp(env: Record<string, string> = {}) {
  const app = new Hono<{ Bindings: Record<string, string> }>();
  app.use("*", securityHeadersMiddleware);
  app.get("/test", (c) => c.json({ status: "ok" }));
  return { app, env };
}

describe("securityHeadersMiddleware", () => {
  describe("共通ヘッダー", () => {
    it("X-Content-Type-Optionsがnosniffであること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("X-Frame-OptionsがDENYであること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("X-XSS-Protectionが1; mode=blockであること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    });

    it("Referrer-Policyがstrict-origin-when-cross-originであること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    });

    it("Permissions-Policyでカメラ・マイク・位置情報が無効であること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("Permissions-Policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
    });
  });

  describe("HSTS（本番環境のみ）", () => {
    it("ENVIRONMENT=productionの場合HSTSヘッダーが付与されること", async () => {
      // Arrange
      const app = new Hono<{ Bindings: Record<string, string> }>();
      app.use("*", securityHeadersMiddleware);
      app.get("/test", (c) => c.json({ status: "ok" }));

      // Act
      const res = await app.request("/test", undefined, {
        ENVIRONMENT: "production",
      });

      // Assert
      expect(res.headers.get("Strict-Transport-Security")).toBe(
        "max-age=31536000; includeSubDomains",
      );
    });

    it("ENVIRONMENT=developmentの場合HSTSヘッダーが付与されないこと", async () => {
      // Arrange
      const app = new Hono<{ Bindings: Record<string, string> }>();
      app.use("*", securityHeadersMiddleware);
      app.get("/test", (c) => c.json({ status: "ok" }));

      // Act
      const res = await app.request("/test", undefined, {
        ENVIRONMENT: "development",
      });

      // Assert
      expect(res.headers.get("Strict-Transport-Security")).toBeNull();
    });

    it("ENVIRONMENTが未設定の場合HSTSヘッダーが付与されないこと", async () => {
      // Arrange
      const app = new Hono<{ Bindings: Record<string, string> }>();
      app.use("*", securityHeadersMiddleware);
      app.get("/test", (c) => c.json({ status: "ok" }));

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("Strict-Transport-Security")).toBeNull();
    });
  });

  describe("レスポンスボディへの影響", () => {
    it("レスポンスボディが変更されないこと", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");
      const body = await res.json();

      // Assert
      expect(body).toEqual({ status: "ok" });
    });

    it("ステータスコードが変更されないこと", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.status).toBe(200);
    });
  });
});
