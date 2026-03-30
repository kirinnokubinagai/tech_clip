import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAiLimitMiddleware } from "./ai-limit";

/** テスト用ユーザーID */
const TEST_USER_ID = "user_test_01";

/** テスト用プレミアムユーザーID */
const PREMIUM_USER_ID = "user_premium_01";

/** HTTP 402 Payment Required ステータスコード */
const HTTP_PAYMENT_REQUIRED = 402;

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** テスト用のフリーユーザーデータ */
function createFreeUserData(options?: {
  remaining?: number;
  resetAt?: string | null;
}) {
  return {
    id: TEST_USER_ID,
    email: "test@example.com",
    name: "テストユーザー",
    isPremium: false,
    freeAiUsesRemaining: options?.remaining ?? 5,
    freeAiResetAt: options?.resetAt ?? null,
  };
}

/** テスト用のプレミアムユーザーデータ */
function createPremiumUserData() {
  return {
    id: PREMIUM_USER_ID,
    email: "premium@example.com",
    name: "プレミアムユーザー",
    isPremium: true,
    freeAiUsesRemaining: 0,
    freeAiResetAt: null,
  };
}

/** モックの db.select クエリ結果 */
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

/** モックの db.update クエリ結果（.returning()付きアトミック更新用） */
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn().mockReturnValue({
  returning: mockUpdateReturning,
});
const mockUpdateSet = vi.fn().mockReturnValue({
  where: mockUpdateWhere,
});
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** テスト用のHonoアプリを作成する */
function createTestApp(userId?: string, downstreamStatus = HTTP_OK) {
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  if (userId) {
    app.use("/ai/*", async (c, next) => {
      c.set("user", { id: userId });
      await next();
    });
  }

  app.use("/ai/*", createAiLimitMiddleware(mockDb as never));
  app.post("/ai/summarize", (c) => {
    if (downstreamStatus >= 400) {
      return c.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
        downstreamStatus as 500,
      );
    }
    return c.json({ success: true, data: { summary: "テスト要約" } }, HTTP_OK);
  });

  return app;
}

describe("aiLimitMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateReturning.mockResolvedValue(undefined);
  });

  describe("無料ユーザー - 残回数あり", () => {
    it("残回数が1以上の場合リクエストが通過すること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("リクエスト後にdb.updateが呼ばれデクリメントされること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledTimes(1);
      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    });

    it("アトミック更新でreturningが呼ばれること（TOCTOU競合防止）", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert: アトミック更新には.returning()が必須
      expect(mockUpdateReturning).toHaveBeenCalledTimes(1);
    });

    it("アトミック更新が0件返した場合（競合負け）402を返すこと", async () => {
      // Arrange: SELECT時点では残回数ありだが、UPDATE時点で他リクエストに先を越された場合
      const userData = createFreeUserData({ remaining: 1 });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_PAYMENT_REQUIRED);
    });
  });

  describe("無料ユーザー - 残回数なし", () => {
    it("残回数が0でリセット期限内の場合402が返ること", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_PAYMENT_REQUIRED);
    });

    it("402レスポンスがAPI規約に従った形式であること", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AI_LIMIT_EXCEEDED",
          message:
            "無料のAI使用回数の上限に達しました。プレミアムプランにアップグレードしてください",
        },
      });
    });

    it("残回数が0でリセット期限内の場合db.updateが呼ばれないこと", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("プレミアムユーザー", () => {
    it("プレミアムユーザーはfreeAiUsesRemainingに関係なくリクエストが通過すること", async () => {
      // Arrange
      const userData = createPremiumUserData();
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(PREMIUM_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("プレミアムユーザーの場合db.updateが呼ばれないこと", async () => {
      // Arrange
      const userData = createPremiumUserData();
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(PREMIUM_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("月次リセット", () => {
    it("freeAiResetAtが過去の場合リセットされて通過すること", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue(undefined);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("リセット時にfreeAiUsesRemainingが4にセットされること（5 - 今回1使用）", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue(undefined);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledTimes(1);
      const setArg = mockUpdateSet.mock.calls[0][0];
      expect(setArg.freeAiUsesRemaining).toBe(4);
      expect(setArg.freeAiResetAt).not.toBe(pastDate);
      expect(setArg.freeAiResetAt).not.toBeNull();
    });

    it("freeAiResetAtがnullの場合もリセットされて通過すること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 0, resetAt: null });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue(undefined);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });
  });

  describe("未認証ユーザー", () => {
    it("contextにuser.idがセットされていない場合401が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "ログインが必要です",
        },
      });
    });

    it("ユーザーがDBに存在しない場合401が返ること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([]);
      const app = createTestApp("nonexistent_user_id");

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
    });
  });

  describe("ダウンストリーム失敗時", () => {
    it("ダウンストリームが500を返した場合db.updateが呼ばれないこと", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID, HTTP_INTERNAL_SERVER_ERROR);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("レスポンス形式", () => {
    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});
