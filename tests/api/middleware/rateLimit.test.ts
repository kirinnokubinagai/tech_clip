import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createKvStore,
  createRateLimitMiddleware,
  type RateLimitConfig,
  type RateLimitStore,
} from "../../../apps/api/src/middleware/rateLimit";

/** レスポンスボディの型定義 */
type RateLimitResponseBody = {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
  data?: unknown;
};

/** テスト用のインメモリストア */
function createTestStore(): RateLimitStore {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    get: (key: string) => store.get(key) ?? null,
    set: (key: string, value: { count: number; resetAt: number }) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
  };
}

/** テスト用Honoアプリを作成する */
function createTestApp(config: RateLimitConfig, store?: RateLimitStore) {
  const app = new Hono();
  const middleware = createRateLimitMiddleware(config, store);

  app.use("/api/*", middleware);
  app.get("/api/test", (c) => c.json({ success: true, data: "ok" }));
  app.get("/public", (c) => c.json({ success: true, data: "公開リソース" }));

  return app;
}

describe("createRateLimitMiddleware", () => {
  let testStore: RateLimitStore;

  beforeEach(() => {
    testStore = createTestStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("制限内のリクエスト", () => {
    it("制限内のリクエストは200を返すこと", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 5,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });

      // Assert
      expect(res.status).toBe(200);
      const body = (await res.json()) as RateLimitResponseBody;
      expect(body.success).toBe(true);
    });

    it("制限ちょうどの回数まではリクエストが通ること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 3,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act & Assert: 3回まで成功
      for (let i = 0; i < 3; i++) {
        const res = await app.request("/api/test", {
          headers: { "CF-Connecting-IP": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }
    });

    it("異なるIPのリクエストは独立してカウントされること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 2,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act: IP1で2回
      for (let i = 0; i < 2; i++) {
        const res = await app.request("/api/test", {
          headers: { "CF-Connecting-IP": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }

      // Assert: IP2は別カウントなので成功
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.2" },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("制限超過のリクエスト", () => {
    it("制限を超えたリクエストは429を返すこと", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 2,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act: 2回リクエスト（制限内）
      await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });

      // 3回目（制限超過）
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });

      // Assert
      expect(res.status).toBe(429);
    });

    it("429レスポンスにRetry-Afterヘッダーが含まれること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 1,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act: 1回目（制限内）
      await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      // 2回目（制限超過）
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });

      // Assert
      expect(res.status).toBe(429);
      const retryAfter = res.headers.get("Retry-After");
      expect(retryAfter).not.toBeNull();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it("429レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 1,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act
      await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });

      // Assert
      expect(res.status).toBe(429);
      const body = (await res.json()) as RateLimitResponseBody;
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "リクエストが多すぎます。しばらく待ってから再度お試しください",
        },
      });
    });

    it("ウィンドウ期間後はカウントがリセットされること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 1,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act: 制限を超える
      await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      const resBefore = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      expect(resBefore.status).toBe(429);

      // 時間を進める（ウィンドウ期間経過）
      vi.advanceTimersByTime(61_000);

      // Assert: リセット後は成功
      const resAfter = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      expect(resAfter.status).toBe(200);
    });
  });

  describe("ルート別の制限設定", () => {
    it("認証ルートは10/minで制限されること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 10,
        windowMs: 60_000,
        keyPrefix: "auth",
      };
      const app = createTestApp(config, testStore);

      // Act: 10回成功
      for (let i = 0; i < 10; i++) {
        const res = await app.request("/api/test", {
          headers: { "CF-Connecting-IP": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }

      // 11回目は失敗
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      expect(res.status).toBe(429);
    });

    it("記事保存ルートは30/minで制限されること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 30,
        windowMs: 60_000,
        keyPrefix: "article",
      };
      const app = createTestApp(config, testStore);

      // Act: 30回成功
      for (let i = 0; i < 30; i++) {
        const res = await app.request("/api/test", {
          headers: { "CF-Connecting-IP": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }

      // 31回目は失敗
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      expect(res.status).toBe(429);
    });

    it("AIルートは10/minで制限されること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 10,
        windowMs: 60_000,
        keyPrefix: "ai",
      };
      const app = createTestApp(config, testStore);

      // Act: 10回成功
      for (let i = 0; i < 10; i++) {
        const res = await app.request("/api/test", {
          headers: { "CF-Connecting-IP": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }

      // 11回目は失敗
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      expect(res.status).toBe(429);
    });

    it("一般ルートは100/minで制限されること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 100,
        windowMs: 60_000,
        keyPrefix: "general",
      };
      const app = createTestApp(config, testStore);

      // Act: 100回成功
      for (let i = 0; i < 100; i++) {
        const res = await app.request("/api/test", {
          headers: { "CF-Connecting-IP": "192.168.1.1" },
        });
        expect(res.status).toBe(200);
      }

      // 101回目は失敗
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "192.168.1.1" },
      });
      expect(res.status).toBe(429);
    });
  });

  describe("IPアドレス取得", () => {
    it("CF-Connecting-IPヘッダーからIPを取得すること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 1,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act: 同一IPで2回
      await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "10.0.0.1" },
      });
      const res = await app.request("/api/test", {
        headers: { "CF-Connecting-IP": "10.0.0.1" },
      });

      // Assert: 同一IPとして扱われ429
      expect(res.status).toBe(429);
    });

    it("X-Forwarded-ForヘッダーからIPを取得すること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 1,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act: 同一IPで2回
      await app.request("/api/test", {
        headers: { "X-Forwarded-For": "10.0.0.2" },
      });
      const res = await app.request("/api/test", {
        headers: { "X-Forwarded-For": "10.0.0.2" },
      });

      // Assert: 同一IPとして扱われ429
      expect(res.status).toBe(429);
    });

    it("IPヘッダーがない場合はunknownとして扱われること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 1,
        windowMs: 60_000,
        keyPrefix: "test",
      };
      const app = createTestApp(config, testStore);

      // Act: ヘッダーなしで2回
      await app.request("/api/test");
      const res = await app.request("/api/test");

      // Assert: unknown IPとして同一カウント
      expect(res.status).toBe(429);
    });
  });

  describe("ユーザーIDベースの制限", () => {
    it("ユーザーIDが指定された場合はIPより優先されること", async () => {
      // Arrange
      const config: RateLimitConfig = {
        limit: 1,
        windowMs: 60_000,
        keyPrefix: "test",
        getUserId: (c) => c.req.header("X-User-Id") ?? null,
      };
      const app = createTestApp(config, testStore);

      // Act: 同一ユーザーIDで2回（異なるIPから）
      await app.request("/api/test", {
        headers: {
          "X-User-Id": "user_01",
          "CF-Connecting-IP": "192.168.1.1",
        },
      });
      const res = await app.request("/api/test", {
        headers: {
          "X-User-Id": "user_01",
          "CF-Connecting-IP": "192.168.1.2", // 異なるIP
        },
      });

      // Assert: 同一ユーザーとして扱われ429
      expect(res.status).toBe(429);
    });
  });

  describe("KVストア", () => {
    it("createKvStoreがKVNamespaceを使ったRateLimitStoreを返すこと", async () => {
      // Arrange
      const mockKv = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      } as unknown as KVNamespace;

      // Act
      const store = createKvStore(mockKv);

      // Assert: getが呼べること
      const result = await store.get("test-key");
      expect(result).toBeNull();
      expect(mockKv.get).toHaveBeenCalledWith("test-key", "json");
    });

    it("createKvStoreのsetがKV.putを呼ぶこと", async () => {
      // Arrange
      const mockKv = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      } as unknown as KVNamespace;
      const store = createKvStore(mockKv);

      // Act
      await store.set("test-key", { count: 1, resetAt: Date.now() + 60_000 });

      // Assert
      expect(mockKv.put).toHaveBeenCalledWith("test-key", expect.any(String), {
        expirationTtl: 120,
      });
    });

    it("createKvStoreのgetがエントリを正しく返すこと", async () => {
      // Arrange
      const entry = { count: 3, resetAt: 9999999999 };
      const mockKv = {
        get: vi.fn().mockResolvedValue(entry),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      } as unknown as KVNamespace;
      const store = createKvStore(mockKv);

      // Act
      const result = await store.get("test-key");

      // Assert
      expect(result).toEqual(entry);
    });
  });

  describe("定義済みレート制限設定", () => {
    it("RATE_LIMIT_CONFIGにauth設定が存在すること", async () => {
      const { RATE_LIMIT_CONFIG } = await import("../../../apps/api/src/middleware/rateLimit");
      expect(RATE_LIMIT_CONFIG.auth).toMatchObject({
        limit: 10,
        windowMs: 60_000,
        keyPrefix: "auth",
      });
    });

    it("RATE_LIMIT_CONFIGにarticleSave設定が存在すること", async () => {
      const { RATE_LIMIT_CONFIG } = await import("../../../apps/api/src/middleware/rateLimit");
      expect(RATE_LIMIT_CONFIG.articleSave).toMatchObject({
        limit: 30,
        windowMs: 60_000,
        keyPrefix: "article_save",
      });
    });

    it("RATE_LIMIT_CONFIGにai設定が存在すること", async () => {
      const { RATE_LIMIT_CONFIG } = await import("../../../apps/api/src/middleware/rateLimit");
      expect(RATE_LIMIT_CONFIG.ai).toMatchObject({
        limit: 10,
        windowMs: 60_000,
        keyPrefix: "ai",
      });
    });

    it("RATE_LIMIT_CONFIGにgeneral設定が存在すること", async () => {
      const { RATE_LIMIT_CONFIG } = await import("../../../apps/api/src/middleware/rateLimit");
      expect(RATE_LIMIT_CONFIG.general).toMatchObject({
        limit: 100,
        windowMs: 60_000,
        keyPrefix: "general",
      });
    });
  });
});
