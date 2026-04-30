import { HTTP_BAD_REQUEST, HTTP_OK, HTTP_UNAUTHORIZED } from "@api/lib/http-status";
import { createSubscriptionRoute } from "@api/routes/subscription";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * テスト用 HMAC-SHA256 署名を生成する
 *
 * @param secret - シークレットキー
 * @param body - 署名対象のリクエストボディ文字列
 * @returns Base64 エンコードされた HMAC-SHA256 署名
 */
async function generateTestHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

/** テスト用のモックユーザー（無料プラン） */
const MOCK_FREE_USER = {
  id: "user_01HXYZ",
  email: "free@example.com",
  name: "無料ユーザー",
  isPremium: false,
  premiumExpiresAt: null,
  freeAiUsesRemaining: 5,
  freeAiResetAt: null,
};

/** テスト用のモックユーザー（プレミアムプラン） */
const MOCK_PREMIUM_USER = {
  id: "user_02HXYZ",
  email: "premium@example.com",
  name: "プレミアムユーザー",
  isPremium: true,
  premiumExpiresAt: "2099-12-31T23:59:59Z",
  freeAiUsesRemaining: 5,
  freeAiResetAt: null,
};

/** テスト用のモックユーザー（グレースピリオド中） */
const MOCK_GRACE_PERIOD_USER = {
  id: "user_03HXYZ",
  email: "grace@example.com",
  name: "グレースユーザー",
  isPremium: true,
  premiumExpiresAt: "2020-01-01T00:00:00Z",
  freeAiUsesRemaining: 5,
  freeAiResetAt: null,
};

/** テスト用のモックユーザー（トライアル中） */
const MOCK_TRIAL_USER = {
  id: "user_04HXYZ",
  email: "trial@example.com",
  name: "トライアルユーザー",
  isPremium: true,
  premiumExpiresAt: "2099-12-31T23:59:59Z",
  freeAiUsesRemaining: 5,
  freeAiResetAt: null,
};

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
};

/** サブスクリプション状態レスポンスの型定義 */
type SubscriptionStatusResponseBody = {
  success: boolean;
  data: {
    isPremium: boolean;
    premiumExpiresAt: string | null;
    isInGracePeriod: boolean;
    gracePeriodEndsAt: string | null;
    isTrial: boolean;
  };
};

/** キャンセルレスポンスの型定義 */
type CancelResponseBody = {
  success: boolean;
  data?: {
    message: string;
    action: string;
  };
};

/** Webhookレスポンスの型定義 */
type WebhookResponseBody = {
  success: boolean;
  data?: {
    message: string;
  };
};

/** モックのDB操作関数 */
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

/** テスト用Webhook共有シークレット */
const TEST_WEBHOOK_SECRET = "test-webhook-secret-123";

/**
 * テスト用Honoアプリを作成する（認証済み・無料ユーザー）
 *
 * @returns テスト用Honoアプリ
 */
function createTestAppWithFreeUser() {
  type Variables = {
    user: typeof MOCK_FREE_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", (c, next) => {
    c.set("user", MOCK_FREE_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const subscriptionRoute = createSubscriptionRoute({
    db: mockDb as never,
    webhookSecret: TEST_WEBHOOK_SECRET,
  });
  app.route("/api/subscription", subscriptionRoute);

  return app;
}

/**
 * テスト用Honoアプリを作成する（認証済み・プレミアムユーザー）
 *
 * @returns テスト用Honoアプリ
 */
function createTestAppWithPremiumUser() {
  type Variables = {
    user: typeof MOCK_PREMIUM_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", (c, next) => {
    c.set("user", MOCK_PREMIUM_USER);
    c.set("session", { id: "session_02" });
    return next();
  });

  const subscriptionRoute = createSubscriptionRoute({
    db: mockDb as never,
    webhookSecret: TEST_WEBHOOK_SECRET,
  });
  app.route("/api/subscription", subscriptionRoute);

  return app;
}

/**
 * テスト用Honoアプリを作成する（認証済み・グレースピリオドユーザー）
 *
 * @returns テスト用Honoアプリ
 */
function createTestAppWithGracePeriodUser() {
  type Variables = {
    user: typeof MOCK_GRACE_PERIOD_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", (c, next) => {
    c.set("user", MOCK_GRACE_PERIOD_USER);
    c.set("session", { id: "session_03" });
    return next();
  });

  const subscriptionRoute = createSubscriptionRoute({
    db: mockDb as never,
    webhookSecret: TEST_WEBHOOK_SECRET,
  });
  app.route("/api/subscription", subscriptionRoute);

  return app;
}

/**
 * テスト用Honoアプリを作成する（認証済み・トライアルユーザー）
 *
 * @returns テスト用Honoアプリ
 */
function createTestAppWithTrialUser() {
  type Variables = {
    user: typeof MOCK_TRIAL_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", (c, next) => {
    c.set("user", MOCK_TRIAL_USER);
    c.set("session", { id: "session_04" });
    return next();
  });

  const subscriptionRoute = createSubscriptionRoute({
    db: mockDb as never,
    webhookSecret: TEST_WEBHOOK_SECRET,
  });
  app.route("/api/subscription", subscriptionRoute);

  return app;
}

/**
 * テスト用Honoアプリを作成する（未認証）
 *
 * @returns テスト用Honoアプリ
 */
function createTestAppWithoutAuth() {
  const app = new Hono();

  const subscriptionRoute = createSubscriptionRoute({
    db: mockDb as never,
    webhookSecret: TEST_WEBHOOK_SECRET,
  });
  app.route("/api/subscription", subscriptionRoute);

  return app;
}

describe("GET /api/subscription/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("正常系", () => {
    it("無料ユーザーのサブスク状態を取得できること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      const app = createTestAppWithFreeUser();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SubscriptionStatusResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.isPremium).toBe(false);
      expect(body.data.premiumExpiresAt).toBeNull();
      expect(body.data.isInGracePeriod).toBe(false);
      expect(body.data.gracePeriodEndsAt).toBeNull();
      expect(body.data.isTrial).toBe(false);
    });

    it("プレミアムユーザーのサブスク状態を取得できること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      const app = createTestAppWithPremiumUser();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SubscriptionStatusResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.isPremium).toBe(true);
      expect(body.data.premiumExpiresAt).toBe("2099-12-31T23:59:59Z");
      expect(body.data.isInGracePeriod).toBe(false);
      expect(body.data.gracePeriodEndsAt).toBeNull();
      expect(body.data.isTrial).toBe(false);
    });

    it("グレースピリオド中のユーザーの状態を取得できること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_GRACE_PERIOD_USER]);
      const app = createTestAppWithGracePeriodUser();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SubscriptionStatusResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.isPremium).toBe(true);
      expect(body.data.isInGracePeriod).toBe(true);
      expect(body.data.gracePeriodEndsAt).not.toBeNull();
    });

    it("トライアル中のユーザーの状態を取得できること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_TRIAL_USER]);
      const app = createTestAppWithTrialUser();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SubscriptionStatusResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.isPremium).toBe(true);
      expect(body.data.isTrial).toBe(false);
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      const app = createTestAppWithFreeUser();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SubscriptionStatusResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("isPremium");
      expect(body.data).toHaveProperty("premiumExpiresAt");
      expect(body.data).toHaveProperty("isInGracePeriod");
      expect(body.data).toHaveProperty("gracePeriodEndsAt");
      expect(body.data).toHaveProperty("isTrial");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      const app = createTestAppWithFreeUser();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });

  describe("ユーザー未存在", () => {
    it("DBにユーザーが存在しない場合404が返ること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([]);
      const app = createTestAppWithFreeUser();

      // Act
      const res = await app.request("/api/subscription/status");

      // Assert
      const HTTP_NOT_FOUND = 404;
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});

describe("POST /api/subscription/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("正常系", () => {
    it("プレミアムユーザーがキャンセル誘導レスポンスを受け取れること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      const app = createTestAppWithPremiumUser();

      // Act
      const res = await app.request("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as CancelResponseBody;
      expect(body.success).toBe(true);
      expect(body.data?.message).toBeDefined();
      expect(body.data?.action).toBe("redirect_to_store");
    });

    it("キャンセルリクエスト時にDBが更新されないこと", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      const app = createTestAppWithPremiumUser();

      // Act
      await app.request("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    it("プレミアムでないユーザーのキャンセルは400が返ること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      const app = createTestAppWithFreeUser();

      // Act
      const res = await app.request("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
    });

    it("DBにユーザーが存在しない場合404が返ること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([]);
      const app = createTestAppWithFreeUser();

      // Act
      const res = await app.request("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      const HTTP_NOT_FOUND = 404;
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      const app = createTestAppWithPremiumUser();

      // Act
      const res = await app.request("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as CancelResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("action", "redirect_to_store");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      const app = createTestAppWithPremiumUser();

      // Act
      const res = await app.request("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});

describe("POST /api/subscription/webhooks/revenuecat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証（Webhook署名検証）", () => {
    it("webhookSecretが未設定の場合500が返ること", async () => {
      // Arrange
      type Vars = Record<string, never>;
      const app = new Hono<{ Variables: Vars }>();
      const subscriptionRoute = createSubscriptionRoute({
        db: mockDb as never,
        webhookSecret: "",
      });
      app.route("/api/subscription", subscriptionRoute);

      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": "dummy",
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(500);
    });

    it("RevenueCat-Signatureヘッダーが無い場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("不正なシークレットの場合401が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": "aW52YWxpZC1zaWduYXR1cmU=",
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_INVALID");
    });

    it("正しいシークレットで認証が通ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_FREE_USER, isPremium: true }]);
      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body.success).toBe(true);
    });
  });

  describe("INITIAL_PURCHASE イベント", () => {
    it("isPremiumがtrueに更新されること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_FREE_USER, isPremium: true }]);
      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("RENEWAL イベント", () => {
    it("isPremiumがtrueに更新されること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_PREMIUM_USER, isPremium: true }]);
      const webhookPayload = {
        event: {
          type: "RENEWAL",
          app_user_id: "user_02HXYZ",
          expiration_at_ms: 1767225599000,
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("EXPIRATION イベント", () => {
    it("isPremiumがfalseに更新されること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
      mockUpdateReturning.mockResolvedValue([
        { ...MOCK_PREMIUM_USER, isPremium: false, premiumExpiresAt: null },
      ]);
      const webhookPayload = {
        event: {
          type: "EXPIRATION",
          app_user_id: "user_02HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("CANCELLATION イベント", () => {
    it("isPremiumがfalseに更新されること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_PREMIUM_USER]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
      mockUpdateReturning.mockResolvedValue([
        { ...MOCK_PREMIUM_USER, isPremium: false, premiumExpiresAt: null },
      ]);
      const webhookPayload = {
        event: {
          type: "CANCELLATION",
          app_user_id: "user_02HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("バリデーション", () => {
    it("eventフィールドが無い場合400が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(TEST_WEBHOOK_SECRET, JSON.stringify({})),
        },
        body: JSON.stringify({}),
      });

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
    });

    it("event.typeが無い場合400が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify({ event: {} }),
          ),
        },
        body: JSON.stringify({ event: {} }),
      });

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
    });

    it("app_user_idが無い場合400が返ること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify({ event: { type: "INITIAL_PURCHASE" } }),
          ),
        },
        body: JSON.stringify({ event: { type: "INITIAL_PURCHASE" } }),
      });

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("ユーザー未存在", () => {
    it("存在しないユーザーIDの場合でも200を返すこと", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([]);
      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "nonexistent_user",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body.success).toBe(true);
    });
  });

  describe("未知のイベントタイプ", () => {
    it("未知のイベントタイプでも200を返すこと", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      const webhookPayload = {
        event: {
          type: "UNKNOWN_EVENT",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body.success).toBe(true);
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_FREE_USER, isPremium: true }]);
      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as WebhookResponseBody;
      expect(body).toHaveProperty("success", true);
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const app = createTestAppWithoutAuth();
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_FREE_USER]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
      mockUpdateReturning.mockResolvedValue([{ ...MOCK_FREE_USER, isPremium: true }]);
      const webhookPayload = {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_01HXYZ",
        },
      };

      // Act
      const res = await app.request("/api/subscription/webhooks/revenuecat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RevenueCat-Signature": await generateTestHmac(
            TEST_WEBHOOK_SECRET,
            JSON.stringify(webhookPayload),
          ),
        },
        body: JSON.stringify(webhookPayload),
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});
