import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  createInMemoryStore,
  createKvStore,
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIG,
} from "./rateLimit";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 429 Too Many Requests ステータスコード */
const HTTP_TOO_MANY_REQUESTS = 429;

/** テスト用のHonoアプリを作成する */
function createTestApp(limit: number, windowMs: number) {
  const store = createInMemoryStore();
  const app = new Hono();
  app.use("/api/*", createRateLimitMiddleware({ limit, windowMs, keyPrefix: "test" }, store));
  app.get("/api/test", (c) => c.json({ success: true, data: "ok" }, HTTP_OK));
  return app;
}

describe("createRateLimitMiddleware", () => {
  describe("制限内のリクエスト", () => {
    it("制限以内のリクエストは通過すること", async () => {
      // Arrange
      const app = createTestApp(3, 60_000);

      // Act
      const res = await app.request("/api/test");

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("制限数と同じ回数のリクエストはすべて通過すること", async () => {
      // Arrange
      const app = createTestApp(3, 60_000);

      // Act & Assert
      for (let i = 0; i < 3; i++) {
        const res = await app.request("/api/test");
        expect(res.status).toBe(HTTP_OK);
      }
    });
  });

  describe("制限超過", () => {
    it("制限を超えたリクエストは429が返ること", async () => {
      // Arrange
      const app = createTestApp(2, 60_000);

      // Act
      await app.request("/api/test");
      await app.request("/api/test");
      const res = await app.request("/api/test");

      // Assert
      expect(res.status).toBe(HTTP_TOO_MANY_REQUESTS);
    });

    it("429レスポンスがAPI規約に従った形式であること", async () => {
      // Arrange
      const app = createTestApp(1, 60_000);

      // Act
      await app.request("/api/test");
      const res = await app.request("/api/test");

      // Assert
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "リクエストが多すぎます。しばらく待ってから再度お試しください",
        },
      });
    });

    it("Retry-Afterヘッダーが付与されること", async () => {
      // Arrange
      const app = createTestApp(1, 60_000);

      // Act
      await app.request("/api/test");
      const res = await app.request("/api/test");

      // Assert
      expect(res.headers.get("Retry-After")).not.toBeNull();
    });

    it("Retry-Afterヘッダーが正の整数文字列であること", async () => {
      // Arrange
      const app = createTestApp(1, 60_000);

      // Act
      await app.request("/api/test");
      const res = await app.request("/api/test");

      // Assert
      const retryAfter = Number(res.headers.get("Retry-After"));
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    });
  });

  describe("ウィンドウリセット", () => {
    it("ウィンドウが過ぎた後はカウントがリセットされること", async () => {
      // Arrange
      const store = createInMemoryStore();
      const app = new Hono();
      app.use(
        "/api/*",
        createRateLimitMiddleware({ limit: 1, windowMs: 1, keyPrefix: "test" }, store),
      );
      app.get("/api/test", (c) => c.json({ success: true, data: "ok" }, HTTP_OK));

      // Act: 1回目で上限に達する
      await app.request("/api/test");
      // 2ミリ秒待つ（windowMs=1 を超過させる）
      await new Promise((resolve) => setTimeout(resolve, 2));
      const res = await app.request("/api/test");

      // Assert: ウィンドウがリセットされて通過する
      expect(res.status).toBe(HTTP_OK);
    });
  });

  describe("getUserId オプション", () => {
    it("getUserIdが指定された場合ユーザーIDベースでカウントされること", async () => {
      // Arrange
      const store = createInMemoryStore();
      const app = new Hono<{ Variables: { userId?: string } }>();
      app.use("/api/*", async (c, next) => {
        c.set("userId", "user_01");
        await next();
      });
      app.use(
        "/api/*",
        createRateLimitMiddleware(
          {
            limit: 2,
            windowMs: 60_000,
            keyPrefix: "test",
            getUserId: (c) => c.get("userId") ?? null,
          },
          store,
        ),
      );
      app.get("/api/test", (c) => c.json({ success: true, data: "ok" }, HTTP_OK));

      // Act
      await app.request("/api/test");
      await app.request("/api/test");
      const res = await app.request("/api/test");

      // Assert
      expect(res.status).toBe(HTTP_TOO_MANY_REQUESTS);
    });

    it("異なるユーザーIDは独立したカウントになること", async () => {
      // Arrange
      const store = createInMemoryStore();
      let currentUserId = "user_01";
      const app = new Hono<{ Variables: { userId?: string } }>();
      app.use("/api/*", async (c, next) => {
        c.set("userId", currentUserId);
        await next();
      });
      app.use(
        "/api/*",
        createRateLimitMiddleware(
          {
            limit: 1,
            windowMs: 60_000,
            keyPrefix: "test",
            getUserId: (c) => c.get("userId") ?? null,
          },
          store,
        ),
      );
      app.get("/api/test", (c) => c.json({ success: true, data: "ok" }, HTTP_OK));

      // Act: user_01 で1回リクエスト（上限到達）
      currentUserId = "user_01";
      await app.request("/api/test");

      // user_02 は別カウントなので通過
      currentUserId = "user_02";
      const res = await app.request("/api/test");

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });
  });
});

describe("createInMemoryStore", () => {
  it("getで存在しないキーはnullを返すこと", () => {
    // Arrange
    const store = createInMemoryStore();

    // Act
    const result = store.get("nonexistent");

    // Assert
    expect(result).toBeNull();
  });

  it("setしたエントリをgetで取得できること", async () => {
    // Arrange
    const store = createInMemoryStore();
    const entry = { count: 5, resetAt: Date.now() + 60_000 };

    // Act
    store.set("key1", entry);
    const result = store.get("key1");

    // Assert
    expect(result).toEqual(entry);
  });

  it("clearで全エントリが削除されること", () => {
    // Arrange
    const store = createInMemoryStore();
    store.set("key1", { count: 1, resetAt: Date.now() + 60_000 });
    store.set("key2", { count: 2, resetAt: Date.now() + 60_000 });

    // Act
    store.clear();

    // Assert
    expect(store.get("key1")).toBeNull();
    expect(store.get("key2")).toBeNull();
  });
});

describe("createKvStore", () => {
  it("getで存在しないキーはnullを返すこと", async () => {
    // Arrange
    const mockKv = {
      get: async (_key: string, _type: string) => null,
      put: async () => {},
    } as unknown as KVNamespace;
    const store = createKvStore(mockKv);

    // Act
    const result = await store.get("nonexistent");

    // Assert
    expect(result).toBeNull();
  });

  it("setしたエントリをgetで取得できること", async () => {
    // Arrange
    const stored: Record<string, unknown> = {};
    const mockKv = {
      get: async (key: string, _type: string) => stored[key] ?? null,
      put: async (key: string, value: string) => {
        stored[key] = JSON.parse(value);
      },
    } as unknown as KVNamespace;
    const store = createKvStore(mockKv);
    const entry = { count: 3, resetAt: Date.now() + 60_000 };

    // Act
    await store.set("key1", entry);
    const result = await store.get("key1");

    // Assert
    expect(result).toEqual(entry);
  });
});

describe("RATE_LIMIT_CONFIG", () => {
  it("authの制限値が正しく定義されていること", () => {
    expect(RATE_LIMIT_CONFIG.auth.limit).toBe(10);
    expect(RATE_LIMIT_CONFIG.auth.windowMs).toBe(60_000);
    expect(RATE_LIMIT_CONFIG.auth.keyPrefix).toBe("auth");
  });

  it("articleSaveの制限値が正しく定義されていること", () => {
    expect(RATE_LIMIT_CONFIG.articleSave.limit).toBe(30);
    expect(RATE_LIMIT_CONFIG.articleSave.windowMs).toBe(60_000);
    expect(RATE_LIMIT_CONFIG.articleSave.keyPrefix).toBe("article_save");
  });

  it("aiの制限値が正しく定義されていること", () => {
    expect(RATE_LIMIT_CONFIG.ai.limit).toBe(10);
    expect(RATE_LIMIT_CONFIG.ai.windowMs).toBe(60_000);
    expect(RATE_LIMIT_CONFIG.ai.keyPrefix).toBe("ai");
  });

  it("generalの制限値が正しく定義されていること", () => {
    expect(RATE_LIMIT_CONFIG.general.limit).toBe(100);
    expect(RATE_LIMIT_CONFIG.general.windowMs).toBe(60_000);
    expect(RATE_LIMIT_CONFIG.general.keyPrefix).toBe("general");
  });
});
