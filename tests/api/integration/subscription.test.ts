import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubscriptionRoute } from "../../../apps/api/src/routes/subscription";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_BAD_REQUEST = 400;

/** テスト用Webhookシークレット */
const MOCK_WEBHOOK_SECRET = "test_webhook_secret_12345";

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_sub_01",
  email: "sub@example.com",
  name: "サブスクリプションテストユーザー",
  isPremium: false,
  premiumExpiresAt: null,
};

/** エラーレスポンスの型定義 */
type ErrorResponse = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** サブスクリプションステータスレスポンスの型定義 */
type SubscriptionStatusResponse = {
  success: boolean;
  data?: {
    isPremium: boolean;
    premiumExpiresAt: string | null;
  };
  error?: {
    code: string;
    message: string;
  };
};

/**
 * テスト用モックDBを生成する
 *
 * @param userInDb - DBに存在するユーザーデータ
 * @returns モックDBオブジェクト
 */
function createMockDb(userInDb: Record<string, unknown> = MOCK_USER) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([userInDb]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
}

/**
 * テスト用アプリを生成する
 *
 * @param mockDb - モックDBオブジェクト
 * @param authenticated - 認証状態（デフォルト: true）
 * @returns テスト用 Hono アプリ
 */
function createTestApp(mockDb: ReturnType<typeof createMockDb>, authenticated = true) {
  const route = createSubscriptionRoute({
    db: mockDb as unknown as Parameters<typeof createSubscriptionRoute>[0]["db"],
    webhookSecret: MOCK_WEBHOOK_SECRET,
  });

  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  app.use("*", async (c, next) => {
    if (authenticated) {
      c.set("user", MOCK_USER);
    }
    await next();
  });

  app.route("/", route);
  return app;
}

describe("サブスクリプションAPI 統合テスト", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe("GET /status", () => {
    it("認証済みユーザーがサブスクリプション状態を取得できること", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/status");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as SubscriptionStatusResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data?.isPremium).toBe("boolean");
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb, false);
      const req = new Request("http://localhost/status");

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("POST /webhooks/revenuecat", () => {
    it("有効なWebhookシークレットでINITIAL_PURCHASEイベントを処理できること", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const payload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: MOCK_USER.id,
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      };
      const req = new Request("http://localhost/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MOCK_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify(payload),
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("不正なWebhookシークレットの場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const payload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: MOCK_USER.id,
        },
      };
      const req = new Request("http://localhost/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer wrong_secret",
        },
        body: JSON.stringify(payload),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_INVALID");
    });

    it("不正なペイロードの場合に400エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp(mockDb);
      const req = new Request("http://localhost/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MOCK_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify({ invalid: "payload" }),
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      expect(body.success).toBe(false);
    });

    it("EXPIRATIONイベントでプレミアムを無効化できること", async () => {
      // Arrange
      const premiumUser = { ...MOCK_USER, isPremium: true };
      const expiredMockDb = createMockDb(premiumUser);
      const app = createTestApp(expiredMockDb);
      const payload = {
        event: {
          type: "EXPIRATION",
          app_user_id: MOCK_USER.id,
        },
      };
      const req = new Request("http://localhost/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MOCK_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify(payload),
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });
  });
});
