import { securityHeadersMiddleware } from "@api/middleware/security-headers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

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

    it("X-XSS-Protectionが設定されていないこと（CSPに置き換え済み）", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("X-XSS-Protection")).toBeNull();
    });

    it("Referrer-Policyがstrict-origin-when-cross-originであること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
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

  describe("Content-Security-Policy", () => {
    it("CSPヘッダーが設定されていること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
    });

    it("CSPにdefault-src 'none'が含まれること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      const csp = res.headers.get("Content-Security-Policy");
      expect(csp).toContain("default-src 'none'");
    });

    it("CSPにframe-ancestors 'none'が含まれること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      const csp = res.headers.get("Content-Security-Policy");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("CSPにbase-uri 'self'が含まれること", async () => {
      // Arrange
      const { app } = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      const csp = res.headers.get("Content-Security-Policy");
      expect(csp).toContain("base-uri 'self'");
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
