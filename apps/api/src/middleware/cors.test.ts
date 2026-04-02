import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { corsMiddleware, createCorsMiddleware } from "./cors";

/**
 * CORSミドルウェアのテスト用Honoアプリを生成する
 */
function createTestApp(): Hono {
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

/**
 * カスタムオリジンリストで CORSミドルウェアのテスト用Honoアプリを生成する
 */
function createTestAppWithOrigins(origins: string[]): Hono {
  const app = new Hono();
  app.use("*", createCorsMiddleware(origins));
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

    it("techclip.app サフィックスを悪用した不正オリジンを拒否すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://evil.techclip.app.attacker.com" },
      });

      // Assert
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(
        "https://evil.techclip.app.attacker.com",
      );
    });

    it("techclip.app をサブドメインとして含む不正オリジンを拒否すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://notatechclip.app" },
      });

      // Assert
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("https://notatechclip.app");
    });

    it("ホワイトリストに登録されていないサブドメインを拒否すること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://unknown-sub.techclip.app" },
      });

      // Assert
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(
        "https://unknown-sub.techclip.app",
      );
    });
  });

  describe("Originヘッダーなし", () => {
    it("Originなしリクエストにワイルドカードを返さないこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
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

  describe("createCorsMiddleware", () => {
    it("空のオリジンリストではすべてのオリジンを拒否すること", async () => {
      // Arrange
      const app = createTestAppWithOrigins([]);

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://any.example.com" },
      });

      // Assert
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("https://any.example.com");
    });

    it("複数オリジンのリストから一致するオリジンを許可すること", async () => {
      // Arrange
      const app = createTestAppWithOrigins([
        "https://app1.example.com",
        "https://app2.example.com",
      ]);

      // Act
      const res1 = await app.request("/test", {
        headers: { Origin: "https://app1.example.com" },
      });
      const res2 = await app.request("/test", {
        headers: { Origin: "https://app2.example.com" },
      });

      // Assert
      expect(res1.headers.get("Access-Control-Allow-Origin")).toBe("https://app1.example.com");
      expect(res2.headers.get("Access-Control-Allow-Origin")).toBe("https://app2.example.com");
    });

    it("明示的に許可された https://app.techclip.app を許可すること", async () => {
      // Arrange
      const app = createTestAppWithOrigins([
        "techclip://",
        "http://localhost:8081",
        "http://localhost:19006",
        "https://app.techclip.app",
      ]);

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://app.techclip.app" },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.techclip.app");
    });

    it("ホワイトリスト外のオリジンをリストに追加しても既存の拒否ルールが維持されること", async () => {
      // Arrange
      const app = createTestAppWithOrigins(["https://allowed.example.com"]);

      // Act
      const res = await app.request("/test", {
        headers: { Origin: "https://not-allowed.example.com" },
      });

      // Assert
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(
        "https://not-allowed.example.com",
      );
    });
  });
});
