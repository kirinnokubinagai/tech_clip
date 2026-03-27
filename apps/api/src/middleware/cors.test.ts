import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { corsMiddleware } from "./cors";

/**
 * CORSミドルウェアのテスト用Honoアプリを生成する
 */
function createTestApp(): Hono {
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

describe("corsMiddleware", () => {
  describe("許可されたオリジン", () => {
    it("Expoカスタムスキーム techclip:// を許可すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "techclip://" },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("techclip://");
    });

    it("localhost:8081 を許可すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:8081" },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    });

    it("localhost:19006 を許可すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:19006" },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:19006");
    });

    it("*.techclip.app サブドメインを許可すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://api.techclip.app" },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://api.techclip.app");
    });
  });

  describe("拒否されるオリジン", () => {
    it("未許可のオリジンを拒否すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://evil.example.com" },
      });

      // Assert
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("https://evil.example.com");
    });
  });

  describe("Originヘッダーなし", () => {
    it("Originなしリクエストにワイルドカードを返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("プリフライトリクエスト", () => {
    it("OPTIONSリクエストに204を返すこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:8081",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });

      // Assert
      expect(res.status).toBe(204);
    });

    it("許可メソッドにGET,POST,PATCH,DELETE,OPTIONSを含むこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:8081",
          "Access-Control-Request-Method": "POST",
        },
      });

      // Assert
      const allowMethods = res.headers.get("Access-Control-Allow-Methods");
      expect(allowMethods).toContain("GET");
      expect(allowMethods).toContain("POST");
      expect(allowMethods).toContain("PATCH");
      expect(allowMethods).toContain("DELETE");
      expect(allowMethods).toContain("OPTIONS");
    });

    it("許可ヘッダーにContent-TypeとAuthorizationを含むこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:8081",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });

      // Assert
      const allowHeaders = res.headers.get("Access-Control-Allow-Headers");
      expect(allowHeaders).toContain("Content-Type");
      expect(allowHeaders).toContain("Authorization");
    });
  });

  describe("credentialsヘッダー", () => {
    it("Access-Control-Allow-Credentialsがtrueであること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:8081" },
      });

      // Assert
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });

  describe("Max-Ageヘッダー", () => {
    it("プリフライトキャッシュが86400秒であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:8081",
          "Access-Control-Request-Method": "GET",
        },
      });

      // Assert
      expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    });
  });
});
