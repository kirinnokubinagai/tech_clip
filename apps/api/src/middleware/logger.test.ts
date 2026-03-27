import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequestLoggerMiddleware } from "./logger";

/** テスト用のレスポンスボディ型 */
type TestResponseBody = {
  requestId?: string;
  message?: string;
};

/** テスト用Honoアプリを作成する */
function createTestApp(options?: { withAuth?: boolean }) {
  type Variables = {
    user?: { id: string };
    requestId?: string;
  };
  const app = new Hono<{ Variables: Variables }>();

  const loggerMiddleware = createRequestLoggerMiddleware();
  app.use("*", loggerMiddleware);

  app.get("/test", (c) => {
    return c.json({ message: "ok" });
  });

  app.get("/test/request-id", (c) => {
    const requestId = c.get("requestId");
    return c.json({ requestId });
  });

  if (options?.withAuth) {
    app.get("/authed", (c) => {
      c.set("user", { id: "user-123" });
      return c.json({ message: "認証済み" });
    });

    app.get("/authed/pre-set", (c) => {
      return c.json({ message: "ユーザー情報あり" });
    });
  }

  app.get("/error", () => {
    throw new Error("テストエラー");
  });

  return app;
}

/** テスト用の認証済みアプリを作成する */
function createAuthenticatedApp() {
  type Variables = {
    user?: { id: string };
    requestId?: string;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-456" });
    await next();
  });

  const loggerMiddleware = createRequestLoggerMiddleware();
  app.use("*", loggerMiddleware);

  app.get("/profile", (c) => {
    return c.json({ message: "プロフィール" });
  });

  return app;
}

describe("createRequestLoggerMiddleware", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("リクエストIDの生成", () => {
    it("各リクエストにユニークなリクエストIDが生成されること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res1 = await app.request("/test");
      const res2 = await app.request("/test");

      // Assert
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
      const log1 = JSON.parse(calls[0][0] as string) as Record<string, unknown>;
      const log2 = JSON.parse(calls[1][0] as string) as Record<string, unknown>;
      expect(log1.requestId).toBeDefined();
      expect(log2.requestId).toBeDefined();
      expect(log1.requestId).not.toBe(log2.requestId);
    });

    it("リクエストIDがコンテキストにセットされること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test/request-id");

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as TestResponseBody;
      expect(body.requestId).toBeDefined();
      expect(typeof body.requestId).toBe("string");
      expect((body.requestId as string).length).toBeGreaterThan(0);
    });

    it("X-Request-IDヘッダーがレスポンスに含まれること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.headers.get("X-Request-ID")).toBeDefined();
      expect(res.headers.get("X-Request-ID")).not.toBe("");
    });
  });

  describe("JSON構造化ログ出力", () => {
    it("リクエストログがJSON形式で出力されること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      await app.request("/test");

      // Assert
      expect(console.log).toHaveBeenCalled();
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("ログにHTTPメソッドが含まれること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      await app.request("/test", { method: "GET" });

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.method).toBe("GET");
    });

    it("ログにパスが含まれること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      await app.request("/test");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.path).toBe("/test");
    });

    it("ログにHTTPステータスコードが含まれること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      await app.request("/test");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.status).toBe(200);
    });

    it("ログにrequestIdが含まれること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      await app.request("/test");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.requestId).toBeDefined();
      expect(typeof parsed.requestId).toBe("string");
    });
  });

  describe("レスポンス時間の計測", () => {
    it("ログにresponseTimeMs（数値）が含まれること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      await app.request("/test");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.responseTimeMs).toBeDefined();
      expect(typeof parsed.responseTimeMs).toBe("number");
      expect(parsed.responseTimeMs as number).toBeGreaterThanOrEqual(0);
    });
  });

  describe("認証済みユーザーIDの記録", () => {
    it("認証済みリクエストのログにuserIdが含まれること", async () => {
      // Arrange
      const app = createAuthenticatedApp();

      // Act
      await app.request("/profile");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.userId).toBe("user-456");
    });

    it("未認証リクエストのログにuserIdが含まれないこと", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      await app.request("/test");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.userId).toBeUndefined();
    });
  });
});
